import SearchEvent from "./search_event.model.js";
import SearchAnalyticsDaily from "./search_analytics_daily.model.js";
import SearchMonitoringDaily from "./search_monitoring_daily.model.js";
import SearchOutbox from "./search_outbox.model.js";
import SymptomDictionary from "./symptom_dictionary.model.js";
import Doctor from "../doctor/doctor.model.js";
import DoctorAvailabilitySnapshot from "./doctor_availability_snapshot.model.js";
import { executeSearch } from "./search.service.js";
import { calculateRankingScore } from "./ranking.service.js";
import { normalizeQuery } from "./symptom.service.js";
import { successResponse, errorResponse } from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { getTodayIST } from "./utils.js";

// Memory-based Rate Limiter (LOCK 15)
const rateLimitMap = new Map();
const checkRateLimit = (ip) => {
  if (process.env.NODE_ENV === "test") {
    return true;
  }
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 60;

  const data = rateLimitMap.get(ip);
  if (!data || now > data.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  data.count += 1;
  if (data.count > maxRequests) {
    return false;
  }
  return true;
};

// ── GET /api/v1/search ───────────────────────────────────────────────────────
export const search = asyncHandler(async (req, res) => {
  const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
  }

  const { q, lat, lng, cursor, limit } = req.query;

  // Lock 15 Safety Rules
  if (!q || q.trim() === "") {
    return errorResponse(res, "Search query is required", 400);
  }

  const trimmed = q.trim();
  if (trimmed.length < 2 || trimmed.length > 1000) {
    return errorResponse(res, "Search query must be between 2 and 1000 characters", 400);
  }

  // Emoji only query validation
  const emojiRegex = /^[\p{Emoji}\s]+$/u;
  if (emojiRegex.test(trimmed) && !/[a-zA-Z0-9]/.test(trimmed)) {
    return errorResponse(res, "Emoji-only queries are not permitted", 400);
  }

  // Spam query validation (repetitive characters > 5 times)
  if (/(.)\1{5,}/.test(trimmed)) {
    return errorResponse(res, "Repetitive input spam detected", 400);
  }

  const userId = req.user?.userId || null;
  const parsedLat = lat ? parseFloat(lat) : null;
  const parsedLng = lng ? parseFloat(lng) : null;

  const searchResult = await executeSearch(userId, trimmed, parsedLat, parsedLng, cursor, limit);

  // Log Search Event (LOCK 6, 16, 26)
  const expiresAt = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000); // 180 days TTL
  const normalized = normalizeQuery(trimmed);

  const event = await SearchEvent.create({
    userId,
    query: trimmed,
    normalizedQuery: normalized,
    state: "searched",
    expiresAt
  });

  // Attach searchEventId to response contract
  searchResult.searchEventId = event._id.toString();

  return successResponse(res, searchResult, "Search completed successfully");
});

// Memory-based Suggestions Rate Limiter (10 requests per 10 seconds)
const suggestionRateLimitMap = new Map();
const checkSuggestionRateLimit = (ip) => {
  const now = Date.now();
  const windowMs = 10000; // 10 seconds
  const maxRequests = 10;

  const data = suggestionRateLimitMap.get(ip);
  if (!data || now > data.resetAt) {
    suggestionRateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  data.count += 1;
  if (data.count > maxRequests) {
    return false;
  }
  return true;
};

// ── GET /api/v1/search/suggestions (Bypasses ranking engine under 100ms) ───
export const getSuggestions = asyncHandler(async (req, res) => {
  const clientIp = req.ip || req.headers["x-forwarded-for"] || "127.0.0.1";
  if (!checkSuggestionRateLimit(clientIp)) {
    return res.status(429).json({ success: false, message: "Too many suggestion requests. Please try again later." });
  }

  const { q } = req.query;
  if (!q || q.trim() === "") {
    return successResponse(res, { suggestions: [] });
  }

  const prefix = q.trim().toLowerCase();

  // Timeout safety boundary of 100ms (Freeze Rule 30)
  const suggestionPromise = (async () => {
    // 1. Fetch matching prefixes from SymptomDictionary (max 8)
    const symptoms = await SymptomDictionary.find({
      $or: [
        { name: { $regex: `^${prefix}`, $options: "i" } },
        { aliases: { $regex: `^${prefix}`, $options: "i" } }
      ]
    }).limit(8);

    console.log(`[DEBUG SUGGESTIONS] prefix: "${prefix}", symptoms found:`, symptoms.map(s => ({ name: s.name, aliases: s.aliases })));

    const list = new Set();
    for (const sym of symptoms) {
      if (sym.name.startsWith(prefix)) {
        list.add(sym.name);
      }
      for (const alias of sym.aliases) {
        if (alias.startsWith(prefix)) {
          list.add(alias);
        }
      }
    }

    // 2. Fetch popular queries from past successful events
    if (list.size < 8) {
      const popular = await SearchEvent.find({
        normalizedQuery: { $regex: `^${prefix}`, $options: "i" }
      }).limit(8 - list.size);

      console.log(`[DEBUG SUGGESTIONS] popular events found:`, popular.map(p => p.normalizedQuery));

      for (const item of popular) {
        list.add(item.normalizedQuery);
      }
    }

    return Array.from(list).slice(0, 8);
  })();

  const timeoutMs = process.env.NODE_ENV === "test" ? 2000 : 100;
  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve([]), timeoutMs));

  const result = await Promise.race([suggestionPromise, timeoutPromise]);
  console.log(`[DEBUG SUGGESTIONS] final result:`, result);
  return successResponse(res, { suggestions: result });
});

