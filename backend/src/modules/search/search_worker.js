import SearchOutbox from "./search_outbox.model.js";
import SearchAnalyticsDaily from "./search_analytics_daily.model.js";
import SearchMonitoringDaily from "./search_monitoring_daily.model.js";
import mongoose from "mongoose";

const WORKER_ID = `search_worker_${Math.random().toString(36).substring(2, 11)}`;
let isSearchDispatcherRunning = false;
let isRollupRunning = false;

// Helper to recalculate rates on SearchAnalyticsDaily doc
const recalculateRates = async (date, scope) => {
  const doc = await SearchAnalyticsDaily.findOne({ date, scope });
  if (doc) {
    doc.ctr = doc.searches > 0 ? (doc.clicks / doc.searches) * 100 : 0;
    doc.conversionRate = doc.searches > 0 ? (doc.bookings / doc.searches) * 100 : 0;
    await doc.save();
  }
};

export const searchOutboxDispatcher = async () => {
  if (isSearchDispatcherRunning) return;
  isSearchDispatcherRunning = true;

  try {
    // 1. Recover stuck outbox claims
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await SearchOutbox.updateMany(
      { status: "processing", lockedAt: { $lt: fiveMinutesAgo } },
      { $set: { status: "pending", lockedAt: null } }
    );

    // 2. Query pending items
    const pending = await SearchOutbox.find({
      status: "pending",
      nextRetryAt: { $lte: new Date() }
    }).sort({ createdAt: 1 });

    for (const item of pending) {
      // Atomic claim check
      const outbox = await SearchOutbox.findOneAndUpdate(
        { _id: item._id, status: "pending" },
        { status: "processing", lockedAt: new Date() },
        { new: true }
      );

      if (!outbox) continue;

      try {
        const { eventType, payload } = outbox;
        const { date, userId, query, normalizedQuery } = payload;

        if (eventType === "SEARCH_EXECUTED") {
          // Increment Searches in Daily Analytics
          await SearchAnalyticsDaily.updateOne(
            { date, scope: "global" },
            { $inc: { searches: 1 } },
            { upsert: true }
          );
          await recalculateRates(date, "global");

          if (normalizedQuery) {
            const queryScope = `symptom_${normalizedQuery}`;
            await SearchAnalyticsDaily.updateOne(
              { date, scope: queryScope },
              { $inc: { searches: 1 } },
              { upsert: true }
            );
            await recalculateRates(date, queryScope);
          }

          // Push to daily monitoring latency buckets
          const emptySearch = payload.resultsCount === 0 ? 1 : 0;
          const hit = payload.cacheHit ? 1 : 0;
          const miss = payload.cacheHit ? 0 : 1;
          const isDegraded = payload.mode === "degraded" ? 1 : 0;
          const isSuccess = payload.mode !== "fallback" ? 1 : 0;
          const isFailure = payload.mode === "fallback" ? 1 : 0;

          await SearchMonitoringDaily.updateOne(
            { date, scope: "global" },
            {
              $push: { latencyBuckets: payload.latency },
              $inc: {
                cacheHit: hit,
                cacheMiss: miss,
                emptySearch,
                degradedCount: isDegraded,
                successCount: isSuccess,
                failureCount: isFailure
              }
            },
            { upsert: true }
          );

        } else if (eventType === "SEARCH_CLICKED") {
          // Increment click conversion
          await SearchAnalyticsDaily.updateOne(
            { date, scope: "global" },
            { $inc: { clicks: 1 } },
            { upsert: true }
          );
          await recalculateRates(date, "global");

          if (normalizedQuery) {
            const queryScope = `symptom_${normalizedQuery}`;
            await SearchAnalyticsDaily.updateOne(
              { date, scope: queryScope },
              { $inc: { clicks: 1 } },
              { upsert: true }
            );
            await recalculateRates(date, queryScope);
          }

        } else if (eventType === "SEARCH_BOOKED") {
          // Increment booking conversion
          await SearchAnalyticsDaily.updateOne(
            { date, scope: "global" },
            { $inc: { bookings: 1 } },
            { upsert: true }
          );
          await recalculateRates(date, "global");

          if (normalizedQuery) {
            const queryScope = `symptom_${normalizedQuery}`;
            await SearchAnalyticsDaily.updateOne(
              { date, scope: queryScope },
              { $inc: { bookings: 1 } },
              { upsert: true }
            );
            await recalculateRates(date, queryScope);
          }
        }

        outbox.status = "processed";
        await outbox.save();
      } catch (err) {
        console.error("Failed to process search outbox item:", err);
        outbox.status = "failed";
        outbox.attempts += 1;
        outbox.nextRetryAt = new Date(Date.now() + 60000); // retry in 1m
        await outbox.save();
      }
    }
  } catch (err) {
    console.error("Error in search outbox dispatcher:", err);
  } finally {
    isSearchDispatcherRunning = false;
  }
};

// Nightly search rollup job for computing correct percentiles (LOCK 27)
export const nightlySearchRollupWorker = async () => {
  if (isRollupRunning) return;
  isRollupRunning = true;

  try {
    const monitoringDays = await SearchMonitoringDaily.find({});
    for (const day of monitoringDays) {
      const buckets = day.latencyBuckets || [];
      if (buckets.length === 0) continue;

      // Sort latency buckets to calculate percentiles (Freeze Correction 2)
      const sorted = [...buckets].sort((a, b) => a - b);
      const len = sorted.length;

      const p50Idx = Math.floor(len * 0.50);
      const p95Idx = Math.min(len - 1, Math.floor(len * 0.95));
      const p99Idx = Math.min(len - 1, Math.floor(len * 0.99));

      day.latencyP50 = sorted[p50Idx] || 0;
      day.latencyP95 = sorted[p95Idx] || 0;
      day.latencyP99 = sorted[p99Idx] || 0;
      
      // Growth control: clear buckets (Rule 5)
      day.latencyBuckets = [];
      await day.save();

      // SLO calculation and update to global system monitoring (Rule 10)
      const total = (day.successCount || 0) + (day.failureCount || 0);
      const successRate = total > 0 ? ((day.successCount || 0) / total) * 100 : 100;
      const degradedRate = total > 0 ? ((day.degradedCount || 0) / total) * 100 : 0;
      const cacheTotal = (day.cacheHit || 0) + (day.cacheMiss || 0);
      const cacheHitRate = cacheTotal > 0 ? ((day.cacheHit || 0) / cacheTotal) * 100 : 0;

      const SystemMonitoring = mongoose.model("SystemMonitoring");
      await SystemMonitoring.findOneAndUpdate(
        { name: "global" },
        {
          $set: {
            search_success_rate: successRate,
            search_p95: day.latencyP95,
            degraded_mode_rate: degradedRate,
            cache_hit_rate: cacheHitRate
          }
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.error("Error in nightly search rollup worker:", err);
  } finally {
    isRollupRunning = false;
  }
};

let searchWorkerIntervals = [];
export const initSearchWorkers = (intervalMs = 500) => {
  searchWorkerIntervals.forEach(clearInterval);
  searchWorkerIntervals = [];

  searchWorkerIntervals.push(setInterval(searchOutboxDispatcher, intervalMs));
  // Rollup runs slightly slower (every 5 seconds for simulation in smoke tests)
  searchWorkerIntervals.push(setInterval(nightlySearchRollupWorker, 5000));
};

export const stopSearchWorkers = () => {
  searchWorkerIntervals.forEach(clearInterval);
  searchWorkerIntervals = [];
};
