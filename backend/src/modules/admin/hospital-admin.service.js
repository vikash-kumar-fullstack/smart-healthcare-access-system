import Hospital from "../hospital/hospital.model.js";
import { logAdminAudit, logAdminAction } from "./admin.service.js";
import { createNotification } from "../notification/notification.service.js";
import mongoose from "mongoose";

export const getHospitals = async () => {
  return await Hospital.find({}).sort({ name: 1 });
};

export const getHospitalById = async (hospitalId) => {
  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) {
    throw Object.assign(new Error("Hospital not found"), { status: 404 });
  }
  return hospital;
};

export const updateHospital = async (adminUserId, hospitalId, updateData, reason, requestId = "") => {
  const hospital = await getHospitalById(hospitalId);
  const beforeObj = hospital.toObject();

  const allowedFields = ["name", "address", "location", "specializations", "capacity", "operationalNotice"];
  allowedFields.forEach(field => {
    if (updateData[field] !== undefined) {
      hospital[field] = updateData[field];
    }
  });

  const updated = await hospital.save();
  const correlationId = new mongoose.Types.ObjectId().toString();

  await logAdminAction(adminUserId, "UPDATE_HOSPITAL", { hospitalId, updateData }, correlationId);
  await logAdminAudit(adminUserId, "UPDATE_HOSPITAL", "Hospital", hospital._id, beforeObj, updated.toObject(), reason, requestId);

  return updated;
};

export const suspendHospital = async (adminUserId, hospitalId, reason, requestId = "") => {
  const hospital = await getHospitalById(hospitalId);
  const beforeObj = hospital.toObject();

  hospital.isActive = false;
  const updated = await hospital.save();

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(adminUserId, "SUSPEND_HOSPITAL", { hospitalId }, correlationId);
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
  const hospital = await getHospitalById(hospitalId);
  const beforeObj = hospital.toObject();

  hospital.isActive = true;
  const updated = await hospital.save();

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(adminUserId, "REOPEN_HOSPITAL", { hospitalId }, correlationId);
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
  const hospital = await getHospitalById(hospitalId);
  const beforeObj = hospital.toObject();

  hospital.isActive = false;
  const updated = await hospital.save();

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(adminUserId, "ARCHIVE_HOSPITAL", { hospitalId }, correlationId);
  await logAdminAudit(adminUserId, "ARCHIVE_HOSPITAL", "Hospital", hospital._id, beforeObj, updated.toObject(), reason, requestId);

  return updated;
};
