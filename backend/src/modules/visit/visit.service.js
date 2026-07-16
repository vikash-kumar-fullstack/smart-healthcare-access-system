import mongoose from "mongoose";
import Visit from "./visit.model.js";
import VisitTimeline from "./visit_timeline.model.js";
import VisitSummary from "./visit_summary.model.js";
import VisitSequence from "./visit_sequence.model.js";
import Queue from "../queue/queue.model.js";
import QueueSession from "../queue/queueSession.model.js";
import Doctor from "../doctor/doctor.model.js";
import User from "../auth/auth.model.js";
import AuditLog from "../queue/audit_log.model.js";
import { createNotification } from "../notification/notification.service.js";
import { incrementDailyAnalytics, getOrCreatePatientStats } from "../queue/queue.service.js";
import { createFromVisit } from "../medical-records/medical_record.service.js";

// ── Centralized Transitions Mapping ─────────────────────────────────────────
export const transitions = {
  scheduled: ["waiting", "cancelled"],
  waiting: ["in_progress", "cancelled", "no_show"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  no_show: []
};

export const FINAL_VISITS = ["completed", "cancelled", "no_show"];

export const assertTransition = (from, to) => {
  const allowed = transitions[from] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(new Error(`Invalid visit status transition from ${from} to ${to}`), { status: 400 });
  }
};

const getTodayIST = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// ── Readable publicId Generator ──────────────────────────────────────────────
export const generatePublicId = async (session = null) => {
  const dateStr = getTodayIST();
  const [year, month] = dateStr.split("-");
  
  const seqDoc = await VisitSequence.findOneAndUpdate(
    { key: "visit-seq" },
    { $inc: { current: 1 } },
    { upsert: true, new: true, session }
  );
  
  const seqStr = String(seqDoc.current).padStart(6, "0");
  return `VIS-${year}-${month}-${seqStr}`;
};

// ── Timeline Helper ─────────────────────────────────────────────────────────
export const appendTimelineEvent = async (visitId, eventType, message, metadata = {}, session = null) => {
  const dbSession = session || null;
  
  // Atomic Sequence Increment inside the Visit (Final Fix 3)
  const updatedVisit = await Visit.findOneAndUpdate(
    { _id: visitId, deletedAt: null },
    { $inc: { timelineSequence: 1 } },
    { new: true, session: dbSession }
  );
  
  if (!updatedVisit) {
    throw Object.assign(new Error("Visit not found"), { status: 404 });
  }
  
  const timelineEvent = await VisitTimeline.create([{
    visitId,
    eventType,
    message,
    metadata,
    sequence: updatedVisit.timelineSequence
  }], { session: dbSession });
  
  return timelineEvent[0];
};

// ── Create Visit ─────────────────────────────────────────────────────────────
export const createVisit = async (queueId, patientId, doctorId, sessionId, bookingDate, session = null) => {
  const dbSession = session || null;
  
  // Idempotency: return existing if found
  const existing = await Visit.findOne({ queueId, deletedAt: null }).session(dbSession);
  if (existing) {
    return existing;
  }
  
  const doctor = await Doctor.findById(doctorId).populate("hospitalId").session(dbSession);
  if (!doctor) {
    throw Object.assign(new Error("Doctor not found"), { status: 404 });
  }
  
  const patient = await User.findById(patientId).session(dbSession);
  if (!patient) {
    throw Object.assign(new Error("Patient user not found"), { status: 404 });
  }
  
  const queueSession = await QueueSession.findById(sessionId).session(dbSession);
  const initialStatus = queueSession?.sessionStatus === "active" ? "waiting" : "scheduled";
  
  const publicId = await generatePublicId(dbSession);
  
  const visit = await Visit.create([{
    publicId,
    patientId,
    doctorId,
    hospitalId: doctor.hospitalId._id,
    queueId,
    sessionId,
    bookingDate,
    status: initialStatus,
    doctorSnapshot: {
      name: doctor.name,
      specialization: doctor.specialization,
      hospitalName: doctor.hospitalId.name || "Unknown Hospital"
    },
    patientSnapshot: {
      name: patient.name,
      email: patient.email || null,
      phone: patient.phone || null
    },
    createdBy: patientId,
    updatedBy: patientId
  }], { session: dbSession });
  
  const createdVisit = visit[0];
  
  await appendTimelineEvent(createdVisit._id, "BOOKED", "Visit booked and scheduled.", {}, dbSession);
  if (initialStatus === "waiting") {
    await appendTimelineEvent(createdVisit._id, "QUEUE_UPDATED", "Visit status updated to waiting.", {}, dbSession);
  }
  
  await createNotification(
    patientId,
    "Visit Booked 🏥",
    `Your visit with Dr. ${doctor.name} has been booked. Track status via Dashboard.`,
    "booking",
    {
      session: dbSession,
      category: "queue",
      eventType: "BOOKED",
      aggregateType: "Visit",
      aggregateId: createdVisit._id,
      metadata: { route: `/visits/${createdVisit._id}`, entityId: createdVisit._id.toString() }
    }
  );
  
  return createdVisit;
};

