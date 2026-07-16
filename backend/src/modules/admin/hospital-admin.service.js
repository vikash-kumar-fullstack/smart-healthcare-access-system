import Hospital from "../hospital/hospital.model.js";
import { logAdminAudit, logAdminAction, getAdminActionByKey } from "./admin.service.js";
import { createNotification } from "../notification/notification.service.js";
import mongoose from "mongoose";
import { paginate } from "../../utils/pagination.js";

export const getHospitals = async (queryOptions = {}) => {
  return await paginate(Hospital, queryOptions);
};

export const getHospitalById = async (hospitalId) => {
  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) {
    throw Object.assign(new Error("Hospital not found"), { status: 404 });
  }
  return hospital;
};

export const updateHospital = async (adminUserId, hospitalId, updateData, reason, requestId = "") => {
  const commandKey = requestId ? `UPDATE_HOSPITAL_${hospitalId}_${requestId}` : null;
  if (commandKey) {
    const existing = await getAdminActionByKey(commandKey);
    if (existing) {
      return existing.responseBody;
    }
  }

  const hospital = await getHospitalById(hospitalId);
  const beforeObj = hospital.toObject();

  const allowedFields = ["name", "address", "location", "specializations", "capacity", "operationalNotice"];
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      hospital[field] = updateData[field];
    }
  });

  const updated = await hospital.save();

  const policyFields = [
    "bookingWindowDays", "bookingCutoffMinutes", "lateCheckInGraceMinutes",
    "allowLateArrival", "allowTransfer", "allowEmergencyWalkIn",
    "walkInCapacity", "maxPatientsPerSession", "queueStrategy"
  ];
  const policyUpdateObj = {};
  let policyUpdated = false;
  policyFields.forEach(field => {
    if (updateData[field] !== undefined) {
      policyUpdateObj[field] = updateData[field];
      policyUpdated = true;
    }
  });

  if (policyUpdated) {
    const HospitalSchedulingPolicy = (await import("../hospital/hospital_scheduling_policy.model.js")).default;
    await HospitalSchedulingPolicy.findOneAndUpdate(
      { hospitalId },
      { $set: policyUpdateObj },
      { upsert: true }
    );
  }
  const correlationId = new mongoose.Types.ObjectId().toString();

  await logAdminAction(
    adminUserId,
    "UPDATE_HOSPITAL",
    { hospitalId, updateData },
    correlationId,
    commandKey,
    updated.toObject()
  );
  await logAdminAudit(adminUserId, "UPDATE_HOSPITAL", "Hospital", hospital._id, beforeObj, updated.toObject(), reason, requestId);

  return updated;
};

export const suspendHospital = async (adminUserId, hospitalId, reason, requestId = "") => {
  const commandKey = requestId ? `SUSPEND_HOSPITAL_${hospitalId}_${requestId}` : null;
  if (commandKey) {
    const existing = await getAdminActionByKey(commandKey);
    if (existing) {
      return existing.responseBody;
    }
  }

  const hospital = await getHospitalById(hospitalId);
  const beforeObj = hospital.toObject();

  hospital.isActive = false;
  const updated = await hospital.save();

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(
    adminUserId,
    "SUSPEND_HOSPITAL",
    { hospitalId },
    correlationId,
    commandKey,
    updated.toObject()
  );
  await logAdminAudit(adminUserId, "SUSPEND_HOSPITAL", "Hospital", hospital._id, beforeObj, updated.toObject(), reason, requestId);

  // Enqueue notification outbox (Correction 7)
  await createNotification(
    adminUserId,
    `Hospital Suspended: ${hospital.name}`,
    `The hospital ${hospital.name} has been suspended due to: ${reason || "No reason provided"}`,
    "update",
    {
      category: "SYSTEM_ALERT",
      eventType: "hospital_suspended",
      aggregateType: "Hospital",
      aggregateId: hospital._id
    }
  );

  return updated;
};

export const reopenHospital = async (adminUserId, hospitalId, reason, requestId = "") => {
  const commandKey = requestId ? `REOPEN_HOSPITAL_${hospitalId}_${requestId}` : null;
  if (commandKey) {
    const existing = await getAdminActionByKey(commandKey);
    if (existing) {
      return existing.responseBody;
    }
  }

  const hospital = await getHospitalById(hospitalId);
  const beforeObj = hospital.toObject();

  hospital.isActive = true;
  const updated = await hospital.save();

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(
    adminUserId,
    "REOPEN_HOSPITAL",
    { hospitalId },
    correlationId,
    commandKey,
    updated.toObject()
  );
  await logAdminAudit(adminUserId, "REOPEN_HOSPITAL", "Hospital", hospital._id, beforeObj, updated.toObject(), reason, requestId);

  await createNotification(
    adminUserId,
    `Hospital Reopened: ${hospital.name}`,
    `The hospital ${hospital.name} is now active and operational.`,
    "update",
    {
      category: "SYSTEM_ALERT",
      eventType: "hospital_reopened",
      aggregateType: "Hospital",
      aggregateId: hospital._id
    }
  );

  return updated;
};

export const archiveHospital = async (adminUserId, hospitalId, reason, requestId = "") => {
  const commandKey = requestId ? `ARCHIVE_HOSPITAL_${hospitalId}_${requestId}` : null;
  if (commandKey) {
    const existing = await getAdminActionByKey(commandKey);
    if (existing) {
      return existing.responseBody;
    }
  }

  const hospital = await getHospitalById(hospitalId);
  const beforeObj = hospital.toObject();

  hospital.isActive = false;
  const updated = await hospital.save();

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(
    adminUserId,
    "ARCHIVE_HOSPITAL",
    { hospitalId },
    correlationId,
    commandKey,
    updated.toObject()
  );
  await logAdminAudit(adminUserId, "ARCHIVE_HOSPITAL", "Hospital", hospital._id, beforeObj, updated.toObject(), reason, requestId);

  return updated;
};
