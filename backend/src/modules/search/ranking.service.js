import DoctorAnalyticsDaily from "../doctor/doctor_analytics_daily.model.js";
import Queue from "../queue/queue.model.js";
import AuditLog from "../queue/audit_log.model.js";
import { computeFahraScore } from "./fahra.service.js";

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

export const calculateRankingScore = async (
  doctor,
  patientCoords,
  symptomMatchSpecializations,
  currentQueue,
  availability,
  options = {}
) => {
  const { preference = "balanced", lastComputedAt = null, maxQueueLimit = 50 } = options;
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

  // ── 6. Hospital Operational State Volatility V_h ──
  let volatility = 1.0;
  let isVolatilityMeasured = false;
  let stateChangesCount = 0;
  try {
    if (doctor._id) {
      const oneHourAgo = new Date(Date.now() - 3600 * 1000);
      stateChangesCount = await AuditLog.countDocuments({
        doctorId: doctor._id,
        timestamp: { $gte: oneHourAgo }
      });
      if (stateChangesCount > 0) {
        // V_h = significant state changes / observation window (normalized to nominal 10 events/hour)
        volatility = Math.max(0.5, Math.min(3.0, stateChangesCount / 10.0));
        isVolatilityMeasured = true;
      }
    }
  } catch (logErr) {
    // If AuditLog is unavailable, preserve baseline
    volatility = 1.0;
    isVolatilityMeasured = false;
  }

  // ── 7. FA-HRA Research Allocation Evaluation ──
  const fahra = computeFahraScore({
    estimatedWaitMinutes: estWait,
    distanceKm,
    currentQueue,
    maxQueueLimit: doctor.defaultQueueLimit || maxQueueLimit,
    lastComputedAt,
    volatility,
    isVolatilityMeasured,
    preference
  });

  const structuredFactors = [];

  // Specialty factor
  if (specScore >= 80) {
    structuredFactors.push({ factor: "specialty", label: `Matches ${doctor.specialization}`, positive: true });
    why.push(`Specialist in ${doctor.specialization}`);
  } else if (specScore >= 40) {
    structuredFactors.push({ factor: "specialty", label: `Related specialty (${doctor.specialization})`, positive: true });
    why.push("Related clinical department");
  }

  // Availability factor
  if (availability && doctor.availabilityState === "available") {
    structuredFactors.push({ factor: "availability", label: "Currently accepting walk-ins", positive: true });
    why.push("Available today");
  } else if (availability && doctor.availabilityState === "break") {
    structuredFactors.push({ factor: "availability", label: "On clinic break - resuming shortly", positive: false });
  }

  // Waiting time factor
  if (estWait <= 15) {
    structuredFactors.push({ factor: "waitTime", label: `Estimated wait: ~${estWait} min`, positive: true });
    why.push(`Short wait (~${estWait} min)`);
  } else if (estWait <= 35) {
    structuredFactors.push({ factor: "waitTime", label: `Moderate wait: ~${estWait} min`, positive: true });
    why.push(`~${estWait} min wait`);
  } else {
    structuredFactors.push({ factor: "waitTime", label: `Current wait: ~${estWait} min`, positive: false });
  }

  // Distance factor
  if (distanceKm !== null && distanceKm !== undefined) {
    const roundedDist = Math.round(distanceKm * 10) / 10;
    if (distanceKm <= 5) {
      structuredFactors.push({ factor: "distance", label: `${roundedDist} km away (Nearby)`, positive: true });
      why.push(`${roundedDist} km away`);
    } else {
      structuredFactors.push({ factor: "distance", label: `${roundedDist} km away`, positive: true });
      why.push(`${roundedDist} km away`);
    }
  }

  // Freshness factor (plain language for patient-facing explainability)
  if (fahra.freshness.patientStatus === "fresh" || fahra.freshness.state === "live") {
    structuredFactors.push({ factor: "freshness", label: "Information updated recently", positive: true });
    why.push("Updated recently");
  } else if (fahra.freshness.patientStatus === "recent" || fahra.freshness.state === "recent") {
    structuredFactors.push({ factor: "freshness", label: `Updated ${Math.floor((fahra.freshness.ageSeconds || 0) / 60)} min ago`, positive: true });
    why.push(`Updated ${Math.floor((fahra.freshness.ageSeconds || 0) / 60)} min ago`);
  } else if (fahra.freshness.patientStatus === "aging") {
    structuredFactors.push({ factor: "freshness", label: "Information may have changed", positive: false });
    why.push("Information may have changed");
  } else {
    structuredFactors.push({ factor: "freshness", label: "Information may be outdated — please verify before visiting", positive: false });
    why.push("Information may be outdated");
  }

  // Operational verification / confidence factor
  if (fahra.confidence.isUncertain) {
    structuredFactors.push({
      factor: "confidence",
      label: "Clinic queue status may have changed — please verify before visiting",
      positive: false
    });
    why.push("Please verify status before visiting");
  } else {
    structuredFactors.push({
      factor: "confidence",
      label: "Recent clinic update confirmed",
      positive: true
    });
    why.push("Confirmed clinic status");
  }

  // Combined Research Score S(p,h) -> Suitability:
  // Balances Clinical Specialty Compatibility with Mathematical Resource Allocation Suitability
  const finalScore = Math.round(0.35 * specScore + 0.65 * fahra.suitabilityScore);

  // Available vs Unavailable signals
  const availableSignals = [
    "Specialty Compatibility",
    "Queue Session State",
    "Walk-in Availability",
    "Consultation Time",
    `Telemetry Freshness (F_h = ${fahra.freshness.freshness})`,
    `Composite Confidence (C_h = ${fahra.confidence.score})`
  ];
  const unavailableSignals = [
    "Direct Hospital Network RTT Telemetry (Baseline used)"
  ];

  if (isVolatilityMeasured) {
    availableSignals.push(`Operational State Volatility (V_h = ${volatility.toFixed(2)}, ${stateChangesCount} state changes/1h)`);
  } else {
    unavailableSignals.push("Historical State Volatility Logs (Baseline V_h = 1.0 active)");
  }

  if (distanceKm !== null && distanceKm !== undefined) {
    availableSignals.push("Patient Geolocation Distance");
  } else {
    unavailableSignals.push("Patient Geolocation (Location not provided)");
  }

  return {
    score: finalScore,
    why: [...new Set(why)], // deduplicate explanations
    explanation: {
      summary: `Recommended option based on ${preference} allocation criteria.`,
      factors: structuredFactors,
      scoreBreakdown: {
        specializationScore: specScore,
        distanceScore: distScore,
        availabilityScore: availScore,
        queueScore: qScore,
        reliabilityScore: relScore,
        fahraSuitability: fahra.suitabilityScore,
        finalScore
      },
      signals: {
        available: availableSignals,
        unavailable: unavailableSignals
      },
      confidence: fahra.confidence
    },
    snapshot: {
      specializationScore: specScore,
      distanceScore: distScore,
      availabilityScore: availScore,
      queueScore: qScore,
      reliabilityScore: relScore,
      finalScore
    },
    distance: distanceKm !== null && distanceKm !== undefined ? Math.round(distanceKm * 10) / 10 : null,
    locationProvided: distanceKm !== null && distanceKm !== undefined,
    estimatedWaitMinutes: estWait,
    fahra: {
      costScore: fahra.costScore,
      suitabilityScore: fahra.suitabilityScore,
      freshness: fahra.freshness,
      network: fahra.network,
      confidence: fahra.confidence,
      metrics: fahra.metrics,
      preferenceUsed: preference
    },
    volatility: {
      value: volatility,
      isMeasured: isVolatilityMeasured,
      stateChangesCount
    }
  };
};
