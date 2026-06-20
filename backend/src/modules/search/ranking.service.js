import DoctorAnalyticsDaily from "../doctor/doctor_analytics_daily.model.js";
import Queue from "../queue/queue.model.js";

// Haversine Distance helper (coordinates: [lng, lat])
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const calculateRankingScore = async (doctor, patientCoords, symptomMatchSpecializations, currentQueue, availability) => {
  const why = [];

  // ── 1. Specialization Match Score (35%) ──
  let specScore = 0;
  if (symptomMatchSpecializations && symptomMatchSpecializations.length > 0) {
    const docSpecNormalized = doctor.specialization.toLowerCase().trim();
    const matches = symptomMatchSpecializations.map(s => s.toLowerCase().trim());
    if (matches.includes(docSpecNormalized)) {
      specScore = 100;
      why.push("Strong symptom match");
    } else {
      // Related specialization check
      const relatedMap = {
        "general physician": ["pulmonology", "pediatrics", "gastroenterology", "ent"],
        "pediatrics": ["general physician"],
        "pulmonology": ["general physician"],
        "cardiology": ["general physician"],
        "neurology": ["general physician"]
      };
      const docRelated = relatedMap[docSpecNormalized] || [];
      const hasRelatedMatch = docRelated.some(r => matches.includes(r));
      if (hasRelatedMatch) {
        specScore = 50;
        why.push("Related clinical department");
      }
    }
  } else {
    // General match if no symptom mapped
    specScore = 100;
    why.push("Matches specialization");
  }

  // ── 2. Distance Score (20%) ──
  let distScore = 50; // Default when patient coords are missing
  let distanceKm = null;
  if (patientCoords && patientCoords.lat && patientCoords.lng && doctor.hospitalId?.location?.coordinates) {
    const [hLng, hLat] = doctor.hospitalId.location.coordinates;
    distanceKm = calculateDistance(patientCoords.lat, patientCoords.lng, hLat, hLng);
    distScore = Math.max(0, 100 - distanceKm * 2);

    if (distanceKm <= 2) {
      why.push("Very close to you");
    } else if (distanceKm <= 5) {
      why.push("Near your location");
    } else if (distanceKm <= 15) {
      why.push("Nearby hospital");
    }
  } else {
    why.push("Matches search criteria");
  }

  // ── 3. Availability Score (20%) ──
  let availScore = 0;
  if (availability) {
    if (doctor.availabilityState === "available") {
      availScore = 100;
      why.push("Available today");
    } else if (doctor.availabilityState === "break") {
      availScore = 50;
      why.push("On break - resuming soon");
    }
  }

  // ── 4. Queue Score (15%) ──
  const avgTime = doctor.avgConsultationTime || 5;
  const estWait = currentQueue * avgTime;
  const qScore = Math.max(0, 100 - estWait);

  if (currentQueue === 0) {
    why.push("Immediate turn");
  } else if (qScore >= 80) {
    why.push("Short waiting time");
  } else if (qScore >= 60) {
    why.push("Moderate waiting list");
  }

  // ── 5. Reliability Score (10%) — Trust Tier Logic ──
  let relScore = 90; // Fallback default
  const completedVisitsCount = await Queue.countDocuments({ doctorId: doctor._id, status: "completed" });
  
  let trustTier = "established";
  if (completedVisitsCount < 5) {
    trustTier = "new";
    relScore = 60;
    why.push("New practitioner");
  } else {
    const analytics = await DoctorAnalyticsDaily.find({ doctorId: doctor._id });
    if (analytics.length > 0) {
      let completed = 0;
      let skipped = 0;
      let noShow = 0;
      let cancelled = 0;
      let unique = 0;
      let returning = 0;

      for (const day of analytics) {
        completed += day.completed || 0;
        skipped += day.skipped || 0;
        noShow += day.noShow || 0;
        cancelled += day.cancelled || 0;
        unique += day.uniquePatients || 0;
        returning += day.returningPatients || 0;
      }

      const total = completed + skipped + noShow + cancelled;
      const completionRate = total > 0 ? (completed / total) * 100 : 100;
      const totalPatients = unique + returning;
      const retentionRate = totalPatients > 0 ? (returning / totalPatients) * 100 : 50;
      const healthScore = total > 0 ? (1 - skipped / total) * 100 : 100;

      relScore = 0.40 * completionRate + 0.30 * retentionRate + 0.30 * healthScore;

      // Verification boost check (+10 boost for verified, capped at 100)
      const isVerified = (doctor.rating && doctor.rating >= 4.5) || doctor.experienceYears >= 10;
      if (isVerified) {
        trustTier = "verified";
        relScore = Math.min(100, relScore + 10);
        why.push("Highly experienced");
      } else {
        why.push("Consistent reliability");
      }
    } else {
      why.push("Good track record");
    }
  }

  // Multi-signal weighted calculation
  const finalScore = Math.round(
    0.35 * specScore +
    0.20 * distScore +
    0.20 * availScore +
    0.15 * qScore +
    0.10 * relScore
  );

  return {
    score: finalScore,
    why: [...new Set(why)], // deduplicate explanations
    snapshot: {
      specializationScore: specScore,
      distanceScore: distScore,
      availabilityScore: availScore,
      queueScore: qScore,
      reliabilityScore: relScore,
      finalScore
    },
    distance: distanceKm
  };
};
