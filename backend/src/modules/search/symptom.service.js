import SymptomDictionary from "./symptom_dictionary.model.js";
import { getLevenshteinDistance } from "./utils.js";
import { comprehensiveSymptomList } from "../../../scripts/seed/symptoms.seed.js";

export const normalizeQuery = (q) => {
  if (!q) return "";
  return q
    .toLowerCase()
    .trim()
    .replace(/[-&+/]/g, " ") // replace -, &, +, / with space
    .replace(/[^\w\s]/g, "") // remove other special characters
    .replace(/\s+/g, " "); // collapse multiple spaces to single
};

// Auto-seed in-memory / DB fallback helper
const ensureSymptomDatabaseSeeded = async () => {
  try {
    const count = await SymptomDictionary.countDocuments();
    if (count === 0 && comprehensiveSymptomList && comprehensiveSymptomList.length > 0) {
      console.log("Auto-seeding SymptomDictionary from memory fallback...");
      await SymptomDictionary.insertMany(comprehensiveSymptomList);
    }
  } catch (err) {
    console.error("Auto-seed symptom check failed:", err.message);
  }
};

const findInMemorySymptomMatch = (normalized) => {
  if (!normalized || !comprehensiveSymptomList) return null;

  // Exact name or alias match
  for (const item of comprehensiveSymptomList) {
    if (item.name.toLowerCase() === normalized) return item;
    if (item.aliases.some(a => a.toLowerCase() === normalized)) return item;
  }

  // Token match
  const tokens = normalized.split(/\s+/).filter(t => t.length > 2);
  for (const item of comprehensiveSymptomList) {
    const nameTokens = item.name.toLowerCase().split(/\s+/);
    for (const token of tokens) {
      if (nameTokens.includes(token)) return item;
    }
  }

  return null;
};

