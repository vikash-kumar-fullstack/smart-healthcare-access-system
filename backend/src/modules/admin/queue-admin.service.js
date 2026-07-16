import Queue from "../queue/queue.model.js";
import QueueSession from "../queue/queueSession.model.js";
import Doctor from "../doctor/doctor.model.js";
import QueueIntervention from "./queue_intervention.model.js";
import { logAdminAudit, logAdminAction, getAdminActionByKey } from "./admin.service.js";
import { createNotification } from "../notification/notification.service.js";
import mongoose from "mongoose";

export const getQueues = async (hospitalId = null) => {
  if (hospitalId) {
    const doctors = await Doctor.find({ hospitalId }, "_id");
    const doctorIds = doctors.map(d => d._id);
    return await QueueSession.find({ doctorId: { $in: doctorIds } }).populate("doctorId").sort({ date: -1 });
  }
  return await QueueSession.find({}).populate("doctorId").sort({ date: -1 });
};

export const forceCloseSession = async (adminUserId, sessionId, reason, requestId = "") => {
  const commandKey = requestId ? `FORCE_CLOSE_QUEUE_SESSION_${sessionId}_${requestId}` : null;
  if (commandKey) {
    const existing = await getAdminActionByKey(commandKey);
    if (existing) {
      return existing.responseBody;
    }
  }

  const session = await QueueSession.findById(sessionId);
  if (!session) {
    throw Object.assign(new Error("Queue session not found"), { status: 404 });
  }

  const beforeObj = session.toObject();

  session.sessionStatus = "closed";
  session.isActive = false;
  session.closedAt = new Date();
  const updated = await session.save();

  // Log intervention (Lock 6)
  await QueueIntervention.create({
    queueId: sessionId,
    adminId: adminUserId,
    reason,
    type: "force_close",
    rollbackData: {
      previousStatus: beforeObj.sessionStatus,
      closedAt: beforeObj.closedAt,
      isActive: beforeObj.isActive
    }
  });

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(
    adminUserId,
    "FORCE_CLOSE_QUEUE_SESSION",
    { sessionId },
    correlationId,
    commandKey,
    updated.toObject()
  );
  await logAdminAudit(adminUserId, "FORCE_CLOSE_QUEUE_SESSION", "QueueSession", sessionId, beforeObj, updated.toObject(), reason, requestId);

  return updated;
};

export const forceReopenSession = async (adminUserId, sessionId, reason, requestId = "") => {
  const commandKey = requestId ? `FORCE_REOPEN_QUEUE_SESSION_${sessionId}_${requestId}` : null;
  if (commandKey) {
    const existing = await getAdminActionByKey(commandKey);
    if (existing) {
      return existing.responseBody;
    }
  }

  const session = await QueueSession.findById(sessionId);
  if (!session) {
    throw Object.assign(new Error("Queue session not found"), { status: 404 });
  }

  const beforeObj = session.toObject();

  session.sessionStatus = "active";
  session.isActive = true;
  session.closedAt = null;
  const updated = await session.save();

  // Log intervention (Lock 6)
  await QueueIntervention.create({
    queueId: sessionId,
    adminId: adminUserId,
    reason,
    type: "force_reopen",
    rollbackData: {
      previousStatus: beforeObj.sessionStatus,
      closedAt: beforeObj.closedAt,
      isActive: beforeObj.isActive
    }
  });

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(
    adminUserId,
    "FORCE_REOPEN_QUEUE_SESSION",
    { sessionId },
    correlationId,
    commandKey,
    updated.toObject()
  );
  await logAdminAudit(adminUserId, "FORCE_REOPEN_QUEUE_SESSION", "QueueSession", sessionId, beforeObj, updated.toObject(), reason, requestId);

  return updated;
};

export const emergencyPauseSession = async (adminUserId, sessionId, reason, requestId = "") => {
  const commandKey = requestId ? `EMERGENCY_PAUSE_QUEUE_SESSION_${sessionId}_${requestId}` : null;
  if (commandKey) {
    const existing = await getAdminActionByKey(commandKey);
    if (existing) {
      return existing.responseBody;
    }
  }

  const session = await QueueSession.findById(sessionId);
  if (!session) {
    throw Object.assign(new Error("Queue session not found"), { status: 404 });
  }

  const beforeObj = session.toObject();

  session.sessionStatus = "paused";
  session.pausedAt = new Date();
  const updated = await session.save();

  // Log intervention (Lock 6)
  await QueueIntervention.create({
    queueId: sessionId,
    adminId: adminUserId,
    reason,
    type: "emergency_pause",
    rollbackData: {
      previousStatus: beforeObj.sessionStatus,
      pausedAt: beforeObj.pausedAt
    }
  });

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(
    adminUserId,
    "EMERGENCY_PAUSE_QUEUE_SESSION",
    { sessionId },
    correlationId,
    commandKey,
    updated.toObject()
  );
  await logAdminAudit(adminUserId, "EMERGENCY_PAUSE_QUEUE_SESSION", "QueueSession", sessionId, beforeObj, updated.toObject(), reason, requestId);

  return updated;
};

