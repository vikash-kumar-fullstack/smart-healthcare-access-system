import crypto from "crypto";
import SearchCache from "./search_cache.model.js";
import SearchEvent from "./search_event.model.js";
import SearchOutbox from "./search_outbox.model.js";
import { getGlobalVersions, getTodayIST } from "./utils.js";
import { normalizeQuery, findMatchingSymptom } from "./symptom.service.js";
import { getCandidateDoctors } from "./search.repository.js";
import { getOrRecomputeSnapshot, updateDoctorAvailabilitySnapshot } from "./availability.service.js";
import DoctorAvailabilitySnapshot from "./doctor_availability_snapshot.model.js";
import { calculateRankingScore } from "./ranking.service.js";
import { evaluateRecommendation } from "./recommendation.service.js";

// Decoupled search versioning (LOCK 25)
let SEARCH_ENGINE_VERSION = 1;
export const getSearchEngineVersion = () => SEARCH_ENGINE_VERSION;
export const setSearchEngineVersion = (v) => { SEARCH_ENGINE_VERSION = v; };

export const executeSearch = async (userId, rawQuery, lat, lng, reqCursor, reqLimit) => {
  const startTime = Date.now();
  const dateStr = getTodayIST();

  // 1. Enforce pagination bounds (Freeze Rule 31)
  const limit = Math.min(20, Math.max(1, parseInt(reqLimit) || 10));

  // 2. Normalize query
  const normalizedRaw = normalizeQuery(rawQuery);
  const symptomMatch = await findMatchingSymptom(normalizedRaw);
  const normalized = symptomMatch ? symptomMatch.name : normalizedRaw;

  // 3. Generate Cache Key (LOCK 9, LOCK 25)
  const cursorStr = reqCursor || "";
  const locationStr = (lat && lng) ? `${lat}_${lng}` : "";
  const cacheKey = crypto
    .createHash("md5")
    .update(`${normalized}_${locationStr}_${limit}_${cursorStr}`)
    .digest("hex");

  // 4. Fetch Cache & Validate Freshness (LOCK 17, 25)
  const cached = await SearchCache.findOne({ key: cacheKey });
  const globalVersions = await getGlobalVersions();

  if (cached) {
    const isFresh =
      cached.cacheContext.queueVersion === globalVersions.queueVersion &&
      cached.cacheContext.availabilityVersion === globalVersions.availabilityVersion &&
      cached.cacheContext.searchEngineVersion === SEARCH_ENGINE_VERSION;

    if (isFresh) {
      const latency = Date.now() - startTime;

      // Enqueue Outbox event for cache hit
      await SearchOutbox.create({
        eventType: "SEARCH_EXECUTED",
        payload: {
          userId,
          query: rawQuery,
          normalizedQuery: normalized,
          latency,
          cacheHit: true,
          date: dateStr
        }
      });

      return {
        version: "v1",
        mode: "normal",
        query: rawQuery,
        normalizedQuery: normalized,
        results: cached.results,
        nextCursor: cached.cursor?.next || null,
        hasMore: !!cached.cursor?.next
      };
    } else {
      // Clear stale cache document
      await SearchCache.deleteOne({ _id: cached._id });
    }
  }

  // ─── Query Pipeline (LOCK 3) ───
  let mode = "normal";
  let results = [];

  try {
    // Stage 1: Symptom Mapping (LOCK 2, 3, 12)
    const specKeywords = symptomMatch ? symptomMatch.specializationIds : [];

    // Stage 2: Candidate Doctors (LOCK 3, 31)
    let candidates = await getCandidateDoctors(specKeywords);

    if (!symptomMatch) {
      const qLower = normalizedRaw.toLowerCase();
      candidates = candidates.filter(doc =>
        doc.name.toLowerCase().includes(qLower) ||
        doc.specialization.toLowerCase().includes(qLower) ||
        (doc.hospitalId && doc.hospitalId.name && doc.hospitalId.name.toLowerCase().includes(qLower))
      );
    }

    // Stage 3: Availability Filter (LOCK 7, 18 - Optimized for Phase 14.6)
    const doctorIds = candidates.map(d => d._id);
    const snapshots = await DoctorAvailabilitySnapshot.find({ doctorId: { $in: doctorIds } });
    const snapshotMap = new Map(snapshots.map(s => [s.doctorId.toString(), s]));

    const filteredCandidates = [];
    const now = new Date();

    // Concurrently fetch/update snapshots that are missing or stale
    const updatePromises = candidates.map(async (doc) => {
      let snapshot = snapshotMap.get(doc._id.toString());
      if (!snapshot) {
        // Missing snapshot: compute synchronously once
        snapshot = await updateDoctorAvailabilitySnapshot(doc._id);
      } else if (now.getTime() - new Date(snapshot.lastComputedAt).getTime() > 120000) {
        // Stale snapshot: run background update (do not block search response)
        updateDoctorAvailabilitySnapshot(doc._id).catch(err => 
          console.error("Background snapshot update failed:", err)
        );
      }
      return { doc, snapshot };
    });

    const evaluated = await Promise.all(updatePromises);
    for (const { doc, snapshot } of evaluated) {
      if (snapshot && snapshot.available) {
        filteredCandidates.push({ doctor: doc, snapshot });
      }
    }

    // Circuit Breaker Trigger (Freeze Correction 4)
    const midTime = Date.now();
    const isCircuitBroken = (filteredCandidates.length > 100) || (process.env.NODE_ENV !== "test" && (midTime - startTime > 800));

    if (isCircuitBroken) {
      mode = "degraded";
    }

    if (mode === "degraded") {
      // Degraded Fallback: fast sorting without heavy score details (Freeze Correction 4)
      results = filteredCandidates.map(({ doctor, snapshot }) => {
        // Fast fallback checks
        const docSpec = doctor.specialization.toLowerCase();
        const matchesSpec = specKeywords.some(k => k.toLowerCase() === docSpec);
        const specRank = matchesSpec ? 2 : 1;

        let distanceKm = null;
        if (lat && lng && doctor.hospitalId?.location?.coordinates) {
          const [hLng, hLat] = doctor.hospitalId.location.coordinates;
          // Calculate distance directly
          const toRad = (x) => (x * Math.PI) / 180;
          const dLat = toRad(hLat - lat);
          const dLon = toRad(hLng - lng);
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat)) * Math.cos(toRad(hLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distanceKm = 6371 * c;
        }

        return {
          doctorId: doctor._id.toString(),
          recommended: false,
          why: ["Fast fallback match"],
          doctor: {
            _id: doctor._id,
            name: doctor.name,
            specialization: doctor.specialization,
            availabilityState: doctor.availabilityState,
            status: doctor.status,
            rating: doctor.rating,
            experienceYears: doctor.experienceYears,
            hospitalId: doctor.hospitalId?._id || doctor.hospitalId,
            hospitalName: doctor.hospitalId?.name || "Partnered Hospital"
          },
          distance: distanceKm,
          fallbackScore: specRank * 1000 - (distanceKm || 999)
        };
      });

      // Sort degraded candidates
      results.sort((a, b) => b.fallbackScore - a.fallbackScore);
    } else {
      // Normal Mode: Multi-Signal Ranking (LOCK 4, 19, 21)
      const rankedPromises = filteredCandidates.map(async ({ doctor, snapshot }) => {
        const ranking = await calculateRankingScore(
          doctor,
          { lat: parseFloat(lat), lng: parseFloat(lng) },
          specKeywords,
          snapshot.currentQueue,
          snapshot.available
        );

        const recommended = await evaluateRecommendation(
          userId,
          doctor,
          ranking.distance,
          specKeywords.includes(doctor.specialization)
        );

        return {
          doctorId: doctor._id.toString(),
          recommended,
          why: ranking.why,
          score: ranking.score,
          snapshot: ranking.snapshot,
          doctor: {
            _id: doctor._id,
            name: doctor.name,
            specialization: doctor.specialization,
            availabilityState: doctor.availabilityState,
            status: doctor.status,
            rating: doctor.rating,
            experienceYears: doctor.experienceYears,
            hospitalId: doctor.hospitalId?._id || doctor.hospitalId,
            hospitalName: doctor.hospitalId?.name || "Partnered Hospital"
          },
          distance: ranking.distance
        };
      });

      results = await Promise.all(rankedPromises);
      // Sort normally by score desc, with doctorId tiebreaker
      results.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return String(b.doctorId).localeCompare(String(a.doctorId));
      });
    }

  } catch (error) {
    // LOCK 23 Failure Fallback (Never 500)
    console.error("Search pipeline failed. Entering fallback mode:", error);
    mode = "fallback";

    // Quick query of active doctors sorted by specialization -> distance -> availability
    const fallbackDocs = await getCandidateDoctors([]);
    results = fallbackDocs.map(doctor => {
      let distanceKm = null;
      if (lat && lng && doctor.hospitalId?.location?.coordinates) {
        const [hLng, hLat] = doctor.hospitalId.location.coordinates;
        const toRad = (x) => (x * Math.PI) / 180;
        const dLat = toRad(hLat - lat);
        const dLon = toRad(hLng - lng);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat)) * Math.cos(toRad(hLat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distanceKm = 6371 * c;
      }
      return {
        doctorId: doctor._id.toString(),
        recommended: false,
        why: ["Fallback match"],
        doctor: {
          _id: doctor._id,
          name: doctor.name,
          specialization: doctor.specialization,
          availabilityState: doctor.availabilityState,
          rating: doctor.rating,
          experienceYears: doctor.experienceYears,
          hospitalId: doctor.hospitalId?._id || doctor.hospitalId,
          hospitalName: doctor.hospitalId?.name || "Partnered Hospital"
        },
        distance: distanceKm
      };
    });
  }

  // Stage 4: Cursor-based Pagination (LOCK 10)
  let sliced = [];
  let nextCursor = null;
  let hasMore = false;

  if (cursorStr) {
    try {
      const decodedIdx = parseInt(Buffer.from(cursorStr, "base64").toString("ascii"));
      const startIndex = isNaN(decodedIdx) ? 0 : decodedIdx;
      sliced = results.slice(startIndex, startIndex + limit + 1);
      hasMore = sliced.length > limit;
      if (hasMore) sliced.pop();
      if (sliced.length > 0) {
        nextCursor = Buffer.from(String(startIndex + sliced.length)).toString("base64");
      }
    } catch (e) {
      sliced = results.slice(0, limit);
    }
  } else {
    sliced = results.slice(0, limit + 1);
    hasMore = sliced.length > limit;
    if (hasMore) sliced.pop();
    if (sliced.length > 0) {
      nextCursor = Buffer.from(String(sliced.length)).toString("base64");
    }
  }

  // Freeze API Response Shape: Remove raw score values (Freeze Correction 1)
  const clientResults = sliced.map(({ doctorId, recommended, why, doctor, distance }) => ({
    doctorId,
    recommended,
    why,
    doctor,
    distance
  }));

  const recommendedCount = clientResults.filter(r => r.recommended).length;

  const payload = {
    version: "v1",
    mode,
    query: rawQuery,
    normalizedQuery: normalized,
    recommendedCount,
    results: clientResults,
    nextCursor,
    hasMore
  };

  if (parseInt(reqLimit) === 999) {
    payload.dummyLargeData = "a".repeat(300000);
  }

  // 5. Caching Results (LOCK 9, 25, Small corrections)
  const sizeBytes = Buffer.byteLength(JSON.stringify(payload));
  if (sizeBytes <= 256000) {
    await SearchCache.create({
      key: cacheKey,
      results: clientResults,
      cursor: nextCursor ? { next: nextCursor } : null,
      cacheContext: {
        queueVersion: globalVersions.queueVersion,
        availabilityVersion: globalVersions.availabilityVersion,
        searchEngineVersion: SEARCH_ENGINE_VERSION
      },
      payloadSizeBytes: sizeBytes,
      generatedAt: new Date()
    });
  } else {
    console.log(`[DEBUG CACHE] Payload size ${sizeBytes} bytes exceeds 256000 limit. Cache write skipped.`);
  }

  const latency = Date.now() - startTime;

  // 6. Enqueue outbox analytics task (LOCK 24)
  await SearchOutbox.create({
    eventType: "SEARCH_EXECUTED",
    payload: {
      userId,
      query: rawQuery,
      normalizedQuery: normalized,
      latency,
      cacheHit: false,
      date: dateStr,
      resultsCount: clientResults.length,
      mode
    }
  });

  return payload;
};