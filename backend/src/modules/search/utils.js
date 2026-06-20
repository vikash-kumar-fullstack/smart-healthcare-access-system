import SearchVersionMeta from "./search_version_meta.model.js";

export const getTodayIST = () => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
};

export const getGlobalVersions = async () => {
  let doc = await SearchVersionMeta.findOne({ key: "global-versions" });
  if (!doc) {
    try {
      doc = await SearchVersionMeta.create({
        key: "global-versions",
        queueVersion: 1,
        availabilityVersion: 1
      });
    } catch (e) {
      // Handle potential duplicate key insertions
      doc = await SearchVersionMeta.findOne({ key: "global-versions" });
    }
  }
  return doc;
};

export const incrementQueueVersion = async () => {
  await SearchVersionMeta.updateOne(
    { key: "global-versions" },
    { $inc: { queueVersion: 1 } },
    { upsert: true }
  );
};

export const incrementAvailabilityVersion = async () => {
  await SearchVersionMeta.updateOne(
    { key: "global-versions" },
    { $inc: { availabilityVersion: 1 } },
    { upsert: true }
  );
};

export const getLevenshteinDistance = (a, b) => {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
};