// ── Start Consultation ───────────────────────────────────────────────────────
export const startConsultation = async (visitId, doctorUserId, session = null) => {
  const dbSession = session || null;
  const visit = await Visit.findOne({ _id: visitId, deletedAt: null }).session(dbSession);
  if (!visit) {
    throw Object.assign(new Error("Visit not found"), { status: 404 });
  }
  
  if (visit.status === "in_progress") {
    throw Object.assign(new Error("Consultation is already in progress"), { status: 409, code: "already_in_progress" });
  }
  
  if (FINAL_VISITS.includes(visit.status)) {
    throw Object.assign(new Error("Visit is immutable after completion/cancellation"), { status: 400 });
  }
  
  assertTransition(visit.status, "in_progress");
  
  visit.status = "in_progress";
  visit.startedAt = new Date();
  visit.updatedBy = doctorUserId;
  await visit.save({ session: dbSession });
  
  await appendTimelineEvent(visit._id, "CONSULTATION_STARTED", "Consultation started by doctor.", {}, dbSession);
  
  const queue = await Queue.findById(visit.queueId).session(dbSession);
  if (queue && queue.status !== "in_progress") {
    queue.status = "in_progress";
    queue.startedAt = visit.startedAt;
    await queue.save({ session: dbSession });
  }
  
  await createNotification(
    visit.patientId,
    "Consultation Started 🩺",
    `Your consultation with Dr. ${visit.doctorSnapshot.name} has started.`,
    "update",
    {
      session: dbSession,
      category: "queue",
      eventType: "VISIT_STARTED",
      aggregateType: "Visit",
      aggregateId: visit._id,
      metadata: { route: `/visits/${visit._id}`, entityId: visit._id.toString() }
    }
  );
  
  setImmediate(async () => {
    try {
      const { dispatchToUser, dispatchToDoctor } = await import("../realtime/event_dispatcher.js");
      await dispatchToUser(visit.patientId, "VISIT_STARTED", { visitId: visit._id });
      await dispatchToDoctor(visit.doctorId, "VISIT_STARTED", { visitId: visit._id, patientId: visit.patientId });
    } catch (err) {
      console.error("Failed to emit VISIT_STARTED realtime event:", err);
    }
  });

  return visit;
};

