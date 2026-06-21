import Queue from "../queue/queue.model.js";
import QueueSession from "../queue/queueSession.model.js";
import Doctor from "../doctor/doctor.model.js";
import QueueIntervention from "./queue_intervention.model.js";
import { logAdminAudit, logAdminAction } from "./admin.service.js";
import { createNotification } from "../notification/notification.service.js";
import mongoose from "mongoose";

export const getQueues = async () => {
  return await QueueSession.find({}).populate("doctorId").sort({ date: -1 });
};

export const forceCloseSession = async (adminUserId, sessionId, reason, requestId = "") => {
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
    type: "force_close"
  });

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(adminUserId, "FORCE_CLOSE_QUEUE_SESSION", { sessionId }, correlationId);
  await logAdminAudit(adminUserId, "FORCE_CLOSE_QUEUE_SESSION", "QueueSession", sessionId, beforeObj, updated.toObject(), reason, requestId);

  return updated;
};

export const forceReopenSession = async (adminUserId, sessionId, reason, requestId = "") => {
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
    type: "force_reopen"
  });

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(adminUserId, "FORCE_REOPEN_QUEUE_SESSION", { sessionId }, correlationId);
  await logAdminAudit(adminUserId, "FORCE_REOPEN_QUEUE_SESSION", "QueueSession", sessionId, beforeObj, updated.toObject(), reason, requestId);

  return updated;
};

export const emergencyPauseSession = async (adminUserId, sessionId, reason, requestId = "") => {
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
    type: "emergency_pause"
  });

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(adminUserId, "EMERGENCY_PAUSE_QUEUE_SESSION", { sessionId }, correlationId);
  await logAdminAudit(adminUserId, "EMERGENCY_PAUSE_QUEUE_SESSION", "QueueSession", sessionId, beforeObj, updated.toObject(), reason, requestId);

  return updated;
};

export const reassignPatient = async (adminUserId, queueEntryId, targetDoctorId, reason, requestId = "") => {
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
    type: "reassign_patient"
  });

  const correlationId = new mongoose.Types.ObjectId().toString();
  await logAdminAction(adminUserId, "REASSIGN_PATIENT", { queueEntryId, targetDoctorId }, correlationId);
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
