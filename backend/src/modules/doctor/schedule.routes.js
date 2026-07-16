import express from "express";
import * as scheduleController from "./schedule.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/authorize.middleware.js";

const router = express.Router();

// Public / Patient endpoints
router.get("/slots", scheduleController.getDoctorSlots);
router.get("/availability", scheduleController.getDoctorAvailability);

// Doctor only endpoints
router.post("/", authMiddleware, authorizeRoles("doctor"), scheduleController.saveScheduleDraft);
router.post("/publish", authMiddleware, authorizeRoles("doctor"), scheduleController.publishSchedule);
router.post("/break", authMiddleware, authorizeRoles("doctor"), scheduleController.createBreak);
router.post("/leave", authMiddleware, authorizeRoles("doctor"), scheduleController.requestLeave);
router.post("/session/start", authMiddleware, authorizeRoles("doctor"), scheduleController.startSession);
router.post("/session/end", authMiddleware, authorizeRoles("doctor"), scheduleController.endSession);

// Admin / Hospital Admin endpoints
router.get("/leaves", authMiddleware, authorizeRoles("admin", "hospital_admin"), scheduleController.getLeaves);
router.patch("/leave/:id/approve", authMiddleware, authorizeRoles("admin", "hospital_admin"), scheduleController.approveLeave);
router.patch("/leave/:id/reject", authMiddleware, authorizeRoles("admin", "hospital_admin"), scheduleController.rejectLeave);
router.get("/calendar", authMiddleware, authorizeRoles("admin", "hospital_admin"), scheduleController.getCalendarData);

export default router;