// ── GET /api/v1/search/history (LOCK 6) ──────────────────────────────────────
export const getSearchHistory = asyncHandler(async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    return errorResponse(res, "Authentication required to view search history", 401);
  }

  const history = await SearchEvent.find({ userId })
    .sort({ searchedAt: -1 })
    .limit(10);

  return successResponse(res, { history }, "Search history retrieved");
});

// ── GET /api/v1/search/analytics (LOCK 11) ───────────────────────────────────
export const getSearchAnalytics = asyncHandler(async (req, res) => {
  const analytics = await SearchAnalyticsDaily.find({ scope: "global" }).sort({ date: -1 }).limit(30);
  return successResponse(res, { analytics }, "Search CTR analytics retrieved");
});

// ── POST /api/v1/search/analytics/action ─────────────────────────────────────
export const recordSearchAction = asyncHandler(async (req, res) => {
  const { searchEventId, action, doctorId } = req.body;

  if (!searchEventId || !action) {
    return errorResponse(res, "searchEventId and action are required", 400);
  }

  const event = await SearchEvent.findById(searchEventId);
  if (!event) {
    return errorResponse(res, "Search event not found", 404);
  }

  const date = getTodayIST();

  if (action === "click" && doctorId) {
    event.state = "opened";
    event.selectedDoctorId = doctorId;

    // Resolve snapshot details and score to save frozen reproducible details (LOCK 16)
    const doctor = await Doctor.findById(doctorId).populate("hospitalId");
    if (doctor) {
      const snapshot = await DoctorAvailabilitySnapshot.findOne({ doctorId });
      const currentQueue = snapshot?.currentQueue || 0;
      const specKeywords = [doctor.specialization];

      const ranking = await calculateRankingScore(
        doctor,
        null, // No coords during click log
        specKeywords,
        currentQueue,
        snapshot?.available || false
      );

      event.rankingSnapshot = {
        specializationScore: ranking.snapshot.specializationScore,
        distanceScore: ranking.snapshot.distanceScore,
        availabilityScore: ranking.snapshot.availabilityScore,
        queueScore: ranking.snapshot.queueScore,
        reliabilityScore: ranking.snapshot.reliabilityScore,
        finalScore: ranking.snapshot.finalScore,
        why: ranking.why
      };
    }

    await event.save();

    // Enqueue SEARCH_CLICKED task
    await SearchOutbox.create({
      eventType: "SEARCH_CLICKED",
      payload: {
        date,
        userId: event.userId,
        normalizedQuery: event.normalizedQuery
      }
    });

  } else if (action === "book") {
    event.state = "booked";
    event.booked = true;
    await event.save();

    // Enqueue SEARCH_BOOKED task
    await SearchOutbox.create({
      eventType: "SEARCH_BOOKED",
      payload: {
        date,
        userId: event.userId,
        normalizedQuery: event.normalizedQuery
      }
    });
  }

  return successResponse(res, null, "Search conversion logged");
});
