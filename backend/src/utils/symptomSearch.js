//this is for the search based on the nearest keyword of symptoms typed by a patient
import Fuse from "fuse.js";
import { symptomMap } from "./symptomMap.js";

const symptomList = Object.keys(symptomMap);

const fuse = new Fuse(symptomList, {
  includeScore: true,
  threshold: 0.4
});

export const findBestMatch = (input) => {
  const result = fuse.search(input);
  return result.length ? result[0].item : null;
};

export const getSuggestions = (input) => {
  return symptomList.filter(s =>
    s.startsWith(input.toLowerCase().replace(/\s+/g, "_"))
  );
};