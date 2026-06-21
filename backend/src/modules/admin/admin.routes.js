import express from "express";
import {
  dashboard,
  refreshDashboard,
  getHospitals,
  getHospitalById,
  updateHospital,
  suspendHospital,
  reopenHospital,
  archiveHospital,
  getDoctors,
  approveDoctor,
  verifyDoctor,
  suspendDoctor,
  resetDoctor,
  getQueues,
  forceCloseQueue,
  forceReopenQueue,
  emergencyPauseQueue,
  reassignPatient,
  triggerReport,
  getReports,
  getReportById,
  getSystemHealth,
  getAdminAudits,
  getEmergencyState,
  updateEmergencyStateField,
  getSessions,
  logoutAll
} from "./admin.controller.js";
import { adminRetry } from "../notification/notification.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { adminMiddleware, requirePermission } from "../../middlewares/admin.middleware.js";

const router = express.Router();

// Request tracing middleware (Lock 3)
router.use((req, res, next) => {
  req.requestId = req.headers["x-request-id"] || `req-${Math.random().toString(36).substring(2, 15)}`;
  next();
});

// General Admin Routes (Require Admin Auth)
router.get("/dashboard", authMiddleware, adminMiddleware, dashboard);
router.post("/dashboard/refresh", authMiddleware, adminMiddleware, refreshDashboard);
router.post("/retry", authMiddleware, adminMiddleware, adminRetry);
router.get("/sessions", authMiddleware, adminMiddleware, getSessions);
router.post("/logout-all", authMiddleware, adminMiddleware, logoutAll);
router.get("/audits", authMiddleware, adminMiddleware, getAdminAudits);
router.get("/health", authMiddleware, adminMiddleware, getSystemHealth);

// Hospitals (Requires "hospitals" permission)
router.get("/hospitals", authMiddleware, requirePermission("hospitals"), getHospitals);
router.get("/hospitals/:id", authMiddleware, requirePermission("hospitals"), getHospitalById);
router.patch("/hospitals/:id", authMiddleware, requirePermission("hospitals"), updateHospital);
router.patch("/hospitals/:id/suspend", authMiddleware, requirePermission("hospitals"), suspendHospital);
router.patch("/hospitals/:id/reopen", authMiddleware, requirePermission("hospitals"), reopenHospital);
router.patch("/hospitals/:id/archive", authMiddleware, requirePermission("hospitals"), archiveHospital);

// Doctors (Requires "doctors" permission)
router.get("/doctors", authMiddleware, requirePermission("doctors"), getDoctors);
router.patch("/doctors/:id/approve", authMiddleware, requirePermission("doctors"), approveDoctor);
router.patch("/doctors/:id/verify", authMiddleware, requirePermission("doctors"), verifyDoctor);
router.patch("/doctors/:id/suspend", authMiddleware, requirePermission("doctors"), suspendDoctor);
router.patch("/doctors/:id/reset", authMiddleware, requirePermission("doctors"), resetDoctor);

// Queues (Requires "local queues" permission)
router.get("/queues", authMiddleware, requirePermission("local queues"), getQueues);
router.patch("/queues/:id/close", authMiddleware, requirePermission("local queues"), forceCloseQueue);
router.patch("/queues/:id/reopen", authMiddleware, requirePermission("local queues"), forceReopenQueue);
router.patch("/queues/:id/pause", authMiddleware, requirePermission("local queues"), emergencyPauseQueue);
router.patch("/queues/reassign", authMiddleware, requirePermission("local queues"), reassignPatient);

// Reports (Requires "reports" permission)
router.post("/reports", authMiddleware, requirePermission("reports"), triggerReport);
router.get("/reports", authMiddleware, requirePermission("reports"), getReports);
router.get("/reports/:id", authMiddleware, requirePermission("reports"), getReportById);

// Emergency Controls (Require adminMiddleware / admin role)
router.get("/emergency", authMiddleware, adminMiddleware, getEmergencyState);
router.patch("/emergency/pause-bookings", authMiddleware, adminMiddleware, updateEmergencyStateField("pauseBookings"));
router.patch("/emergency/readonly", authMiddleware, adminMiddleware, updateEmergencyStateField("readonly"));
router.patch("/emergency/maintenance", authMiddleware, adminMiddleware, updateEmergencyStateField("maintenance"));

export default router;