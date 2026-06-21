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
import authMiddleware from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/authorize.middleware.js";
import { ensureDoctorActive } from "../../middlewares/ensureDoctorActive.middleware.js";

const router = express.Router();

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
