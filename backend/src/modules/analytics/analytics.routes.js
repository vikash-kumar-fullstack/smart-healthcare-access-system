import express from "express";
import {
  getExecutiveKPIs,
  getDrilldown,
  getBenchmarking,
  getTrends,
  scheduleReport,
  exportReport,
  getBIQueryPerformance,
  getBIExportAudit,
  clearBICache
} from "./analytics.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";

const router = express.Router();

// Secure analytics queries
router.use(authMiddleware);

router.get("/kpis", getExecutiveKPIs);
router.get("/drilldown", getDrilldown);
router.get("/benchmarking", getBenchmarking);
router.get("/trends", getTrends);
router.post("/schedule", scheduleReport);

// Post-freeze polishing routes
router.get("/export", exportReport);
router.get("/performance", getBIQueryPerformance);
router.get("/exports/audit", getBIExportAudit);
router.post("/cache/invalidate", clearBICache);

export default router;