export const reassignPatient = async (adminUserId, queueEntryId, targetDoctorId, reason, requestId = "") => {
  const commandKey = requestId ? `REASSIGN_PATIENT_${queueEntryId}_${requestId}` : null;
  if (commandKey) {
    const existing = await getAdminActionByKey(commandKey);
    if (existing) {
      return existing.responseBody;
    }
  }

  const queueEntry = await Queue.findById(queueEntryId);
  if (!queueEntry) {
    throw Object.assign(new Error("Queue booking not found"), { status: 404 });
  }

  // Verification Rules (Correction 5 & Test 14)
  if (["completed", "cancelled", "no_show"].includes(queueEntry.status)) {
    throw Object.assign(new Error("REASSIGN_LOCKED: Cannot move a completed/cancelled/no-show booking"), { status: 400 });
  }
  if (queueEntry.status === "in_progress") {
    throw Object.assign(new Error("REASSIGN_LOCKED: Cannot move an in-progress consulting booking"), { status: 400 });
  }

  const currentSession = await QueueSession.findById(queueEntry.sessionId);
  if (!currentSession) {
    throw Object.assign(new Error("Current queue session not found"), { status: 500 });
  }

  // Same date check (Rule 1)
  const targetSession = await QueueSession.findOne({ doctorId: targetDoctorId, date: currentSession.date });
  if (!targetSession) {
    throw Object.assign(new Error("REASSIGN_LOCKED: Target doctor has no active session scheduled for this date"), { status: 400 });
  }

  // Same specialization check (Rule 2)
  const currentDoctor = await Doctor.findById(queueEntry.doctorId);
  const targetDoctor = await Doctor.findById(targetDoctorId);
  if (!currentDoctor || !targetDoctor) {
    throw Object.assign(new Error("Doctor profiles not found"), { status: 404 });
  }
  if (currentDoctor.specialization !== targetDoctor.specialization) {
    throw Object.assign(new Error("REASSIGN_LOCKED: Specialization mismatch. Patient can only be reassigned to a doctor with the same specialization"), { status: 400 });
  }

  // Destination capacity check (Rule 3)
  const activeBookingsCount = await Queue.countDocuments({
    sessionId: targetSession._id,
    status: { $in: ["waiting", "in_progress"] }
  });
  if (activeBookingsCount >= targetSession.maxQueueLimit) {
    throw Object.assign(new Error("REASSIGN_LOCKED: Destination queue session has reached its maximum capacity limit"), { status: 400 });
  }

  const sessionUpdate = await QueueSession.findByIdAndUpdate(
    targetSession._id,
    { $inc: { currentQueueNumber: 1 } },
    { new: true }
  );

  const beforeObj = queueEntry.toObject();

  // Update booking coordinates
  queueEntry.doctorId = targetDoctorId;
  queueEntry.sessionId = targetSession._id;
  queueEntry.queueNumber = sessionUpdate.currentQueueNumber;
  const updatedEntry = await queueEntry.save();

  // Log intervention (Lock 6)
  await QueueIntervention.create({
    queueId: currentSession._id,
    adminId: adminUserId,
    reason,
    type: "reassign_patient",
    rollbackData: {
      queueEntryId: queueEntryId,
      previousDoctorId: beforeObj.doctorId,
      previousSessionId: beforeObj.sessionId,
      previousQueueNumber: beforeObj.queueNumber
    }
  });

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(
    adminUserId,
    "REASSIGN_PATIENT",
    { queueEntryId, targetDoctorId },
    correlationId,
    commandKey,
    updatedEntry.toObject()
  );
  await logAdminAudit(adminUserId, "REASSIGN_PATIENT", "Queue", queueEntryId, beforeObj, updatedEntry.toObject(), reason, requestId);

  // Send update notification to patient
  await createNotification(
    queueEntry.userId,
    "Queue Reassigned 🏥",
    `Your queue ticket has been reassigned to Dr. ${targetDoctor.name}. Your new ticket number is ${sessionUpdate.currentQueueNumber}.`,
    "update",
    {
      category: "queue",
      eventType: "queue_reassigned",
      aggregateType: "Queue",
      aggregateId: updatedEntry._id
    }
  );

  return updatedEntry;
};