export const findMatchingSymptom = async (normalized) => {
  if (!normalized) return null;

  // Auto-seed if empty
  await ensureSymptomDatabaseSeeded();

  // 1. Try exact match on name
  let exact = await SymptomDictionary.findOne({ name: normalized });
  if (exact) return exact;

  // 2. Try exact match on aliases
  let aliasMatch = await SymptomDictionary.findOne({ aliases: normalized });
  if (aliasMatch) return aliasMatch;

  // Fetch all entries from DB or memory
  const allSymptoms = await SymptomDictionary.find({});
  const sourceList = (allSymptoms && allSymptoms.length > 0) ? allSymptoms : comprehensiveSymptomList;

  if (sourceList && sourceList.length > 0) {
    // 3. Exact matching within list (case-insensitive)
    for (const symptom of sourceList) {
      if (symptom.name.toLowerCase() === normalized) return symptom;
      if (symptom.aliases && symptom.aliases.some(a => a.toLowerCase() === normalized)) return symptom;
    }

    // 4. Levenshtein spelling check (Threshold <= 2 edits, for queries length >= 4)
    if (normalized.length >= 4) {
      for (const symptom of sourceList) {
        if (getLevenshteinDistance(normalized, symptom.name.toLowerCase()) <= 2) {
          return symptom;
        }
        if (symptom.aliases) {
          for (const alias of symptom.aliases) {
            if (getLevenshteinDistance(normalized, alias.toLowerCase()) <= 2) {
              return symptom;
            }
          }
        }
      }
    }

    // 5. Check if query contains multiple distinct symptoms (e.g. "fever and cough" / "fever cough")
    const stopWords = new Set(["and", "the", "with", "for", "have", "has", "feeling", "very", "severe", "mild", "bad", "acute", "chronic"]);
    const rawTokens = normalized.split(/\s+/).map(t => t.trim().toLowerCase());
    const meaningfulTokens = rawTokens.filter(t => t.length >= 3 && !stopWords.has(t));

    const matchedMultiple = [];
    for (const symptom of sourceList) {
      const sName = symptom.name.toLowerCase();
      const wordRegex = new RegExp(`(^|\\s)${sName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, "i");
      if (wordRegex.test(normalized)) {
        matchedMultiple.push(symptom);
      }
    }

    if (matchedMultiple.length === 1) {
      return matchedMultiple[0];
    } else if (matchedMultiple.length > 1) {
      // Merge specializationIds from matched symptoms
      const mergedSpecs = new Set();
      matchedMultiple.forEach(m => m.specializationIds?.forEach(s => mergedSpecs.add(s.toLowerCase())));
      return {
        _id: matchedMultiple[0]._id,
        name: matchedMultiple.map(m => m.name).join(" & "),
        specializationIds: Array.from(mergedSpecs),
        severity: matchedMultiple.some(m => m.severity === "high") ? "high" : "medium",
        tags: ["combined_symptom"]
      };
    }

    // 6. Intelligent whole-word token scoring to avoid substring collision bugs
    let bestCandidate = null;
    let highestScore = 0;

    for (const symptom of sourceList) {
      const sName = symptom.name.toLowerCase();
      let score = 0;

      for (const token of meaningfulTokens) {
        const nameTokens = sName.split(/\s+/);
        if (nameTokens.includes(token)) {
          score += 60;
        } else if (sName.startsWith(token) || sName.endsWith(token)) {
          score += 30;
        }

        if (symptom.aliases) {
          for (const alias of symptom.aliases) {
            const aLower = alias.toLowerCase();
            const aliasTokens = aLower.split(/\s+/);
            if (aliasTokens.includes(token)) {
              score += 40;
            } else if (aLower === token) {
              score += 70;
            }
          }
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = symptom;
      }
    }

    if (bestCandidate && highestScore >= 30) {
      return bestCandidate;
    }

    // 7. Prefix-Length Fuzzy Match Fallback (e.g. "heache" -> "headache")
    if (normalized.length >= 4) {
      const prefix3 = normalized.slice(0, 3);
      for (const symptom of sourceList) {
        if (symptom.name.toLowerCase().startsWith(prefix3) && Math.abs(symptom.name.length - normalized.length) <= 3) {
          return symptom;
        }
      }
    }
  }

  // 8. In-memory static dictionary fallback
  return findInMemorySymptomMatch(normalized);
};

// Explicit reviewable emergency triggers (NOT automated AI inference)
export { ACUTE_EMERGENCY_TRIGGERS } from "./query_understanding.service.js";
import { understandQuery } from "./query_understanding.service.js";

/**
 * Maps patient query to healthcare care pathways, identifying relevant specialties
 * and explicit emergency red flags without making medical diagnoses.
 * 
 * @param {string} rawQuery
 * @returns {Promise<Object>}
 */
export const getCarePathwayForQuery = async (rawQuery) => {
  const understood = await understandQuery(rawQuery);

  const pathwayTitle = understood.matchedSymptoms && understood.matchedSymptoms.length > 0
    ? `Care Pathway for: ${understood.matchedSymptoms.join(" & ")}`
    : understood.isKnownHealthcareQuery
      ? `Healthcare Navigation: ${understood.primarySpecialty || understood.candidateSpecialties?.[0] || rawQuery}`
      : `Search: "${rawQuery}"`;

  return {
    query: rawQuery,
    normalizedQuery: understood.normalizedQuery,
    queryType: understood.queryType,
    confidence: understood.confidence,
    confidenceScore: understood.confidenceScore,
    matchMethod: understood.matchMethod,
    isKnownHealthcareQuery: understood.isKnownHealthcareQuery,
    isEmergency: understood.isEmergency,
    emergencyMessage: understood.emergencyMessage,
    symptoms: understood.matchedSymptoms || [],
    primarySpecialties: understood.candidateSpecialties || [],
    relatedSpecialties: understood.relatedSpecialties || [],
    uncertaintyMessage: understood.uncertaintyMessage || null,
    explanationMessage: understood.explanationMessage,
    suggestedActions: understood.suggestedActions || [],
    pathwayTitle,
    targetDoctorId: understood.targetDoctorId || null,
    targetHospitalId: understood.targetHospitalId || null,
    disclaimer: "MediHospi is a healthcare access and decision-support system. It connects you to suitable clinical departments and operational doctors, and does not provide clinical diagnosis or treatment."
  };
};


