import express from "express";
import {
  createRecord,
  updateRecord,
  getRecord,
  getHistory,
  searchRecords,
  uploadAttachment,
  archiveRecord,
  lockRecord,
  exportRecord,
  deleteAttachment
} from "./medical_record.controller.js";

import {
  postVitals,
  saveClinicalNote,
  signNote,
  addPrescription,
  signPresc,
  postLabOrder,
  postFollowUp,
  closeConsultation,
  getPortalSummary,
  createFamilyLink,
  listFamilyLinks,
  getVisitSummaryPdf,
  postConsentGrant,
  postConsentRevoke
} from "./patient_care.controller.js";

import authMiddleware from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/authorize.middleware.js";
import { ensureDoctorActive } from "../../middlewares/ensureDoctorActive.middleware.js";

const router = express.Router();

// ── New EMR Clinical Workspace Endpoints ─────────────────────────────────────
router.post("/workspace/vitals", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, postVitals);
router.post("/workspace/note", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, saveClinicalNote);
router.post("/workspace/note/:id/sign", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, signNote);
router.post("/workspace/prescription", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, addPrescription);
router.post("/workspace/prescription/:id/sign", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, signPresc);
router.post("/workspace/labs", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, postLabOrder);
router.post("/workspace/followup", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, postFollowUp);
router.post("/workspace/visit/:id/finalize", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, closeConsultation);

// ── New Patient Portal Endpoints ─────────────────────────────────────────────
router.get("/portal/summary", authMiddleware, getPortalSummary);
router.post("/portal/family", authMiddleware, createFamilyLink);
router.get("/portal/family", authMiddleware, listFamilyLinks);
router.get("/portal/visit/:id/summary", authMiddleware, getVisitSummaryPdf);
router.post("/portal/consent", authMiddleware, postConsentGrant);
router.post("/portal/consent/revoke", authMiddleware, postConsentRevoke);

// ── Search & History Endpoints ──────────────────────────────────────────────
router.get("/history", authMiddleware, getHistory);
router.get("/search", authMiddleware, searchRecords);

// ── Creation Endpoint ────────────────────────────────────────────────────────
router.post("/", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, createRecord);

// ── Detail & Mutate Endpoints ────────────────────────────────────────────────
router.get("/:id", authMiddleware, getRecord);
router.patch("/:id", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, updateRecord);
router.post("/:id/attachments", authMiddleware, uploadAttachment);
router.delete("/:id/attachments/:storageKey", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, deleteAttachment);
router.patch("/:id/archive", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, archiveRecord);
router.patch("/:id/lock", authMiddleware, authorizeRoles("doctor"), ensureDoctorActive, lockRecord);
router.get("/:id/export", authMiddleware, exportRecord);

export default router;
