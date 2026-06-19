import mongoose from "mongoose";
import Visit from "./visit.model.js";
import VisitTimeline from "./visit_timeline.model.js";
import VisitSummary from "./visit_summary.model.js";
import {
  createVisit,
  startConsultation,
  completeConsultation,
  updateSummary
} from "./visit.service.js";
import { successResponse, errorResponse } from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";

// ── GET PATIENT VISITS (Cursor Paginated) ────────────────────────────────────
export const getPatientVisits = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const cursor = req.query.cursor;
  
  const query = { patientId: req.user.userId, deletedAt: null };
  
  if (req.query.status) query.status = req.query.status;
  if (req.query.doctor) query.doctorId = req.query.doctor;
  if (req.query.date) query.bookingDate = req.query.date;

  if (cursor) {
    try {
      const [cursorTime, cursorId] = Buffer.from(cursor, "base64").toString("ascii").split("_");
      if (cursorTime && cursorId) {
        query.$or = [
          { createdAt: { $lt: new Date(cursorTime) } },
          { createdAt: new Date(cursorTime), _id: { $lt: new mongoose.Types.ObjectId(cursorId) } }
        ];
      }
    } catch (e) {
      return errorResponse(res, "Invalid pagination cursor", 400);
    }
  }

  const visits = await Visit.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1);

  const hasMore = visits.length > limit;
  let nextCursor = null;
  if (hasMore) {
    visits.pop();
  }
  if (visits.length > 0) {
    const nextItem = visits[visits.length - 1];
    nextCursor = Buffer.from(`${nextItem.createdAt.toISOString()}_${nextItem._id}`).toString("base64");
  }

  return successResponse(res, { visits, nextCursor, hasMore }, "Patient visits retrieved");
});

// ── GET PATIENT VISIT DETAIL (No Timeline) ───────────────────────────────────
export const getPatientVisitDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const visit = await Visit.findOne({ _id: id, patientId: req.user.userId, deletedAt: null });
  if (!visit) {
    return errorResponse(res, "Visit not found", 404);
  }

  const activeSummary = await VisitSummary.findOne({ visitId: visit._id, summaryStatus: "active", deletedAt: null });

  return successResponse(res, { visit, summary: activeSummary }, "Visit details retrieved");
});

// ── GET PATIENT VISIT TIMELINE ───────────────────────────────────────────────
export const getPatientVisitTimeline = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Verify access first
  const visit = await Visit.findOne({ 
    _id: id, 
    $or: [{ patientId: req.user.userId }, { doctorId: req.doctor?._id || new mongoose.Types.ObjectId() }],
    deletedAt: null 
  });
  
  if (!visit && req.user.role !== "doctor") {
    // If not matching patient, block
    return errorResponse(res, "Visit not found", 404);
  }

  const timeline = await VisitTimeline.find({ visitId: id, deletedAt: null }).sort({ sequence: 1 });
  return successResponse(res, { timeline }, "Visit timeline retrieved");
});

// ── GET DOCTOR VISITS (Cursor Paginated) ─────────────────────────────────────
export const getDoctorVisits = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const cursor = req.query.cursor;
  
  const query = { doctorId: req.doctor._id, deletedAt: null };
  
  if (req.query.status) query.status = req.query.status;
  if (req.query.patient) query.patientId = req.query.patient;
  if (req.query.date) query.bookingDate = req.query.date;

  if (cursor) {
    try {
      const [cursorTime, cursorId] = Buffer.from(cursor, "base64").toString("ascii").split("_");
      if (cursorTime && cursorId) {
        query.$or = [
          { createdAt: { $lt: new Date(cursorTime) } },
          { createdAt: new Date(cursorTime), _id: { $lt: new mongoose.Types.ObjectId(cursorId) } }
        ];
      }
    } catch (e) {
      return errorResponse(res, "Invalid pagination cursor", 400);
    }
  }

  const visits = await Visit.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1);

  const hasMore = visits.length > limit;
  let nextCursor = null;
  if (hasMore) {
    visits.pop();
  }
  if (visits.length > 0) {
    const nextItem = visits[visits.length - 1];
    nextCursor = Buffer.from(`${nextItem.createdAt.toISOString()}_${nextItem._id}`).toString("base64");
  }

  return successResponse(res, { visits, nextCursor, hasMore }, "Doctor visits retrieved");
});

// ── DOCTOR START CONSULTATION ────────────────────────────────────────────────
export const startVisit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();
  try {
    const visit = await startConsultation(id, req.user.userId, mongooseSession);
    await mongooseSession.commitTransaction();
    mongooseSession.endSession();
    return successResponse(res, { visit }, "Consultation started successfully");
  } catch (error) {
    await mongooseSession.abortTransaction();
    mongooseSession.endSession();
    const status = error.status || 500;
    const message = error.message || "Failed to start consultation";
    return res.status(status).json({ success: false, code: error.code || null, message });
  }
});

// ── DOCTOR COMPLETE CONSULTATION ─────────────────────────────────────────────
export const completeVisit = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { chiefComplaint, doctorNotes, consultationSummary, followUpAdvice, visitOutcome } = req.body;
  
  if (!chiefComplaint || !doctorNotes || !consultationSummary || !visitOutcome) {
    return errorResponse(res, "Required clinical details or outcome are missing", 400);
  }

  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();
  try {
    const visit = await completeConsultation(
      id,
      req.user.userId,
      { chiefComplaint, doctorNotes, consultationSummary, followUpAdvice, visitOutcome },
      mongooseSession
    );
    await mongooseSession.commitTransaction();
    mongooseSession.endSession();
    return successResponse(res, { visit }, "Consultation completed successfully");
  } catch (error) {
    await mongooseSession.abortTransaction();
    mongooseSession.endSession();
    const status = error.status || 500;
    const message = error.message || "Failed to complete consultation";
    return res.status(status).json({ success: false, message });
  }
});

// ── DOCTOR UPDATE VISIT SUMMARY (Lock 8 Versioned) ───────────────────────────
export const editVisitSummary = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { chiefComplaint, doctorNotes, consultationSummary, followUpAdvice } = req.body;

  if (!chiefComplaint || !doctorNotes || !consultationSummary) {
    return errorResponse(res, "Required clinical details are missing", 400);
  }

  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();
  try {
    const visit = await updateSummary(
      id,
      req.doctor._id,
      { chiefComplaint, doctorNotes, consultationSummary, followUpAdvice },
      mongooseSession
    );
    await mongooseSession.commitTransaction();
    mongooseSession.endSession();
    return successResponse(res, { visit }, "Visit summary updated successfully");
  } catch (error) {
    await mongooseSession.abortTransaction();
    mongooseSession.endSession();
    const status = error.status || 500;
    const message = error.message || "Failed to update summary";
    return res.status(status).json({ success: false, message });
  }
});
