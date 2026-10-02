import Doctor from "../doctor/doctor.model.js";
import Hospital from "../hospital/hospital.model.js";
import SymptomDictionary from "./symptom_dictionary.model.js";
import { comprehensiveSymptomList } from "../../../scripts/seed/symptoms.seed.js";
import { getLevenshteinDistance } from "./utils.js";

/**
 * Deterministic Healthcare Query Understanding Service
 * Classifies queries into symptoms, direct specialties, doctor names, hospital names,
 * and unknown queries with explicit confidence scoring.
 * 
 * Strict Clinical Safety Constraint:
 * NEVER diagnose diseases.
 * NEVER map random unknown queries to General Medicine.
 */

export const KNOWN_SPECIALTIES = {
  "general medicine": { canonical: "General Medicine", related: ["Pediatrics", "Pulmonology", "Gastroenterology"] },
  "general physician": { canonical: "General Medicine", related: ["Pediatrics", "Pulmonology"] },
  "internal medicine": { canonical: "General Medicine", related: ["Cardiology", "Endocrinology"] },
  "family medicine": { canonical: "General Medicine", related: ["Pediatrics"] },
  "neurology": { canonical: "Neurology", related: ["General Medicine", "Psychiatry"] },
  "neuro": { canonical: "Neurology", related: ["General Medicine", "Psychiatry"] },
  "cardiology": { canonical: "Cardiology", related: ["General Medicine", "Emergency Care"] },
  "cardio": { canonical: "Cardiology", related: ["General Medicine", "Emergency Care"] },
  "dermatology": { canonical: "Dermatology", related: ["General Medicine", "Allergy & Immunology"] },
  "derma": { canonical: "Dermatology", related: ["General Medicine"] },
  "orthopedics": { canonical: "Orthopedics", related: ["General Medicine", "Physical Therapy"] },
  "ortho": { canonical: "Orthopedics", related: ["General Medicine", "Physical Therapy"] },
  "ent": { canonical: "ENT", related: ["General Medicine", "Pediatrics"] },
  "ear nose throat": { canonical: "ENT", related: ["General Medicine", "Pediatrics"] },
  "otolaryngology": { canonical: "ENT", related: ["General Medicine", "Pediatrics"] },
  "pediatrics": { canonical: "Pediatrics", related: ["General Medicine"] },
  "pedia": { canonical: "Pediatrics", related: ["General Medicine"] },
  "child care": { canonical: "Pediatrics", related: ["General Medicine"] },
  "gastroenterology": { canonical: "Gastroenterology", related: ["General Medicine"] },
  "gastro": { canonical: "Gastroenterology", related: ["General Medicine"] },
  "pulmonology": { canonical: "Pulmonology", related: ["General Medicine", "Cardiology"] },
  "respiratory": { canonical: "Pulmonology", related: ["General Medicine"] },
  "ophthalmology": { canonical: "Ophthalmology", related: ["General Medicine", "ENT"] },
  "eye care": { canonical: "Ophthalmology", related: ["General Medicine"] },
  "psychiatry": { canonical: "Psychiatry", related: ["General Medicine", "Neurology"] },
  "mental health": { canonical: "Psychiatry", related: ["General Medicine"] },
  "gynecology": { canonical: "Gynecology", related: ["General Medicine", "Obstetrics"] },
  "obstetrics": { canonical: "Gynecology", related: ["General Medicine"] },
  "urology": { canonical: "Urology", related: ["General Medicine"] },
  "endocrinology": { canonical: "Endocrinology", related: ["General Medicine"] }
};

export const ACUTE_EMERGENCY_TRIGGERS = [
  "chest pain",
  "heart attack",
  "angina",
  "difficulty breathing",
  "shortness of breath",
  "breathless",
  "severe bleeding",
  "unconscious",
  "fainting",
  "stroke",
  "paralysis",
  "seizure",
  "choking"
];

