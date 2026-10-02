/**
 * Formats estimated travel time in minutes into a patient-friendly readable string.
 * 
 * Rules:
 * - If minutes < 60: "~X min"
 * - If minutes >= 60 and remaining minutes === 0: "~X hr"
 * - If minutes >= 60 and remaining minutes > 0: "~X hr Y min"
 * 
 * Examples:
 * - 45 -> "~45 min"
 * - 60 -> "~1 hr"
 * - 75 -> "~1 hr 15 min"
 * - 120 -> "~2 hr"
 * - 3253 -> "~54 hr 13 min"
 * 
 * @param {number|string|null|undefined} minutes 
 * @returns {string|null}
 */
export function formatEstimatedTravelTime(minutes) {
  if (minutes === null || minutes === undefined || isNaN(Number(minutes)) || Number(minutes) <= 0) {
    return null;
  }

  const totalMins = Math.round(Number(minutes));
  if (totalMins < 60) {
    return `~${totalMins} min`;
  }

  const hours = Math.floor(totalMins / 60);
  const remainingMins = totalMins % 60;

  if (remainingMins === 0) {
    return `~${hours} hr`;
  }

  return `~${hours} hr ${remainingMins} min`;
}
