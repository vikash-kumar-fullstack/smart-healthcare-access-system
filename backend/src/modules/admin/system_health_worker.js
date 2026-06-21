import SystemHealth from "./system_health.model.js";
import mongoose from "mongoose";
import { getIo } from "../../utils/socket.js";
import { getTelemetryValues, resetTelemetryCount } from "../../middlewares/error.middleware.js";

let isHealthWorkerRunning = false;
let healthInterval = null;

export const runHealthCheck = async () => {
  if (isHealthWorkerRunning) return;
  isHealthWorkerRunning = true;

  try {
    // 1. dbLatency
    const dbStart = Date.now();
    await mongoose.connection.db.admin().ping();
    const dbLatency = Date.now() - dbStart;

    // 2. searchP95
    let searchP95 = 0;
    try {
      const sysMon = await mongoose.model("SystemMonitoring").findOne({ name: "global" });
      if (sysMon && sysMon.search_p95 !== undefined) {
        searchP95 = sysMon.search_p95;
      }
    } catch (err) {
      // Model might not be loaded yet
    }

    // 3. notificationBacklog
    let notificationBacklog = 0;
    try {
      notificationBacklog = await mongoose.model("NotificationOutbox").countDocuments({
        status: { $in: ["pending", "processing"] }
      });
    } catch (err) {}

    // 4. queueBacklog
    let queueBacklog = 0;
    try {
      queueBacklog = await mongoose.model("Queue").countDocuments({
        status: "waiting",
        isActive: true
      });
    } catch (err) {}

    // 5. activeSockets
    let activeSockets = 0;
    try {
      const io = getIo();
      activeSockets = io.sockets.sockets.size || io.engine.clientsCount || 0;
    } catch (err) {}

    // 6. errorRate (Correction 9 route error rates logic)
    const { requestCount, errorCount } = getTelemetryValues();
    const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
    resetTelemetryCount();

    // 7. cacheHitRate (from Search Monitoring Daily)
    let cacheHitRate = 0;
    try {
      const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const dailyMon = await mongoose.model("SearchMonitoringDaily").findOne({ date: todayStr });
      if (dailyMon) {
        const totalCache = (dailyMon.cacheHit || 0) + (dailyMon.cacheMiss || 0);
        cacheHitRate = totalCache > 0 ? ((dailyMon.cacheHit || 0) / totalCache) * 100 : 0;
      }
    } catch (err) {}

    await SystemHealth.create({
      dbLatency,
      searchP95,
      notificationBacklog,
      queueBacklog,
      activeSockets,
      errorRate: Math.round(errorRate * 100) / 100,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100
    });

  } catch (err) {
    console.error("Error in system health background worker:", err);
  } finally {
    isHealthWorkerRunning = false;
  }
};

export const initHealthWorker = (intervalMs = 60000) => {
  if (healthInterval) clearInterval(healthInterval);
  healthInterval = setInterval(runHealthCheck, intervalMs);
};

export const stopHealthWorker = () => {
  if (healthInterval) {
    clearInterval(healthInterval);
    healthInterval = null;
  }
};
