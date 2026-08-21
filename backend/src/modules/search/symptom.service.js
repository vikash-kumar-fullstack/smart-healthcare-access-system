import SymptomDictionary from "./symptom_dictionary.model.js";
import { getLevenshteinDistance } from "./utils.js";
import { comprehensiveSymptomList } from "../../../scripts/seed/symptoms.seed.js";

export const normalizeQuery = (q) => {
  if (!q) return "";
  return q
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove special characters except spaces/hyphens
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

  // Token / Substring match
  const tokens = normalized.split(" ");
  for (const item of comprehensiveSymptomList) {
    for (const token of tokens) {
      if (token.length > 2) {
        if (item.name.toLowerCase().includes(token)) return item;
        if (item.aliases.some(a => a.toLowerCase().includes(token))) return item;
      }
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

  // 3. Fetch all entries to perform Levenshtein spelling check (Threshold <= 2 edits)
  const allSymptoms = await SymptomDictionary.find({});
  if (allSymptoms.length > 0) {
    for (const symptom of allSymptoms) {
      if (getLevenshteinDistance(normalized, symptom.name) <= 2) {
        return symptom;
      }
      for (const alias of symptom.aliases) {
        if (getLevenshteinDistance(normalized, alias) <= 2) {
          return symptom;
        }
      }
    }

    // 4. Fallback: Check word-token substring matching
    const tokens = normalized.split(" ");
    for (const symptom of allSymptoms) {
      for (const token of tokens) {
        if (token.length > 2 && symptom.name.includes(token)) {
          return symptom;
        }
        for (const alias of symptom.aliases) {
          if (token.length > 2 && alias.includes(token)) {
            return symptom;
          }
        }
      }
    }

    // 5. Prefix-Length Fuzzy Match Fallback (e.g. "heache" -> "headache")
    if (normalized.length >= 3) {
      const prefix3 = normalized.slice(0, 3);
      for (const symptom of allSymptoms) {
        if (symptom.name.startsWith(prefix3) && Math.abs(symptom.name.length - normalized.length) <= 3) {
          return symptom;
        }
        for (const alias of symptom.aliases) {
          if (alias.startsWith(prefix3) && Math.abs(alias.length - normalized.length) <= 3) {
            return symptom;
          }
        }
      }
    }
  }

  // 6. In-memory static dictionary fallback
  return findInMemorySymptomMatch(normalized);
};
