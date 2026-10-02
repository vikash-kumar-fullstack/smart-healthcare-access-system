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

/**
 * Formats a 24-hour "HH:mm" time string into a patient-friendly 12-hour string (e.g. "09:55 AM").
 * 
 * @param {string|null|undefined} timeStr 
 * @returns {string}
 */
export function formatTime12(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return "";
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
}

/**
 * Formats an estimated consultation window object into a readable range string.
 * e.g. { start: "10:15", end: "10:35" } -> "~10:15 AM – 10:35 AM"
 * 
 * @param {{ start: string, end: string }|null|undefined} window 
 * @returns {string|null}
 */
export function formatConsultationWindow(window) {
  if (!window || !window.start || !window.end) return null;
  const startFmt = formatTime12(window.start);
  const endFmt = formatTime12(window.end);
  if (!startFmt || !endFmt) return null;
  return `~${startFmt} – ${endFmt}`;
}