export const normalizeQuery = (q) => {
  if (!q) return "";
  return q
    .toLowerCase()
    .trim()
    .replace(/[-&+/]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
};

/**
 * Understands and classifies the patient query
 * @param {string} rawQuery 
 * @returns {Promise<Object>}
 */
export const understandQuery = async (rawQuery) => {
  const normalized = normalizeQuery(rawQuery);
  if (!normalized) {
    return {
      queryType: "empty",
      normalizedQuery: "",
      rawQuery: rawQuery || "",
      confidence: "LOW",
      confidenceScore: 0,
      matchMethod: "empty",
      isKnownHealthcareQuery: false,
      isEmergency: false,
      candidateSpecialties: [],
      relatedSpecialties: [],
      matchedSymptoms: [],
      explanationMessage: "Please enter a symptom, medical specialty, doctor name, or hospital.",
      suggestedActions: [
        "Search by symptom (e.g. fever, headache, cough)",
        "Search by specialty (e.g. Cardiology, Neurology)",
        "Search by hospital (e.g. AIIMS, Apollo, Fortis)"
      ]
    };
  }

  // 1. Check emergency red-flags
  const isEmergency = ACUTE_EMERGENCY_TRIGGERS.some(trigger => normalized.includes(trigger));
  const emergencyMessage = isEmergency
    ? "Your search term indicates a potential acute medical situation. If you or someone with you requires urgent emergency care, please contact emergency services (108/112) or proceed to the nearest emergency room immediately."
    : null;

  // 2. Direct Specialty match
  if (KNOWN_SPECIALTIES[normalized]) {
    const specInfo = KNOWN_SPECIALTIES[normalized];
    return {
      queryType: "specialty",
      normalizedQuery: normalized,
      rawQuery,
      confidence: "HIGH",
      confidenceScore: 1.0,
      matchMethod: "exact_specialty",
      isKnownHealthcareQuery: true,
      isEmergency,
      emergencyMessage,
      primarySpecialty: specInfo.canonical,
      candidateSpecialties: [specInfo.canonical],
      relatedSpecialties: specInfo.related,
      matchedSymptoms: [],
      explanationMessage: `Direct search for clinical department: ${specInfo.canonical}`
    };
  }

  // Check if normalized matches any known specialty token
  for (const [key, specInfo] of Object.entries(KNOWN_SPECIALTIES)) {
    if (normalized === key || normalized === specInfo.canonical.toLowerCase()) {
      return {
        queryType: "specialty",
        normalizedQuery: normalized,
        rawQuery,
        confidence: "HIGH",
        confidenceScore: 0.95,
        matchMethod: "token_specialty",
        isKnownHealthcareQuery: true,
        isEmergency,
        emergencyMessage,
        primarySpecialty: specInfo.canonical,
        candidateSpecialties: [specInfo.canonical],
        relatedSpecialties: specInfo.related,
        matchedSymptoms: [],
        explanationMessage: `Direct search for clinical specialty: ${specInfo.canonical}`
      };
    }
  }

  // 3. Doctor Name Match Check
  const isDrPrefix = /^(dr|dr\.|doctor)\s+/i.test(rawQuery.trim());
  const strippedDrName = normalized.replace(/^(dr|doctor)\s+/i, "").trim();

  // Search if a doctor exists with this name (or partial match)
  const doctorMatch = await Doctor.findOne({
    name: new RegExp(strippedDrName || normalized, "i"),
    status: { $in: ["active", "verified", "approved"] }
  }).populate("hospitalId");

  if (doctorMatch && (isDrPrefix || strippedDrName.length >= 3)) {
    const docSpec = doctorMatch.specialization || "General Medicine";
    return {
      queryType: "doctor_name",
      normalizedQuery: normalized,
      rawQuery,
      confidence: "HIGH",
      confidenceScore: 0.95,
      matchMethod: "doctor_lookup",
      isKnownHealthcareQuery: true,
      isEmergency,
      emergencyMessage,
      targetDoctorId: doctorMatch._id.toString(),
      targetDoctorName: doctorMatch.name,
      primarySpecialty: docSpec,
      candidateSpecialties: [docSpec],
      relatedSpecialties: KNOWN_SPECIALTIES[docSpec.toLowerCase()]?.related || [],
      matchedSymptoms: [],
      explanationMessage: `Matching verified physician: Dr. ${doctorMatch.name} (${docSpec})`
    };
  }

  // 4. Hospital Name Match Check
  const hospitalMatch = await Hospital.findOne({
    name: new RegExp(normalized, "i"),
    isActive: true
  });

  if (hospitalMatch) {
    const specs = hospitalMatch.specializations || ["General Medicine"];
    return {
      queryType: "hospital_name",
      normalizedQuery: normalized,
      rawQuery,
      confidence: "HIGH",
      confidenceScore: 0.95,
      matchMethod: "hospital_lookup",
      isKnownHealthcareQuery: true,
      isEmergency,
      emergencyMessage,
      targetHospitalId: hospitalMatch._id.toString(),
      targetHospitalName: hospitalMatch.name,
      candidateSpecialties: specs,
      relatedSpecialties: [],
      matchedSymptoms: [],
      explanationMessage: `Matching registered healthcare facility: ${hospitalMatch.name}`
    };
  }

  // 5. Symptom and Condition Match
  const symptomResult = await matchSymptoms(normalized);
  if (symptomResult.found) {
    return {
      queryType: symptomResult.isMulti ? "multi_symptom" : "symptom",
      normalizedQuery: normalized,
      rawQuery,
      confidence: symptomResult.confidence,
      confidenceScore: symptomResult.confidenceScore,
      matchMethod: symptomResult.matchMethod,
      isKnownHealthcareQuery: true,
      isEmergency,
      emergencyMessage,
      matchedSymptoms: symptomResult.symptomNames,
      candidateSpecialties: symptomResult.primarySpecialties,
      relatedSpecialties: symptomResult.relatedSpecialties,
      uncertaintyMessage: symptomResult.uncertaintyMessage,
      explanationMessage: symptomResult.explanationMessage
    };
  }

  // 6. Unknown / Unrecognized Query Handling
  // DO NOT MAP UNKNOWN QUERIES TO GENERAL MEDICINE!
  return {
    queryType: "unknown",
    normalizedQuery: normalized,
    rawQuery,
    confidence: "LOW",
    confidenceScore: 0.1,
    matchMethod: "unmatched",
    isKnownHealthcareQuery: false,
    isEmergency,
    emergencyMessage,
    candidateSpecialties: [],
    relatedSpecialties: [],
    matchedSymptoms: [],
    explanationMessage: "Unable to confidently map this search to a healthcare specialty.",
    suggestedActions: [
      "Search by specialty (e.g. Cardiology, Neurology, Pediatrics, Orthopedics)",
      "Search by doctor (e.g. Dr. Patel, Dr. Nair, Dr. Sharma)",
      "Search by hospital (e.g. AIIMS Delhi, Apollo, Fortis)",
      "Try another symptom (e.g. fever, headache, cough, skin rash, joint pain)",
      "Browse available specialties from the clinic menu"
    ]
  };
};

/**
 * Internal symptom matching with confidence scoring
 */
async function matchSymptoms(normalized) {
  // Try DB first, fallback to comprehensiveSymptomList
  let allSymptoms = [];
  try {
    allSymptoms = await SymptomDictionary.find({}).lean();
  } catch (e) {
    console.error("DB symptom lookup failed:", e.message);
  }
  const sourceList = (allSymptoms && allSymptoms.length > 0) ? allSymptoms : comprehensiveSymptomList;

  // A. Exact Name Match
  for (const s of sourceList) {
    if (s.name.toLowerCase() === normalized) {
      const specs = formatSpecialties(s.specializationIds);
      return {
        found: true,
        isMulti: false,
        confidence: "HIGH",
        confidenceScore: 1.0,
        matchMethod: "exact_symptom",
        symptomNames: [s.name],
        primarySpecialties: specs,
        relatedSpecialties: getRelatedSpecialties(specs),
        explanationMessage: `Direct match for clinical symptom: ${s.name}`
      };
    }
  }

  // B. Exact Alias Match
  for (const s of sourceList) {
    if (s.aliases && s.aliases.some(a => a.toLowerCase() === normalized)) {
      const specs = formatSpecialties(s.specializationIds);
      return {
        found: true,
        isMulti: false,
        confidence: "HIGH",
        confidenceScore: 0.95,
        matchMethod: "alias_symptom",
        symptomNames: [s.name],
        primarySpecialties: specs,
        relatedSpecialties: getRelatedSpecialties(specs),
        explanationMessage: `Matched common clinical term "${normalized}" to ${s.name}`
      };
    }
  }

  // C. Multi-Symptom Matching (e.g., "fever and headache", "cough & cold")
  const stopWords = new Set(["and", "the", "with", "for", "have", "has", "feeling", "very", "severe", "mild", "bad", "acute", "chronic", "in", "my"]);
  const tokens = normalized.split(/\s+/).filter(t => t.length >= 3 && !stopWords.has(t));

  const multiMatches = [];
  for (const s of sourceList) {
    const sName = s.name.toLowerCase();
    const wordRegex = new RegExp(`(^|\\s)${sName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, "i");
    if (wordRegex.test(normalized)) {
      multiMatches.push(s);
    } else if (s.aliases && s.aliases.some(a => {
      const aLower = a.toLowerCase();
      return aLower.length >= 4 && new RegExp(`(^|\\s)${aLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, "i").test(normalized);
    })) {
      multiMatches.push(s);
    }
  }

  // Deduplicate matched symptoms by name
  const uniqueMulti = Array.from(new Map(multiMatches.map(m => [m.name, m])).values());
  if (uniqueMulti.length >= 2) {
    const mergedSpecs = new Set();
    uniqueMulti.forEach(m => formatSpecialties(m.specializationIds).forEach(spec => mergedSpecs.add(spec)));
    const primarySpecs = Array.from(mergedSpecs);
    return {
      found: true,
      isMulti: true,
      confidence: "HIGH",
      confidenceScore: 0.90,
      matchMethod: "multi_symptom",
      symptomNames: uniqueMulti.map(m => m.name),
      primarySpecialties: primarySpecs,
      relatedSpecialties: getRelatedSpecialties(primarySpecs),
      explanationMessage: `Composite care pathway addressing: ${uniqueMulti.map(m => m.name).join(" & ")}`
    };
  } else if (uniqueMulti.length === 1) {
    const s = uniqueMulti[0];
    const specs = formatSpecialties(s.specializationIds);
    return {
      found: true,
      isMulti: false,
      confidence: "HIGH",
      confidenceScore: 0.90,
      matchMethod: "token_symptom_in_phrase",
      symptomNames: [s.name],
      primarySpecialties: specs,
      relatedSpecialties: getRelatedSpecialties(specs),
      explanationMessage: `Identified symptom "${s.name}" within search query`
    };
  }

  // D. Word Token Matching for compound symptoms (e.g., "joint pain", "skin rash")
  let bestCandidate = null;
  let highestScore = 0;

  for (const s of sourceList) {
    const sNameTokens = s.name.toLowerCase().split(/\s+/);
    let score = 0;
    for (const t of tokens) {
      if (sNameTokens.includes(t)) {
        score += 50;
      }
      if (s.aliases) {
        for (const a of s.aliases) {
          const aTokens = a.toLowerCase().split(/\s+/);
          if (aTokens.includes(t)) score += 40;
        }
      }
    }
    if (score > highestScore) {
      highestScore = score;
      bestCandidate = s;
    }
  }

  if (bestCandidate && highestScore >= 50) {
    const specs = formatSpecialties(bestCandidate.specializationIds);
    return {
      found: true,
      isMulti: false,
      confidence: highestScore >= 80 ? "HIGH" : "MEDIUM",
      confidenceScore: highestScore >= 80 ? 0.85 : 0.65,
      matchMethod: "token_overlap",
      symptomNames: [bestCandidate.name],
      primarySpecialties: specs,
      relatedSpecialties: getRelatedSpecialties(specs),
      uncertaintyMessage: highestScore < 80 ? `Mapped likely care pathway for ${bestCandidate.name} with moderate confidence.` : null,
      explanationMessage: `Relevant clinical specialty for ${bestCandidate.name}`
    };
  }

  // E. Levenshtein Distance Check (spelling corrections for queries >= 4 chars)
  if (normalized.length >= 4) {
    for (const s of sourceList) {
      if (getLevenshteinDistance(normalized, s.name.toLowerCase()) <= 2) {
        const specs = formatSpecialties(s.specializationIds);
        return {
          found: true,
          isMulti: false,
          confidence: "MEDIUM",
          confidenceScore: 0.70,
          matchMethod: "fuzzy_spelling",
          symptomNames: [s.name],
          primarySpecialties: specs,
          relatedSpecialties: getRelatedSpecialties(specs),
          uncertaintyMessage: `Interpreted "${rawQuery}" as likely referring to "${s.name}".`,
          explanationMessage: `Fuzzy clinical match for "${s.name}"`
        };
      }
      if (s.aliases) {
        for (const a of s.aliases) {
          if (getLevenshteinDistance(normalized, a.toLowerCase()) <= 2) {
            const specs = formatSpecialties(s.specializationIds);
            return {
              found: true,
              isMulti: false,
              confidence: "MEDIUM",
              confidenceScore: 0.65,
              matchMethod: "fuzzy_alias_spelling",
              symptomNames: [s.name],
              primarySpecialties: specs,
              relatedSpecialties: getRelatedSpecialties(specs),
              uncertaintyMessage: `Interpreted "${rawQuery}" as likely referring to "${a}".`,
              explanationMessage: `Fuzzy clinical match for "${s.name}"`
            };
          }
        }
      }
    }
  }

  return { found: false };
}

function formatSpecialties(specIds) {
  if (!specIds || specIds.length === 0) return ["General Medicine"];
  return specIds.map(spec => {
    return spec
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  });
}

function getRelatedSpecialties(primarySpecs) {
  const related = new Set();
  primarySpecs.forEach(p => {
    const key = p.toLowerCase();
    const info = KNOWN_SPECIALTIES[key];
    if (info && info.related) {
      info.related.forEach(r => related.add(r));
    }
  });
  primarySpecs.forEach(p => related.delete(p));
  return Array.from(related);
}