// ── Complete Consultation ────────────────────────────────────────────────────
export const completeConsultation = async (visitId, doctorUserId, summaryData, session = null) => {
  const dbSession = session || null;
  const visit = await Visit.findOne({ _id: visitId, deletedAt: null }).session(dbSession);
  if (!visit) {
    throw Object.assign(new Error("Visit not found"), { status: 404 });
  }
  
  // Idempotent recovery for crash recovery test
  if (visit.status === "completed") {
    return visit;
  }
  
  if (FINAL_VISITS.includes(visit.status)) {
    throw Object.assign(new Error("Visit is immutable after completion/cancellation"), { status: 400 });
  }
  
  assertTransition(visit.status, "completed");
  
  const now = new Date();
  const duration = now.getTime() - new Date(visit.startedAt || now).getTime();
  
  visit.status = "completed";
  visit.endedAt = now;
  visit.consultationDurationMs = duration;
  visit.visitOutcome = summaryData.visitOutcome;
  visit.latestSummaryVersion = 1;
  visit.updatedBy = doctorUserId;
  await visit.save({ session: dbSession });
  
  await VisitSummary.create([{
    visitId: visit._id,
    chiefComplaint: summaryData.chiefComplaint,
    doctorNotes: summaryData.doctorNotes,
    consultationSummary: summaryData.consultationSummary,
    followUpAdvice: summaryData.followUpAdvice || "",
    visibility: summaryData.visibility || "patient",
    version: 1,
    summaryStatus: "active"
  }], { session: dbSession });

  // Create EMR snapshot and version 1 record (LOCK 2 & correction)
  await createFromVisit(visit._id, summaryData, doctorUserId, dbSession);
  
  await appendTimelineEvent(visit._id, "VISIT_COMPLETED", "Consultation completed.", {}, dbSession);
  
  const queue = await Queue.findById(visit.queueId).session(dbSession);
  if (queue && queue.status !== "completed") {
    queue.status = "completed";
    queue.closedReason = "completed";
    queue.completedAt = now;
    queue.consultationDurationMs = duration;
    queue.isActive = false;
    queue.analyticsProcessed = true;
    await queue.save({ session: dbSession });
  }
  
  const stats = await getOrCreatePatientStats(visit.patientId, dbSession);
  stats.completedVisits = (stats.completedVisits || 0) + 1;
  stats.reliabilityScore = Math.min(100, (stats.reliabilityScore || 100) + 2);
  await stats.save({ session: dbSession });
  
  await AuditLog.create([{
    doctorId: visit.doctorId,
    action: "completed",
    queueId: visit.queueId
  }], { session: dbSession });
  
  const nextQueue = await Queue.findOne({
    doctorId: visit.doctorId,
    sessionId: visit.sessionId,
    status: "waiting"
  }).sort({ isPriority: -1, queueNumber: 1 }).session(dbSession);
  
  if (nextQueue) {
    nextQueue.status = "in_progress";
    nextQueue.startedAt = new Date();
    await nextQueue.save({ session: dbSession });
    
    await createNotification(
      nextQueue.userId,
      "Your Turn Has Started 🏥",
      "The previous patient is done. Please proceed to the doctor now.",
      "update",
      {
        session: dbSession,
        aggregateType: "Queue",
        aggregateId: nextQueue._id,
        eventType: "turn_started",
        metadata: { route: "/queue", entityId: nextQueue._id.toString() }
      }
    );
  }
  
  await createNotification(
    visit.patientId,
    "Consultation Completed ✅",
    `Your visit with Dr. ${visit.doctorSnapshot.name} is complete. View summary notes.`,
    "update",
    {
      session: dbSession,
      category: "queue",
      eventType: "VISIT_COMPLETED",
      aggregateType: "Visit",
      aggregateId: visit._id,
      metadata: { route: `/visits/${visit._id}`, entityId: visit._id.toString() }
    }
  );
  
  setImmediate(async () => {
    try {
      const todayIST = getTodayIST();
      const completedCount = await Queue.countDocuments({
        doctorId: visit.doctorId,
        userId: visit.patientId,
        status: "completed"
      });
      
      let uInc = 0;
      let rInc = 0;
      if (completedCount === 1) {
        uInc = 1;
      } else if (completedCount === 2) {
        rInc = 1;
      }
      
      const queueCreated = queue?.createdAt || now;
      const queueStarted = queue?.startedAt || now;
      const waitMs = new Date(queueStarted).getTime() - new Date(queueCreated).getTime();
      const waitMins = Math.round(Math.max(waitMs / 60000, 0));
      const consultMins = Math.round(Math.max(duration / 60000, 0));
      
      await incrementDailyAnalytics(
        visit.doctorId,
        todayIST,
        {
          $inc: {
            completed: 1,
            totalConsultationMinutes: consultMins,
            consultationCount: 1,
            totalWaitMinutes: waitMins,
            waitCount: 1,
            uniquePatients: uInc,
            returningPatients: rInc
          }
        }
      );
    } catch (err) {
      console.error("Failed to update daily analytics in background:", err);
    }
  });
  
  setImmediate(async () => {
    try {
      const { dispatchToUser, dispatchToDoctor } = await import("../realtime/event_dispatcher.js");
      await dispatchToUser(visit.patientId, "VISIT_COMPLETED", { visitId: visit._id });
      await dispatchToDoctor(visit.doctorId, "VISIT_COMPLETED", { visitId: visit._id });
      await dispatchToUser(visit.patientId, "EMR_UPDATED", { visitId: visit._id });
    } catch (err) {
      console.error("Failed to emit VISIT_COMPLETED / EMR_UPDATED realtime event:", err);
    }
  });
  
  return visit;
};

// ── Update Summary ───────────────────────────────────────────────────────────
export const updateSummary = async (visitId, doctorUserId, summaryData, session = null) => {
  const dbSession = session || null;
  const visit = await Visit.findOne({ _id: visitId, deletedAt: null }).session(dbSession);
  if (!visit) {
    throw Object.assign(new Error("Visit not found"), { status: 404 });
  }
  
  if (visit.doctorId.toString() !== doctorUserId.toString()) {
    throw Object.assign(new Error("Unauthorized: Only the assigned doctor can edit summary"), { status: 403 });
  }
  
  const lastSummary = await VisitSummary.findOne({ visitId, summaryStatus: "active", deletedAt: null })
    .sort({ version: -1 })
    .session(dbSession);
    
  const currentVersion = lastSummary ? lastSummary.version : 0;
  const nextVersion = currentVersion + 1;
  
  if (lastSummary) {
    lastSummary.summaryStatus = "archived";
    await lastSummary.save({ session: dbSession });
  }
  
  await VisitSummary.create([{
    visitId,
    chiefComplaint: summaryData.chiefComplaint,
    doctorNotes: summaryData.doctorNotes,
    consultationSummary: summaryData.consultationSummary,
    followUpAdvice: summaryData.followUpAdvice || "",
    visibility: summaryData.visibility || "patient",
    version: nextVersion,
    summaryStatus: "active"
  }], { session: dbSession });
  
  // Since the completed visit is frozen, we update only latestSummaryVersion (Lock 2 allows this path)
  visit.latestSummaryVersion = nextVersion;
  await visit.save({ session: dbSession });
  
  await appendTimelineEvent(visit._id, "SUMMARY_UPDATED", `Visit summary updated to version ${nextVersion}.`, { version: nextVersion }, dbSession);
  
  setImmediate(async () => {
    try {
      const { dispatchToUser } = await import("../realtime/event_dispatcher.js");
      await dispatchToUser(visit.patientId, "EMR_UPDATED", { visitId: visit._id, version: nextVersion });
    } catch (err) {
      console.error("Failed to emit EMR_UPDATED realtime event:", err);
    }
  });

  return visit;
};
