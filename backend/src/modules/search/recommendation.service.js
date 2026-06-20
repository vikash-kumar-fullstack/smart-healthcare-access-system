import Queue from "../queue/queue.model.js";

export const evaluateRecommendation = async (userId, doctor, distanceKm, isSymptomMatch) => {
  // If no logged in user, cannot match history
  if (!userId) {
    // Proximity fallback
    return isSymptomMatch && distanceKm !== null && distanceKm <= 5;
  }

  // 1. History Rule: Check if patient successfully consulted this doctor before
  const visitedBefore = await Queue.exists({
    userId,
    doctorId: doctor._id,
    status: "completed"
  });

  if (visitedBefore) {
    return true;
  }

  // 2. Proximity & Symptom Match Rule: within 5km and matches symptoms
  if (isSymptomMatch && distanceKm !== null && distanceKm <= 5) {
    return true;
  }

  return false;
};
