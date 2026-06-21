import express from "express";
import {
  book,
  complete,
  skip,
  noShow,
  start,
  pause,
  resume,
  close,
  myQueue,
  doctorQueue,
  cancel,
  history
} from "./queue.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/authorize.middleware.js";
import { bookingLimiter } from "../../middlewares/rateLimiter.middleware.js";
import { ensureDoctorActive } from "../../middlewares/ensureDoctorActive.middleware.js";

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
// bookingLimiter: 5 attempts / 10 min per user — prevents spam/race conditions
router.post("/book",    authMiddleware, authorizeRoles("patient"), checkEmergencyBooking, bookingLimiter, book);
router.get("/my",       authMiddleware, authorizeRoles("patient"), myQueue);
router.patch("/cancel", authMiddleware, authorizeRoles("patient"), cancel);
router.get("/history",  authMiddleware, authorizeRoles("patient"), history);

// ── Doctor queue view ─────────────────────────────────────────────────────────
router.get("/doctor",   authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, doctorQueue);

// ── Doctor patient actions ────────────────────────────────────────────────────
router.patch("/complete", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, complete);
router.patch("/skip",     authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, skip);
router.patch("/no-show",  authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, noShow);

// ── Doctor session lifecycle ──────────────────────────────────────────────────
router.patch("/start-session",  authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, start);
router.patch("/pause-session",  authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, pause);
router.patch("/resume-session", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, resume);
router.patch("/close-session",  authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, close);

export default router;