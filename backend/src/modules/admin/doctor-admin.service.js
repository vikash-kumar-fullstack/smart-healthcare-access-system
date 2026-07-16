import Doctor from "../doctor/doctor.model.js";
import { logAdminAudit, logAdminAction, getAdminActionByKey } from "./admin.service.js";
import { createNotification } from "../notification/notification.service.js";
import mongoose from "mongoose";
import { paginate } from "../../utils/pagination.js";

export const getDoctors = async (hospitalId = null, queryOptions = {}) => {
  const query = hospitalId ? { hospitalId } : {};
  return await paginate(Doctor, queryOptions, query, ["userId", "hospitalId"]);
};

export const getDoctorById = async (doctorId) => {
  const doctor = await Doctor.findById(doctorId).populate("userId").populate("hospitalId");
  if (!doctor) {
    throw Object.assign(new Error("Doctor not found"), { status: 404 });
  }
  return doctor;
};

export const approveDoctor = async (adminUserId, doctorId, reason, requestId = "") => {
  const commandKey = requestId ? `APPROVE_DOCTOR_${doctorId}_${requestId}` : null;
  if (commandKey) {
    const existing = await getAdminActionByKey(commandKey);
    if (existing) {
      return existing.responseBody;
    }
  }

  const doctorBefore = await Doctor.findById(doctorId);
  if (!doctorBefore) {
    throw Object.assign(new Error("Doctor profile not found"), { status: 404 });
  }

  const validPrevStatuses = ["pending_profile", "pending_activation", "pending", "inactive"];
  if (!validPrevStatuses.includes(doctorBefore.status)) {
    throw Object.assign(new Error("Conflict: Doctor profile has already been approved or modified"), { status: 409 });
  }

  const beforeObj = doctorBefore.toObject();

  // Optimistic Concurrency Control using status and version (Test 13 Concurrency)
  const updated = await Doctor.findOneAndUpdate(
    { _id: doctorId, status: doctorBefore.status, __v: doctorBefore.__v },
    { $set: { status: "approved", activatedAt: new Date() }, $inc: { __v: 1 } },
    { new: true }
  );

  if (!updated) {
    throw Object.assign(new Error("Conflict: Doctor profile has already been approved or modified"), { status: 409 });
  }

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(
    adminUserId,
    "APPROVE_DOCTOR",
    { doctorId },
    correlationId,
    commandKey,
    updated.toObject()
  );
  await logAdminAudit(adminUserId, "APPROVE_DOCTOR", "Doctor", doctorId, beforeObj, updated.toObject(), reason, requestId);

  // Enqueue notification outbox (Correction 7)
  await createNotification(
    updated.userId,
    "Profile Approved by Admin 🏥",
    `Congratulations! Your doctor profile has been approved by the administrator.`,
    "update",
    {
      category: "ADMIN_ACTION",
      eventType: "doctor_approved",
      aggregateType: "Doctor",
      aggregateId: updated._id
    }
  );

  return updated;
};

export const verifyDoctor = async (adminUserId, doctorId, reason, requestId = "") => {
  const commandKey = requestId ? `VERIFY_DOCTOR_${doctorId}_${requestId}` : null;
  if (commandKey) {
    const existing = await getAdminActionByKey(commandKey);
    if (existing) {
      return existing.responseBody;
    }
  }

  const doctorBefore = await Doctor.findById(doctorId);
  if (!doctorBefore) {
    throw Object.assign(new Error("Doctor profile not found"), { status: 404 });
  }

  if (doctorBefore.status === "verified") {
    return doctorBefore; // Already verified, idempotent
  }

  const beforeObj = doctorBefore.toObject();

  const updated = await Doctor.findOneAndUpdate(
    { _id: doctorId, status: doctorBefore.status, __v: doctorBefore.__v },
    { $set: { status: "verified" }, $inc: { __v: 1 } },
    { new: true }
  );

  if (!updated) {
    throw Object.assign(new Error("Conflict: Doctor profile has already been modified"), { status: 409 });
  }

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(
    adminUserId,
    "VERIFY_DOCTOR",
    { doctorId },
    correlationId,
    commandKey,
    updated.toObject()
  );
  await logAdminAudit(adminUserId, "VERIFY_DOCTOR", "Doctor", doctorId, beforeObj, updated.toObject(), reason, requestId);

  return updated;
};

export const suspendDoctor = async (adminUserId, doctorId, reason, requestId = "") => {
  const commandKey = requestId ? `SUSPEND_DOCTOR_${doctorId}_${requestId}` : null;
  if (commandKey) {
    const existing = await getAdminActionByKey(commandKey);
    if (existing) {
      return existing.responseBody;
    }
  }

  const doctorBefore = await Doctor.findById(doctorId);
  if (!doctorBefore) {
    throw Object.assign(new Error("Doctor profile not found"), { status: 404 });
  }

  if (doctorBefore.status === "suspended") {
    return doctorBefore; // Already suspended, idempotent
  }

  const beforeObj = doctorBefore.toObject();

  const updated = await Doctor.findOneAndUpdate(
    { _id: doctorId, status: doctorBefore.status, __v: doctorBefore.__v },
    { $set: { status: "suspended" }, $inc: { __v: 1 } },
    { new: true }
  );

  if (!updated) {
    throw Object.assign(new Error("Conflict: Doctor profile has already been modified"), { status: 409 });
  }

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(
    adminUserId,
    "SUSPEND_DOCTOR",
    { doctorId },
    correlationId,
    commandKey,
    updated.toObject()
  );
  await logAdminAudit(adminUserId, "SUSPEND_DOCTOR", "Doctor", doctorId, beforeObj, updated.toObject(), reason, requestId);

  // Enqueue notification outbox (Correction 7)
  await createNotification(
    updated.userId,
    "Account Suspended ⚠️",
    `Your doctor account has been suspended by the administrator. Reason: ${reason || "N/A"}`,
    "update",
    {
      category: "SYSTEM_ALERT",
      eventType: "doctor_suspended",
      aggregateType: "Doctor",
      aggregateId: updated._id
    }
  );

  return updated;
};

export const resetDoctor = async (adminUserId, doctorId, reason, requestId = "") => {
  const commandKey = requestId ? `RESET_DOCTOR_${doctorId}_${requestId}` : null;
  if (commandKey) {
    const existing = await getAdminActionByKey(commandKey);
    if (existing) {
      return existing.responseBody;
    }
  }

  const doctorBefore = await Doctor.findById(doctorId);
  if (!doctorBefore) {
    throw Object.assign(new Error("Doctor profile not found"), { status: 404 });
  }

  const beforeObj = doctorBefore.toObject();

  const updated = await Doctor.findOneAndUpdate(
    { _id: doctorId, status: doctorBefore.status, __v: doctorBefore.__v },
    { $set: { status: "pending" }, $inc: { __v: 1 } },
    { new: true }
  );

  if (!updated) {
    throw Object.assign(new Error("Conflict: Doctor profile has already been modified"), { status: 409 });
  }

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(
    adminUserId,
    "RESET_DOCTOR",
    { doctorId },
    correlationId,
    commandKey,
    updated.toObject()
  );
  await logAdminAudit(adminUserId, "RESET_DOCTOR", "Doctor", doctorId, beforeObj, updated.toObject(), reason, requestId);

  return updated;
};
