// Simple in-memory response cache for instant route navigation
const cache = new Map();

export const getCachedData = (key) => {
  return cache.get(key) || null;
};

export const setCachedData = (key, data) => {
  cache.set(key, data);
};

export const clearCache = () => {
  cache.clear();
};
