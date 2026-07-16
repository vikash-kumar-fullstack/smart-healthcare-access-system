import SymptomDictionary from "./symptom_dictionary.model.js";
import { getLevenshteinDistance } from "./utils.js";

export const normalizeQuery = (q) => {
  if (!q) return "";
  return q
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // remove special characters except spaces/hyphens
    .replace(/\s+/g, " "); // collapse multiple spaces to single
};

export const findMatchingSymptom = async (normalized) => {
  if (!normalized) return null;

  // 1. Try exact match on name
  let exact = await SymptomDictionary.findOne({ name: normalized });
  if (exact) return exact;

  // 2. Try exact match on aliases
  let aliasMatch = await SymptomDictionary.findOne({ aliases: normalized });
  if (aliasMatch) return aliasMatch;

  // 3. Fetch all entries to perform Levenshtein spelling check (Threshold <= 2 edits)
  const allSymptoms = await SymptomDictionary.find({});
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

  return null;
};