export const revertIntervention = async (adminUserId, interventionId, requestId = "") => {
  const commandKey = requestId ? `REVERT_INTERVENTION_${interventionId}_${requestId}` : null;
  if (commandKey) {
    const existing = await getAdminActionByKey(commandKey);
    if (existing) {
      return existing.responseBody;
    }
  }

  const intervention = await QueueIntervention.findById(interventionId);
  if (!intervention) {
    throw Object.assign(new Error("Intervention not found"), { status: 404 });
  }

  if (intervention.revertedAt) {
    throw Object.assign(new Error("Intervention has already been reverted"), { status: 400 });
  }

  const { type, rollbackData, queueId } = intervention;

  if (type === "reassign_patient") {
    // Look up the booking
    const queueEntry = await Queue.findById(rollbackData.queueEntryId);
    if (!queueEntry) {
      throw Object.assign(new Error("Original queue booking not found"), { status: 404 });
    }

    // Check if current status allows movement (e.g. waiting)
    if (["completed", "cancelled", "no_show"].includes(queueEntry.status)) {
      throw Object.assign(new Error("REVERT_LOCKED: Cannot move a completed/cancelled/no-show booking"), { status: 400 });
    }
    if (queueEntry.status === "in_progress") {
      throw Object.assign(new Error("REVERT_LOCKED: Cannot move an in-progress consulting booking"), { status: 400 });
    }

    const beforeObj = queueEntry.toObject();

    // Reassign the patient back to the original doctor, original session, and original queue number.
    queueEntry.doctorId = rollbackData.previousDoctorId;
    queueEntry.sessionId = rollbackData.previousSessionId;
    queueEntry.queueNumber = rollbackData.previousQueueNumber;

    const updatedEntry = await queueEntry.save();

    // Log admin actions & audit
    const correlationId = new mongoose.Types.ObjectId().toString();
    await logAdminAction(adminUserId, "REVERT_REASSIGN_PATIENT", { queueEntryId: queueEntry._id }, correlationId);
    await logAdminAudit(
      adminUserId,
      "REVERT_REASSIGN_PATIENT",
      "Queue",
      queueEntry._id,
      beforeObj,
      updatedEntry.toObject(),
      "Reversion of administrative queue reassignment",
      requestId
    );

    // Notify patient
    const originalDoctor = await Doctor.findById(rollbackData.previousDoctorId);
    await createNotification(
      queueEntry.userId,
      "Queue Reassignment Reverted 🏥",
      `Your queue ticket has been reverted back to Dr. ${originalDoctor ? originalDoctor.name : "original doctor"}. Your ticket number is restored to ${rollbackData.previousQueueNumber}.`,
      "update",
      {
        category: "queue",
        eventType: "queue_reassignment_reverted",
        aggregateType: "Queue",
        aggregateId: updatedEntry._id
      }
    );
  } else if (["force_close", "force_reopen", "emergency_pause"].includes(type)) {
    const session = await QueueSession.findById(queueId);
    if (!session) {
      throw Object.assign(new Error("Queue session not found"), { status: 404 });
    }

    const beforeObj = session.toObject();

    // Restore the session status and properties
    if (rollbackData.previousStatus) {
      session.sessionStatus = rollbackData.previousStatus;
    }
    if (rollbackData.isActive !== undefined) {
      session.isActive = rollbackData.isActive;
    }
    if (rollbackData.closedAt !== undefined) {
      session.closedAt = rollbackData.closedAt;
    }
    if (rollbackData.pausedAt !== undefined) {
      session.pausedAt = rollbackData.pausedAt;
    }

    const updated = await session.save();

    const correlationId = new mongoose.Types.ObjectId().toString();
    await logAdminAction(adminUserId, `REVERT_${type.toUpperCase()}`, { sessionId: queueId }, correlationId);
    await logAdminAudit(
      adminUserId,
      `REVERT_${type.toUpperCase()}`,
      "QueueSession",
      queueId,
      beforeObj,
      updated.toObject(),
      `Reversion of administrative intervention: ${type}`,
      requestId
    );
  } else {
    throw Object.assign(new Error("Unsupported intervention type for revert"), { status: 400 });
  }

  // Record revertedAt = new Date()
  intervention.revertedAt = new Date();
  const updatedIntervention = await intervention.save();

  // Log admin action for revert to preserve idempotency response body
  const actionCorrelationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(
    adminUserId,
    "REVERT_INTERVENTION",
    { interventionId },
    actionCorrelationId,
    commandKey,
    updatedIntervention.toObject()
  );

  return updatedIntervention;
};
