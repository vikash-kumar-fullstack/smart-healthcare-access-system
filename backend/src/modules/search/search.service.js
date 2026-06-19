import { symptomMap } from "../../utils/symptomMap.js";
import { findBestMatch, getSuggestions } from "../../utils/symptomSearch.js";
import { getDoctors } from "../doctor/doctor.service.js";

export const searchBySymptom = async (input) => {

  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  const exactMatch = symptomMap[normalized];

  if (exactMatch) {
    const doctors = await getDoctors({
      specialization: exactMatch[0]
    });

    return {
      type: "exact",
      query: normalized,
      specialization: exactMatch[0],
      doctors
    };
  }

  const bestMatch = findBestMatch(normalized);

  if (bestMatch) {
    const doctors = await getDoctors({
      specialization: symptomMap[bestMatch][0]
    });

    return {
      type: "fuzzy",
      query: normalized,
      suggestion: bestMatch,
      specialization: symptomMap[bestMatch][0],
      doctors
    };
  }

  const suggestions = getSuggestions(normalized);

  return {
    type: "suggestions",
    query: normalized,
    suggestions,
    doctors: [] 
  };
};