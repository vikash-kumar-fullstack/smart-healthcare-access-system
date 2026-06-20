import express from "express";
import {
  getPatientVisits,
  getPatientVisitDetail,
  getPatientVisitTimeline,
  getPatientVisitSummary,
  getDoctorVisits,
  startVisit,
  completeVisit,
  editVisitSummary
} from "./visit.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/authorize.middleware.js";
import { ensureDoctorActive } from "../../middlewares/ensureDoctorActive.middleware.js";

const router = express.Router();

// ── Patient list endpoint ───────────────────────────────────────────────────
router.get("/", authMiddleware, authorizeRoles("patient"), getPatientVisits);

// ── Doctor list endpoint ─────────────────────────────────────────────────────
router.get("/doctor", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, getDoctorVisits);

// ── Shared detail endpoints ──────────────────────────────────────────────────
router.get("/:id", authMiddleware, getPatientVisitDetail);
router.get("/:id/summary", authMiddleware, getPatientVisitSummary);
router.get("/:id/timeline", authMiddleware, getPatientVisitTimeline);

// ── Doctor consultation execution endpoints ──────────────────────────────────
router.patch("/:id/start", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, startVisit);
router.patch("/:id/complete", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, completeVisit);
router.patch("/:id/summary", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, editVisitSummary);

export default router;
