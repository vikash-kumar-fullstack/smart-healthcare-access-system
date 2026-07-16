import SystemHealth from "./system_health.model.js";
import SystemHealthRollup from "./system_health_rollup.model.js";
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
    } catch (err) { }

    // 4. queueBacklog
    let queueBacklog = 0;
    try {
      queueBacklog = await mongoose.model("Queue").countDocuments({
        status: "waiting",
        isActive: true
      });
    } catch (err) { }

    // 5. activeSockets
    let activeSockets = 0;
    try {
      const io = getIo();
      activeSockets = io.sockets.sockets.size || io.engine.clientsCount || 0;
    } catch (err) { }

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
    } catch (err) { }

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

export const generateSystemHealthRollups = async () => {
  const rawLogs = await SystemHealth.find({});
  if (rawLogs.length === 0) return;

  const dailyGroups = {};
  const weeklyGroups = {};
  const monthlyGroups = {};

  const getWeekString = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const sunday = new Date(d.setDate(diff));
    const year = sunday.getFullYear();
    const month = String(sunday.getMonth() + 1).padStart(2, "0");
    const dateVal = String(sunday.getDate()).padStart(2, "0");
    return `W-${year}-${month}-${dateVal}`;
  };

  const getDayString = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const dateVal = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${dateVal}`;
  };

  const getMonthString = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  };

  const addRecordToGroup = (group, key, record) => {
    if (!group[key]) {
      group[key] = {
        dbLatency: 0,
        searchP95: 0,
        notificationBacklog: 0,
        queueBacklog: 0,
        activeSockets: 0,
        errorRate: 0,
        cacheHitRate: 0,
        count: 0
      };
    }
    const g = group[key];
    g.dbLatency += record.dbLatency || 0;
    g.searchP95 += record.searchP95 || 0;
    g.notificationBacklog += record.notificationBacklog || 0;
    g.queueBacklog += record.queueBacklog || 0;
    g.activeSockets += record.activeSockets || 0;
    g.errorRate += record.errorRate || 0;
    g.cacheHitRate += record.cacheHitRate || 0;
    g.count += 1;
  };

  for (const log of rawLogs) {
    const date = log.createdAt || new Date();
    const dayKey = getDayString(date);
    const weekKey = getWeekString(date);
    const monthKey = getMonthString(date);

    addRecordToGroup(dailyGroups, dayKey, log);
    addRecordToGroup(weeklyGroups, weekKey, log);
    addRecordToGroup(monthlyGroups, monthKey, log);
  }

  const upsertRollups = async (groups, period) => {
    for (const [date, metrics] of Object.entries(groups)) {
      const recordsSampled = metrics.count;
      if (recordsSampled === 0) continue;

      await SystemHealthRollup.findOneAndUpdate(
        { period, date },
        {
          $set: {
            dbLatency: Math.round((metrics.dbLatency / recordsSampled) * 100) / 100,
            searchP95: Math.round((metrics.searchP95 / recordsSampled) * 100) / 100,
            notificationBacklog: Math.round((metrics.notificationBacklog / recordsSampled) * 100) / 100,
            queueBacklog: Math.round((metrics.queueBacklog / recordsSampled) * 100) / 100,
            activeSockets: Math.round((metrics.activeSockets / recordsSampled) * 100) / 100,
            errorRate: Math.round((metrics.errorRate / recordsSampled) * 100) / 100,
            cacheHitRate: Math.round((metrics.cacheHitRate / recordsSampled) * 100) / 100,
            recordsSampled
          }
        },
        { upsert: true, new: true }
      );
    }
  };

  await upsertRollups(dailyGroups, "daily");
  await upsertRollups(weeklyGroups, "weekly");
  await upsertRollups(monthlyGroups, "monthly");
};
