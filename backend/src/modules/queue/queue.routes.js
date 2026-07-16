import express from "express";
import {
  checkIn,
  receptionOverride,
  registerWalkIn,
  getReceptionDashboard,
  getDoctorTimeline,
  callNext,
  skip,
  getTimelineLogs,
  getOperationalAnalytics,
  getBookingById
} from "./appointment_orchestration.controller.js";
import {
  book,
  myQueue,
  history,
  cancel,
  doctorQueue,
  complete,
  skip as queueSkip,
  noShow,
  start,
  pause,
  resume,
  close
} from "./queue.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/authorize.middleware.js";
import { bookingRateLimiter } from "../../middlewares/rate-limit.middleware.js";
import { ensureDoctorActive } from "../../middlewares/ensureDoctorActive.middleware.js";
import ensureProfileCompleted from "../../middlewares/profile.middleware.js";

import SystemEmergencyState from "../admin/system_emergency_state.model.js";

const checkEmergencyBooking = async (req, res, next) => {
  try {
    const emergency = await SystemEmergencyState.findOne({ singletonKey: "global" });
    if (emergency && (emergency.pauseBookings || emergency.readonly || emergency.maintenance)) {
      return res.status(403).json({
        success: false,
        message: "Booking is currently disabled due to emergency controls"
      });
    }
  } catch (err) {
    console.error("Emergency booking check failed:", err);
  }
  next();
};

const router = express.Router();

// ── Patient routes ────────────────────────────────────────────────────────────
router.post("/book",    authMiddleware, ensureProfileCompleted, authorizeRoles("patient"), checkEmergencyBooking, bookingRateLimiter, book);
router.post("/checkin", authMiddleware, ensureProfileCompleted, checkIn);
router.get("/my",       authMiddleware, ensureProfileCompleted, authorizeRoles("patient"), myQueue);
router.get("/history",  authMiddleware, ensureProfileCompleted, authorizeRoles("patient"), history);
router.patch("/cancel", authMiddleware, authorizeRoles("patient"), cancel);
router.get("/timeline/:bookingId", authMiddleware, ensureProfileCompleted, getTimelineLogs);
router.get("/booking/:id", authMiddleware, ensureProfileCompleted, getBookingById);

// ── Doctor patient orchestration actions ──────────────────────────────────────
router.get("/doctor/timeline", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, getDoctorTimeline);
router.patch("/doctor/call-next", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, callNext);
router.patch("/doctor/skip-consult", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, skip);

router.get("/doctor",           authMiddleware, authorizeRoles("doctor"), doctorQueue);
router.patch("/start-session",  authMiddleware, authorizeRoles("doctor"), start);
router.patch("/pause-session",  authMiddleware, authorizeRoles("doctor"), pause);
router.patch("/resume-session", authMiddleware, authorizeRoles("doctor"), resume);
router.patch("/close-session",  authMiddleware, authorizeRoles("doctor"), close);
router.patch("/complete",       authMiddleware, authorizeRoles("doctor"), complete);
router.patch("/skip",           authMiddleware, authorizeRoles("doctor"), queueSkip);
router.patch("/no-show",        authMiddleware, authorizeRoles("doctor"), noShow);

// ── Receptionist / Admin override actions ─────────────────────────────────────
router.patch("/booking/:id/override", authMiddleware, authorizeRoles("admin", "receptionist"), receptionOverride);
router.post("/walkin", authMiddleware, authorizeRoles("admin", "receptionist"), registerWalkIn);
router.get("/reception", authMiddleware, getReceptionDashboard);
router.get("/analytics", authMiddleware, getOperationalAnalytics);

export default router;