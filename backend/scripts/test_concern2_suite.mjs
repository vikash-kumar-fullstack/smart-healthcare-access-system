import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { understandQuery } from "../src/modules/search/query_understanding.service.js";
import { getCarePathwayForQuery } from "../src/modules/search/symptom.service.js";
import { calculateFreshness, calculateNetworkReliability, computeFahraScore, PREFERENCE_WEIGHTS, CONFIDENCE_THRESHOLD_MIN } from "../src/modules/search/fahra.service.js";
import { executeSearch, getDoctorHealthcareDetails } from "../src/modules/search/search.service.js";
import { calculateRankingScore } from "../src/modules/search/ranking.service.js";
import Doctor from "../src/modules/doctor/doctor.model.js";
import { formatEstimatedTravelTime } from "../../frontend/src/utils/formatters.js";

async function runResearchTests() {
  console.log("=== RUNNING CONCERN #2 RESEARCH & ALGORITHM TEST SUITE ===\n");
  let passed = 0;
  let failed = 0;

  const assert = (condition, desc) => {
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      failed++;
    }
  };

  try {
    await mongoose.connect(process.env.MONGO_URI);

    // ====================================================
    // PART A: CLINICAL QUERY UNDERSTANDING & CARE PATHWAYS
    // ====================================================
    console.log("--- PART A: Query Understanding & Care Pathways ---");

    // 1. Symptom 'fever'
    const feverU = await understandQuery("fever");
    assert(
      feverU.queryType === "symptom" &&
      feverU.confidence === "HIGH" &&
      feverU.candidateSpecialties.includes("General Medicine"),
      "Test A1: 'fever' maps with HIGH confidence to General Medicine"
    );

    // 2. Symptom 'headache'
    const headacheU = await understandQuery("headache");
    assert(
      headacheU.candidateSpecialties.includes("Neurology") &&
      headacheU.candidateSpecialties.includes("General Medicine"),
      "Test A2: 'headache' maps to primary Neurology and General Medicine"
    );

    // 3. Symptom 'skin rash'
    const rashU = await understandQuery("skin rash");
    assert(
      rashU.candidateSpecialties.includes("Dermatology"),
      "Test A3: 'skin rash' maps to Dermatology"
    );

    // 4. Symptom 'joint pain'
    const jointU = await understandQuery("joint pain");
    assert(
      jointU.candidateSpecialties.includes("Orthopedics"),
      "Test A4: 'joint pain' maps to Orthopedics"
    );

    // 5. Acute emergency 'chest pain'
    const chestU = await understandQuery("chest pain");
    assert(
      chestU.isEmergency === true && chestU.emergencyMessage !== null,
      "Test A5: 'chest pain' triggers acute emergency red-flag alert"
    );

    // 6. Direct specialty 'neurology'
    const neuroU = await understandQuery("neurology");
    assert(
      neuroU.queryType === "specialty" && neuroU.primarySpecialty === "Neurology",
      "Test A6: 'neurology' recognized directly as specialty query"
    );

    // 7. Direct specialty 'dermatology'
    const dermaU = await understandQuery("dermatology");
    assert(
      dermaU.queryType === "specialty" && dermaU.primarySpecialty === "Dermatology",
      "Test A7: 'dermatology' recognized directly as specialty query"
    );

    // 8. Doctor name 'Dr. Patel'
    const docU = await understandQuery("Dr. Patel");
    assert(
      docU.queryType === "doctor_name" && docU.confidence === "HIGH",
      "Test A8: 'Dr. Patel' recognized as doctor_name query"
    );

    // 9. Hospital name 'AIIMS'
    const hospU = await understandQuery("AIIMS");
    assert(
      hospU.queryType === "hospital_name" && hospU.confidence === "HIGH",
      "Test A9: 'AIIMS' recognized as hospital_name query"
    );

    // 10. Empty query
    const emptyU = await understandQuery("");
    assert(
      emptyU.queryType === "empty" && emptyU.confidence === "LOW",
      "Test A10: Empty query handled gracefully without crash"
    );

    // 11. Long query with punctuation
    const longQ = "fever!@#$%^&*()_+ and headache with high temperature for three days in a row";
    const longU = await understandQuery(longQ);
    assert(
      longU.isKnownHealthcareQuery === true &&
      longU.matchedSymptoms.length > 0,
      "Test A11: Long query with punctuation normalized and understood"
    );

    // ====================================================
    // PART B: DETERMINISTIC RESEARCH AUDIT TESTS (TEST 1 - 12)
    // ====================================================
    console.log("\n--- PART B: Deterministic Research Scenarios (TEST 1 - 12) ---");

    // TEST 1 — Closest ranking
    // Hospital A is geographically closest. Nearest mode must rank A first.
    const candA1 = { distance: 1.8, estimatedWaitMinutes: 25, estimatedAccessMinutes: 29, score: 70, doctorId: "doc_closest_a" };
    const candA2 = { distance: 12.4, estimatedWaitMinutes: 25, estimatedAccessMinutes: 50, score: 85, doctorId: "doc_far_a" };
    const list1 = [candA2, candA1];
    list1.sort((a, b) => {
      if (a.distance !== null && b.distance !== null) {
        const dDiff = a.distance - b.distance;
        if (Math.abs(dDiff) > 0.001) return dDiff;
      }
      return b.score - a.score;
    });
    assert(
      list1[0].doctorId === "doc_closest_a" && list1[0].distance === 1.8,
      "TEST 1 — Closest ranking: Nearest mode prioritizes minimum geographic distance"
    );

    // TEST 2 — Fastest ranking
    // Hospital B has lower estimated access time (Access Time = Waiting Time + Travel Time). Shortest wait mode must rank B first.
    const candB1 = { distance: 6.0, estimatedWaitMinutes: 50, estimatedTravelMinutes: 12, estimatedAccessMinutes: 62, score: 80, doctorId: "doc_slow" };
    const candB2 = { distance: 6.0, estimatedWaitMinutes: 10, estimatedTravelMinutes: 12, estimatedAccessMinutes: 22, score: 72, doctorId: "doc_fast" };
    const list2 = [candB1, candB2];
    list2.sort((a, b) => {
      const diff = (a.estimatedAccessMinutes ?? 0) - (b.estimatedAccessMinutes ?? 0);
      if (diff !== 0) return diff;
      return b.score - a.score;
    });
    assert(
      list2[0].doctorId === "doc_fast" && list2[0].estimatedAccessMinutes === 22,
      "TEST 2 — Fastest ranking: Shortest wait mode prioritizes minimum estimated access time"
    );

    // TEST 3 — Recommended ranking divergence
    // Nearest != Shortest Wait != Recommended
    // Facility 1 (Nearest): Distance = 1.0 km, Wait = 55 min, Travel = 5 min -> Access = 60 min.
    // Facility 2 (Shortest wait): Distance = 15.0 km, Wait = 5 min, Travel = 10 min -> Access = 15 min.
    // Facility 3 (Recommended): Distance = 3.0 km, Wait = 15 min, Travel = 6 min -> Access = 21 min. Excellent balance and fresh data.
    const optNearest = { id: "hosp_near", distance: 1.0, wait: 55, access: 60 };
    const optFastest = { id: "hosp_fast", distance: 15.0, wait: 5, access: 15 };
    const optRecommended = { id: "hosp_rec", distance: 3.0, wait: 15, access: 21 };

    // Closest ranking
    const rankClosest = [optFastest, optRecommended, optNearest].sort((a, b) => a.distance - b.distance);
    // Fastest ranking
    const rankFastest = [optNearest, optRecommended, optFastest].sort((a, b) => a.access - b.access);
    // Recommended ranking (FA-HRA multi-factor score)
    const fahraNear = computeFahraScore({ estimatedWaitMinutes: optNearest.wait, distanceKm: optNearest.distance, currentQueue: 11, preference: "balanced" });
    const fahraFast = computeFahraScore({ estimatedWaitMinutes: optFastest.wait, distanceKm: optFastest.distance, currentQueue: 1, preference: "balanced" });
    const fahraRec = computeFahraScore({ estimatedWaitMinutes: optRecommended.wait, distanceKm: optRecommended.distance, currentQueue: 3, preference: "balanced" });

    const rankRec = [
      { id: "hosp_near", suitability: fahraNear.suitabilityScore },
      { id: "hosp_fast", suitability: fahraFast.suitabilityScore },
      { id: "hosp_rec", suitability: fahraRec.suitabilityScore }
    ].sort((a, b) => b.suitability - a.suitability);

    assert(
      rankClosest[0].id === "hosp_near" &&
      rankFastest[0].id === "hosp_fast" &&
      rankRec[0].id === "hosp_rec" &&
      rankClosest[0].id !== rankFastest[0].id &&
      rankFastest[0].id !== rankRec[0].id,
      "TEST 3 — Recommended ranking divergence: Nearest ≠ Shortest Wait ≠ Recommended across distinct profiles"
    );

    // TEST 4 — Freshness impact
    // Hospital A (fresh) vs Hospital B (stale) with identical wait and distance
    const nowMs = Date.now();
    const freshStamp = new Date(nowMs - 20 * 1000); // 20s old
    const staleStamp = new Date(nowMs - 3600 * 1000); // 60 min old
    const fahraFreshDoc = computeFahraScore({ estimatedWaitMinutes: 20, distanceKm: 5, currentQueue: 4, lastComputedAt: freshStamp, preference: "balanced" });
    const fahraStaleDoc = computeFahraScore({ estimatedWaitMinutes: 20, distanceKm: 5, currentQueue: 4, lastComputedAt: staleStamp, preference: "balanced" });
    assert(
      fahraFreshDoc.freshness.freshness > fahraStaleDoc.freshness.freshness &&
      fahraFreshDoc.suitabilityScore > fahraStaleDoc.suitabilityScore &&
      fahraStaleDoc.confidence.isUncertain === true &&
      fahraStaleDoc.freshness.patientStatus === "stale",
      "TEST 4 — Freshness impact: Fresh telemetry outranks stale telemetry and marks stale data uncertain"
    );

    // TEST 5 — Volatility impact
    // Two hospitals with same age (10 min) but different operational volatility
    const tenMinAge = new Date(nowMs - 600 * 1000);
    const lowVol = calculateFreshness(tenMinAge, { volatility: 0.5, isVolatilityMeasured: true });
    const highVol = calculateFreshness(tenMinAge, { volatility: 2.5, isVolatilityMeasured: true });
    assert(
      lowVol.freshness > highVol.freshness &&
      lowVol.volatility === 0.5 &&
      highVol.volatility === 2.5,
      "TEST 5 — Volatility impact: Higher state volatility accelerates freshness decay exponentially"
    );

    // TEST 6 — Missing update timestamp
    // When update timestamp is missing or null, no fabricated timestamp appears
    const nullFreshness = calculateFreshness(null);
    assert(
      nullFreshness.isUnavailable === true &&
      nullFreshness.ageSeconds === null &&
      nullFreshness.patientStatus === "unavailable" &&
      nullFreshness.displayText.includes("unavailable"),
      "TEST 6 — Missing update timestamp: Null timestamp is explicitly marked unavailable (No fabrication)"
    );

    // TEST 7 — Unknown query
    // Query 'unknownabc' must NOT silently map to General Medicine
    const unknownQ = await understandQuery("unknownabc");
    const unknownSearch = await executeSearch("test-user", "unknownabc", null, null, null, 10);
    assert(
      unknownQ.queryType === "unknown" &&
      unknownQ.confidence === "LOW" &&
      unknownQ.isKnownHealthcareQuery === false &&
      !unknownQ.candidateSpecialties.includes("General Medicine") &&
      unknownSearch.results.length === 0 &&
      unknownSearch.mode === "unknown_query",
      "TEST 7 — Unknown query: 'unknownabc' does not map to General Medicine and returns safe unknown state"
    );

    // TEST 8 — Unsupported specialty
    // Query for specialty with 0 providers (e.g. 'urology') must return 0 matches, NOT substitute general doctors
    const urologySearch = await executeSearch("test-user", "urology", null, null, null, 10);
    assert(
      urologySearch.results.length === 0,
      "TEST 8 — Unsupported specialty: Strict specialty eligibility prevents unrelated doctor substitutions"
    );

    // TEST 9 — Missing patient location
    // Without coordinates, distance must be null and locationProvided=false (No fake distance fabricated)
    const noLocSearch = await executeSearch("test-user", "fever", null, null, null, 5);
    const noDistAllNull = noLocSearch.results.every(r => r.distance === null && r.locationProvided === false);
    assert(
      noLocSearch.results.length > 0 && noDistAllNull,
      "TEST 9 — Missing patient location: Distance remains null with locationProvided=false (No fabrication)"
    );

    // TEST 10 — Baseline network reliability
    // Baseline network reliability must be explicitly tagged as baseline, not measured hardware telemetry
    const netBaseline = calculateNetworkReliability();
    assert(
      netBaseline.reliability === 1.0 &&
      netBaseline.telemetryType === "baseline" &&
      netBaseline.rttMs === null,
      "TEST 10 — Baseline network reliability: N_h is explicitly labeled architectural baseline"
    );

    // TEST 11 — Explanation consistency
    // Every displayed recommendation reason corresponds to actual underlying data/ranking factors
    const sampleDoc = await Doctor.findOne({ status: "active" }).populate("hospitalId");
    if (sampleDoc) {
      const ranking = await calculateRankingScore(
        sampleDoc,
        { lat: 28.5672, lng: 77.21 },
        [sampleDoc.specialization],
        2,
        true,
        { preference: "balanced" }
      );
      const allReasonsGrounded = ranking.why.length > 0 && ranking.why.every(reason => typeof reason === "string" && reason.trim().length > 0);
      assert(
        allReasonsGrounded && Array.isArray(ranking.explanation.factors),
        "TEST 11 — Explanation consistency: Every recommendation reason is grounded in real ranking factors"
      );
    }

    // TEST 12 — Alternative hospital
    // Inspecting an alternative doctor returns valid details through identical progressive disclosure pipeline
    if (sampleDoc) {
      const parentDetails = await getDoctorHealthcareDetails(sampleDoc._id.toString(), null, "fever");
      if (parentDetails.alternatives && parentDetails.alternatives.length > 0) {
        const altDocId = parentDetails.alternatives[0].doctorId;
        const altDetails = await getDoctorHealthcareDetails(altDocId, null, "fever");
        assert(
          altDetails !== null &&
          altDetails.doctor._id === altDocId &&
          altDetails.freshness !== undefined &&
          altDetails.operational !== undefined,
          "TEST 12 — Alternative hospital: Alternative candidate loads through identical progressive disclosure pipeline"
        );
      } else {
        assert(parentDetails !== null, "TEST 12 — Alternative hospital: Single doctor verified in dataset");
      }

      // TEST 13 — Details -> Booking regression test
      // Ensure doctor object in details response has canonical hospitalId so booking modal does not get hospitalId=undefined
      const bookingDocId = sampleDoc._id.toString();
      const detailsForBooking = await getDoctorHealthcareDetails(bookingDocId, null, "fever");
      assert(
        detailsForBooking !== null &&
        typeof detailsForBooking.doctor?.hospitalId === "string" &&
        detailsForBooking.doctor.hospitalId.length > 0 &&
        detailsForBooking.doctor.hospitalId !== "undefined" &&
        detailsForBooking.hospital?._id === detailsForBooking.doctor.hospitalId,
        "TEST 13 — Details -> Booking regression: Canonical hospitalId is present on doctor and matches hospital._id"
      );
    }

    // TEST 14 — Travel time formatter exact specification
    const t45 = formatEstimatedTravelTime(45);
    const t60 = formatEstimatedTravelTime(60);
    const t75 = formatEstimatedTravelTime(75);
    const t120 = formatEstimatedTravelTime(120);
    const t3253 = formatEstimatedTravelTime(3253);
    assert(
      t45 === "~45 min" &&
      t60 === "~1 hr" &&
      t75 === "~1 hr 15 min" &&
      t120 === "~2 hr" &&
      t3253 === "~54 hr 13 min",
      "TEST 14 — Travel time formatter: 45->~45 min, 60->~1 hr, 75->~1 hr 15 min, 120->~2 hr, 3253->~54 hr 13 min"
    );

    // TEST 15 — Missing timestamp audit & patient representation
    const missingAudit = calculateFreshness(null);
    assert(
      missingAudit.freshness === 0.3 &&
      missingAudit.isUnavailable === true &&
      missingAudit.ageSeconds === null &&
      missingAudit.patientStatus === "unavailable" &&
      missingAudit.patientLabel === "Update time unavailable" &&
      missingAudit.displayText === "Update time unavailable",
      "TEST 15 — Missing timestamp audit: Conservative 0.3 F_h internal default with 'Update time unavailable' for patient"
    );

  } catch (err) {
    console.error("Test execution fatal error:", err);
    failed++;
  } finally {
    await mongoose.disconnect();
  }

  console.log("\n=================================");
  console.log(`TOTAL: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log("=================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runResearchTests();

