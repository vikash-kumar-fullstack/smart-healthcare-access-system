import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse } from "../../utils/apiResponse.js";
import {
  bookQueue,
  completeQueue,
  skipQueue,
  markPatientNoShow,
  startSession,
  pauseSession,
  resumeSession,
  closeSession,
  getMyQueue,
  getDoctorQueue,
  cancelQueue,
  getQueueHistory
} from "./queue.service.js";
import Doctor from "../doctor/doctor.model.js";

// ── Helper: resolve doctor _id from logged-in user ───────────────────────────
const resolveDoctorId = async (userId) => {
  const doctor = await Doctor.findOne({ userId });
  if (!doctor) {
    const err = new Error("Doctor profile not found");
    err.status = 404;
    throw err;
  }
  if (!doctor.profileCompleted || doctor.status !== "active") {
    const err = new Error("Doctor profile is incomplete or inactive");
    err.status = 403;
    throw err;
  }
  return doctor._id;
};


// ═══════════════════════════════════════════════════════════════════════════════
//  PATIENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

export const book = asyncHandler(async (req, res) => {
  const ownerId = req.user.userId;
  const patientId = req.body.patientId || ownerId;
  const { doctorId, bookingDate, slotTime } = req.body;

  let bookedForType = "SELF";
  let relationshipId = null;

  if (patientId.toString() !== ownerId.toString()) {
    const FamilyRelationship = (await import("../user/family_relationship.model.js")).default;
    const rel = await FamilyRelationship.findOne({
      ownerId,
      relativeId: patientId
    });

    if (!rel) {
      throw Object.assign(new Error("Access denied: No family relationship found."), { status: 403 });
    }

    if (rel.status !== "ACTIVE") {
      throw Object.assign(new Error(`Booking blocked: Family member profile is ${rel.status.toLowerCase()}.`), { status: 403 });
    }

    if (rel.validUntil && rel.validUntil < new Date()) {
      rel.status = "ARCHIVED";
      rel.revocationReason = "Relationship expired";
      await rel.save();
      throw Object.assign(new Error("Booking blocked: Family relationship has expired."), { status: 403 });
    }

    relationshipId = rel._id;
    bookedForType = "FAMILY_MEMBER";
  }

  const queue = await bookQueue(patientId, doctorId, bookingDate, slotTime, ownerId, relationshipId, bookedForType);
  const message = queue.canBook ? "Booking successful" : (queue.reason || "Booking blocked");
  return successResponse(res, queue, message);
});

export const myQueue = asyncHandler(async (req, res) => {
  const data = await getMyQueue(req.user.userId);
  return successResponse(res, data, "Queue fetched");
});

export const cancel = asyncHandler(async (req, res) => {
  const result = await cancelQueue(req.user.userId);
  return successResponse(res, result, "Booking cancelled");
});

export const history = asyncHandler(async (req, res) => {
  const data = await getQueueHistory(req.user.userId, req.query);
  return successResponse(res, data, "Queue history fetched");
});


// ═══════════════════════════════════════════════════════════════════════════════
//  DOCTOR ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

export const doctorQueue = asyncHandler(async (req, res) => {
  const doctorId = await resolveDoctorId(req.user.userId);
  const data = await getDoctorQueue(doctorId);
  return successResponse(res, data, "Doctor queue fetched");
});

export const complete = asyncHandler(async (req, res) => {
  const doctorId = await resolveDoctorId(req.user.userId);
  const { queueId } = req.body;
  const result = await completeQueue(queueId, doctorId);
  return successResponse(res, result, "Queue updated");
});

export const skip = asyncHandler(async (req, res) => {
  const doctorId = await resolveDoctorId(req.user.userId);
  const { queueId } = req.body;
  const result = await skipQueue(queueId, doctorId);
  return successResponse(res, result, "Patient skipped");
});

export const noShow = asyncHandler(async (req, res) => {
  const doctorId = await resolveDoctorId(req.user.userId);
  const { queueId } = req.body;
  const result = await markPatientNoShow(queueId, doctorId);
  return successResponse(res, result, "Patient marked as no-show");
});

export const start = asyncHandler(async (req, res) => {
  const doctorId = await resolveDoctorId(req.user.userId);
  const result = await startSession(doctorId);
  return successResponse(res, result, "Session started successfully");
});

export const pause = asyncHandler(async (req, res) => {
  const doctorId = await resolveDoctorId(req.user.userId);
  const result = await pauseSession(doctorId);
  return successResponse(res, result, "Session paused");
});

export const resume = asyncHandler(async (req, res) => {
  const doctorId = await resolveDoctorId(req.user.userId);
  const result = await resumeSession(doctorId);
  return successResponse(res, result, "Session resumed");
});

export const close = asyncHandler(async (req, res) => {
  const doctorId = await resolveDoctorId(req.user.userId);
  const result = await closeSession(doctorId);
  return successResponse(res, result, "Session closed");
});
