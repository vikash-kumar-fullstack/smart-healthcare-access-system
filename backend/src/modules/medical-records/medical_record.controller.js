import * as recordService from "./medical_record.service.js";
import { successResponse, errorResponse } from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

export const createRecord = asyncHandler(async (req, res) => {
  const { patientId, chiefComplaint, doctorNotes, consultationSummary, followUpAdvice, diagnosis, medications, visibilityRules } = req.body;

  if (!patientId || !chiefComplaint || !doctorNotes || !consultationSummary) {
    return errorResponse(res, "Required clinical details or patient ID are missing", 400);
  }

  const record = await recordService.createManualRecord(req.user.userId, {
    patientId,
    chiefComplaint,
    doctorNotes,
    consultationSummary,
    followUpAdvice,
    diagnosis,
    medications,
    visibilityRules
  });

  return successResponse(res, { record }, "Medical record created successfully");
});

export const updateRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { chiefComplaint, doctorNotes, consultationSummary, followUpAdvice, diagnosis, medications, visibilityRules, expectedVersion } = req.body;

  if (!chiefComplaint || !doctorNotes || !consultationSummary) {
    return errorResponse(res, "Required clinical details are missing", 400);
  }

  try {
    const record = await recordService.updateRecord(id, req.user.userId, {
      chiefComplaint,
      doctorNotes,
      consultationSummary,
      followUpAdvice,
      diagnosis,
      medications,
      visibilityRules
    }, expectedVersion);
    return successResponse(res, { record }, "Medical record updated successfully");
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});

export const getRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const data = await recordService.getRecordDetail(id, req.user.role, req.user.userId);
    return successResponse(res, data, "Medical record details retrieved");
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});

export const getHistory = asyncHandler(async (req, res) => {
  // If doctor, they must provide patientId query param. If patient, use their own userId.
  let patientId = req.query.patientId;
  if (req.user.role === "patient" && !patientId) {
    patientId = req.user.userId;
  }

  if (!patientId) {
    return errorResponse(res, "Patient ID is required", 400);
  }

  const limit = parseInt(req.query.limit) || 10;
  const cursor = req.query.cursor;

  try {
    const data = await recordService.getPatientHistory(patientId, req.user.role, req.user.userId, limit, cursor);
    return successResponse(res, data, "Longitudinal timeline history retrieved");
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});

export const searchRecords = asyncHandler(async (req, res) => {
  try {
    const data = await recordService.searchRecords(req.user.role, req.user.userId, req.query);
    return successResponse(res, data, "Medical records search results retrieved");
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});

export const uploadAttachment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { version, storageKey, mimeType, size, fileName } = req.body;

  if (!version || !storageKey || !mimeType || !size || !fileName) {
    return errorResponse(res, "Missing required attachment metadata fields", 400);
  }

  try {
    const attachment = await recordService.addAttachment(
      id,
      parseInt(version),
      storageKey,
      mimeType,
      parseInt(size),
      fileName,
      req.user.userId
    );
    return successResponse(res, { attachment }, "Attachment registered successfully");
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});

export const archiveRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const record = await recordService.archiveRecord(id, req.user.userId, req.user.role);
    return successResponse(res, { record }, "Medical record archived successfully");
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});

export const lockRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const record = await recordService.lockRecord(id, req.user.userId, req.user.role);
    return successResponse(res, { record }, "Medical record locked successfully");
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});

export const exportRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const format = req.query.format || "json";

  try {
    const exportData = await recordService.exportRecord(id, req.user.role, req.user.userId, format);
    return successResponse(res, exportData, "Medical record export generated");
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});

export const deleteAttachment = asyncHandler(async (req, res) => {
  const { id, storageKey } = req.params;

  try {
    const attachment = await recordService.softDeleteAttachment(
      id,
      storageKey,
      req.user.userId,
      req.user.role
    );
    return successResponse(res, { attachment }, "Attachment soft-deleted successfully");
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});
