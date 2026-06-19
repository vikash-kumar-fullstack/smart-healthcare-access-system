import mongoose from "mongoose";
import Queue from "./queue.model.js";
import QueueSession from "./queueSession.model.js";
import { createNotification } from "../notification/notification.service.js";
import Doctor from "../doctor/doctor.model.js";
import BookingCredit from "./booking_credit.model.js";
import PatientStats from "./patient_stats.model.js";
import AuditLog from "./audit_log.model.js";
import DoctorSchedule from "../doctor/doctor_schedule.model.js";
import DoctorScheduleOverride from "../doctor/doctor_schedule_override.model.js";
import DoctorAvailabilityLog from "../doctor/doctor_availability_log.model.js";
import DoctorAnalyticsDaily from "../doctor/doctor_analytics_daily.model.js";
import { incrementSystemMetric } from "../doctor/system_monitoring.model.js";

// ─── IST-safe "today" date string ────────────────────────────────────────────
const getTodayIST = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const getPeriodBounds = (dateStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  start.setMinutes(start.getMinutes() - 330);
  const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  end.setMinutes(end.getMinutes() - 330);
  return { start, end };
};

export const incrementDailyAnalytics = async (doctorId, dateStr, updateObj, dbSession = null) => {
  const startTimer = Date.now();
  const { start, end } = getPeriodBounds(dateStr);
  const query = { doctorId, date: dateStr };
  const update = {
    $setOnInsert: {
      periodStartAt: start,
      periodEndAt: end
    },
    ...updateObj
  };
  const options = { upsert: true, returnDocument: "after" };
  if (dbSession) {
    options.session = dbSession;
  }
  const result = await DoctorAnalyticsDaily.findOneAndUpdate(query, update, options);

  const elapsed = Date.now() - startTimer;
  await incrementSystemMetric("analytics_generation_ms", elapsed);

  return result;
};

// ─── Round to whole minutes — no floating point decimals ever shown ───────────
const roundMins = (mins) => Math.round(Math.max(mins, 0));

const findAlternateDoctor = async (doctor) => {
  if (!doctor?.specialization) return null;

  return Doctor.findOne({
    _id: { $ne: doctor._id },
    specialization: doctor.specialization,
    isAvailable: true
  })
    .sort({ rating: -1, experienceYears: -1 })
    .select("name specialization rating experienceYears avgConsultationTime")
    .lean();
};

// ─── Get or create today's or target date's session ───────────────────────────
const getOrCreateSession = async (doctorId, dateStr) => {
  const targetDate = dateStr || getTodayIST();
  let session = await QueueSession.findOne({ doctorId, date: targetDate });
  if (!session) {
    const doctor = await Doctor.findById(doctorId);
    let startTime = "09:00";
    let endTime = "18:00";
    let queueLimit = doctor?.defaultQueueLimit || 50;

    // Resolve schedule/override for targetDate
    const override = await DoctorScheduleOverride.findOne({ doctorId, date: targetDate });
    if (override) {
      if (override.enabled && !override.isFullDay) {
        startTime = override.startTime || startTime;
        endTime = override.endTime || endTime;
      }
    } else if (doctor) {
      const targetDayOfWeek = new Date(targetDate).getDay();
      const schedule = await DoctorSchedule.findOne({ doctorId, dayOfWeek: targetDayOfWeek });
      if (schedule && schedule.enabled) {
        startTime = schedule.startTime || startTime;
        endTime = schedule.endTime || endTime;
      }
    }

    session = await QueueSession.create({
      doctorId,
      date: targetDate,
      maxQueueLimit: queueLimit,
      scheduleSnapshot: {
        startTime,
        endTime,
        queueLimit
      },
      sessionStatus: "inactive",
      isActive: false
    });
  }
  return session;
};

// ─── Get or create patient stats helper ──────────────────────────────────────
export const getOrCreatePatientStats = async (userId, dbSession = null) => {
  const query = PatientStats.findOne({ userId });
  if (dbSession) query.session(dbSession);
  let stats = await query;
  if (!stats) {
    try {
      const opts = dbSession ? { session: dbSession } : {};
      const created = await PatientStats.create([{ userId }], opts);
      stats = created[0];
    } catch (err) {
      const fallbackQuery = PatientStats.findOne({ userId });
      if (dbSession) fallbackQuery.session(dbSession);
      stats = await fallbackQuery;
    }
  }
  return stats;
};

// ─── Calculate average consultation time today, weekly or fallback to doctor default ───
const calculateAvgConsultationTime = async (doctorId) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) return 5;

  const todayStr = getTodayIST();
  const session = await QueueSession.findOne({ doctorId, date: todayStr });
  if (session) {
    const todayCompleted = await Queue.find({
      doctorId,
      sessionId: session._id,
      status: "completed",
      startedAt: { $exists: true },
      completedAt: { $exists: true }
    });

    if (todayCompleted.length > 0) {
      let totalDurationMs = 0;
      for (const q of todayCompleted) {
        totalDurationMs += new Date(q.completedAt).getTime() - new Date(q.startedAt).getTime();
      }
      const calculated = totalDurationMs / 60000 / todayCompleted.length;
      return Math.min(90, Math.max(2, Math.round(calculated)));
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weeklyCompleted = await Queue.find({
    doctorId,
    status: "completed",
    completedAt: { $gte: sevenDaysAgo },
    startedAt: { $exists: true }
  });

  if (weeklyCompleted.length > 0) {
    let totalDurationMs = 0;
    for (const q of weeklyCompleted) {
      totalDurationMs += new Date(q.completedAt).getTime() - new Date(q.startedAt).getTime();
    }
    const calculated = totalDurationMs / 60000 / weeklyCompleted.length;
    return Math.min(90, Math.max(2, Math.round(calculated)));
  }

  const defaultVal = doctor.avgConsultationTime || 5;
  return Math.min(90, Math.max(2, defaultVal));
};

// ─── IST datetime resolver helper ──────────────────────────────────────────
const getISTDateTime = (dateStr, timeStr) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  utcDate.setMinutes(utcDate.getMinutes() - 330); // IST is UTC+5:30
  return utcDate;
};

// ─── Shift start/end dates resolver helper (handles midnight crossing) ──────
const getShiftDates = (dateStr, startTime, endTime) => {
  const startMins = startTime.split(":").map(Number);
  const endMins = endTime.split(":").map(Number);
  
  const startVal = startMins[0] * 60 + startMins[1];
  const endVal = endMins[0] * 60 + endMins[1];
  
  const startDate = getISTDateTime(dateStr, startTime);
  let endDate = getISTDateTime(dateStr, endTime);
  
  if (startVal > endVal) {
    // Midnight crossing, end time is on the next day
    endDate.setDate(endDate.getDate() + 1);
  }
  
  return { startDate, endDate };
};

// ─── Calculate next available slot ──────────────────────────────────────────
const getNextAvailableSlot = async (doctorId, startDateStr) => {
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let currentDate = new Date(startDateStr);
  
  for (let i = 0; i < 8; i++) {
    const checkDateStr = currentDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    
    // 1. Check override
    const override = await DoctorScheduleOverride.findOne({ doctorId, date: checkDateStr });
    if (override) {
      if (override.enabled && !override.isFullDay) {
        const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : weekdays[currentDate.getDay()];
        return `${label} ${override.startTime}`;
      }
    } else {
      // 2. Check regular schedule
      const dayOfWeek = currentDate.getDay();
      const schedule = await DoctorSchedule.findOne({ doctorId, dayOfWeek });
      if (schedule && schedule.enabled) {
        const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : weekdays[dayOfWeek];
        return `${label} ${schedule.startTime}`;
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return "Next week";
};

// ═══════════════════════════════════════════════════════════════════════════════
//  BOOK QUEUE
// ═══════════════════════════════════════════════════════════════════════════════
export const bookQueue = async (userId, doctorId, bookingDate) => {
  const result = await executeBookQueue(userId, doctorId, bookingDate);
  if (result && result.canBook === false) {
    incrementSystemMetric("booking_block_count", 1).catch(err => {
      console.error("Failed to increment booking block count metric:", err);
    });
  }
  return result;
};

const executeBookQueue = async (userId, doctorId, bookingDate) => {
  const todayStr = getTodayIST();
  const bookingDateStr = bookingDate || todayStr;

  // ── 1. Prevent duplicate active booking (atomic - Lock 5 Idempotency) ───────
  const existing = await Queue.findOne({ userId, isActive: true });
  if (existing) {
    if (existing.doctorId.toString() === doctorId.toString()) {
      const session = await getOrCreateSession(doctorId, bookingDateStr);
      if (existing.sessionId.toString() === session._id.toString()) {
        const isRecentRetry = (Date.now() - new Date(existing.createdAt).getTime()) < 1500;
        if (isRecentRetry) {
          const Visit = mongoose.model("Visit");
          const visit = await Visit.findOne({ queueId: existing._id, deletedAt: null });
          const patientsAhead = await Queue.countDocuments({
            doctorId: existing.doctorId,
            sessionId: existing.sessionId,
            status: "waiting",
            queueNumber: { $lt: existing.queueNumber }
          });
          return {
            canBook: true,
            booking: {
              queueId: existing._id,
              status: existing.status,
              isPriority: existing.isPriority,
              patientsAhead,
              eta: null,
              visit
            },
            guidance: "Returning existing booking details (idempotent retry).",
            message: "You already have an active booking for this doctor."
          };
        }
      }
    }
    return {
      canBook: false,
      code: "DUPLICATE_BOOKING",
      reason: "You already have an active booking. Please complete or cancel it first.",
      action: "wait"
    };
  }

  // ── 2. Validate patient & check reliability / no-show limits from patient_stats ──
  const stats = await getOrCreatePatientStats(userId);
  if ((stats.reliabilityScore || 0) < 20) {
    return {
      canBook: false,
      code: "RELIABILITY_BLOCKED",
      reason: "Booking blocked due to low reliability score.",
      action: "choose_other_doctor"
    };
  }

  if ((stats.noShowCountThisMonth || 0) >= 3) {
    return {
      canBook: false,
      code: "RELIABILITY_BLOCKED",
      reason: "Booking blocked: monthly no-show limit exceeded.",
      action: "choose_other_doctor"
    };
  }

  // ── 3. Validate booking window ─────────────────────────────────────────────

  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDateStr)) {
    return {
      canBook: false,
      code: "BOOKING_WINDOW_LIMIT",
      reason: "Invalid booking date format. Use YYYY-MM-DD.",
      action: "choose_other_time"
    };
  }

  const todayDate = new Date(todayStr);
  const targetDate = new Date(bookingDateStr);
  const diffTime = targetDate.getTime() - todayDate.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0 || diffDays > 7) {
    return {
      canBook: false,
      code: "BOOKING_WINDOW_LIMIT",
      reason: "Booking is only allowed for today and up to 7 days in advance.",
      action: "choose_other_time"
    };
  }

  // ── 4. Validate doctor ─────────────────────────────────────────────────────
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) {
    return {
      canBook: false,
      code: "DOCTOR_OFFLINE",
      reason: "Doctor not found.",
      action: "choose_other_doctor"
    };
  }
  if (doctor.availabilityState === "unavailable") {
    return {
      canBook: false,
      code: "DOCTOR_OFFLINE",
      reason: "This doctor is currently offline and not accepting patients.",
      action: "choose_other_doctor",
      nextAvailable: await getNextAvailableSlot(doctorId, bookingDateStr)
    };
  }

  // ── 5. Check schedules and full-day overrides for target booking date ─────
  let startTime = null;
  let endTime = null;
  let isScheduled = false;

  const override = await DoctorScheduleOverride.findOne({ doctorId, date: bookingDateStr });
  if (override) {
    if (override.enabled && !override.isFullDay) {
      startTime = override.startTime;
      endTime = override.endTime;
      isScheduled = true;
    }
  } else {
    const dayOfWeek = targetDate.getDay();
    const schedule = await DoctorSchedule.findOne({ doctorId, dayOfWeek });
    if (schedule && schedule.enabled) {
      startTime = schedule.startTime;
      endTime = schedule.endTime;
      isScheduled = true;
    }
  }

  if (!isScheduled || !startTime || !endTime) {
    return {
      canBook: false,
      code: "OUTSIDE_SHIFT",
      reason: "Doctor has no scheduled operating hours on this date.",
      action: "choose_other_time",
      nextAvailable: await getNextAvailableSlot(doctorId, bookingDateStr)
    };
  }

  // If booking is for today, check if shift end has already passed (including midnight crossing)
  if (bookingDateStr === todayStr) {
    const { endDate } = getShiftDates(bookingDateStr, startTime, endTime);
    if (new Date() > endDate) {
      return {
        canBook: false,
        code: "OUTSIDE_SHIFT",
        reason: "The scheduled operating hours for this doctor have already ended for today.",
        action: "choose_other_time",
        nextAvailable: await getNextAvailableSlot(doctorId, bookingDateStr)
      };
    }
  }

  // ── 6. Get or create session for the booking date ─────────────────────────
  const session = await getOrCreateSession(doctorId, bookingDateStr);

  if (session.sessionStatus === "closed" || session.sessionStatus === "closing") {
    return {
      canBook: false,
      code: "SESSION_CLOSED",
      reason: "This doctor's session has ended for today. Please book for tomorrow.",
      action: "choose_other_time",
      nextAvailable: await getNextAvailableSlot(doctorId, bookingDateStr)
    };
  }

  // ── 7. Check queue capacity snapshot ───────────────────────────────────────
  const activeCount = await Queue.countDocuments({
    doctorId,
    sessionId: session._id,
    isActive: true
  });
  const limit = session.maxQueueLimit || doctor.defaultQueueLimit || 50;
  if (activeCount >= limit) {
    return {
      canBook: false,
      code: "QUEUE_FULL",
      reason: `Queue is full (${limit} patients). Please try another doctor or come tomorrow.`,
      action: "choose_other_doctor",
      nextAvailable: await getNextAvailableSlot(doctorId, bookingDateStr)
    };
  }

  // ── 8. Assign queue number atomically ─────────────────────────────────────
  const updatedSession = await QueueSession.findByIdAndUpdate(
    session._id,
    { $inc: { currentQueueNumber: 1 } },
    { returnDocument: "after" }
  );
  const queueNumber = updatedSession.currentQueueNumber;

  // ── 9. Check Priority Credit consumption & cleanup expired credits ────────
  await BookingCredit.updateMany(
    { userId, used: false, expired: false, expiresAt: { $lte: new Date() } },
    { $set: { expired: true } }
  );

  const activeCredit = await BookingCredit.findOne({
    userId,
    used: false,
    expired: false,
    expiresAt: { $gt: new Date() }
  });

  let isPriority = false;
  if (activeCredit) {
    isPriority = true;
    activeCredit.used = true;
    await activeCredit.save();
  }

  // ── 10. Create queue entry ─────────────────────────────────────────────────
  let queue;
  try {
    queue = await Queue.create({
      userId,
      doctorId,
      sessionId: session._id,
      queueNumber,
      status: "waiting",
      isPriority
    });
  } catch (err) {
    if (err.code === 11000) {
      return {
        canBook: false,
        code: "DUPLICATE_BOOKING",
        reason: "You already have an active booking. Please complete or cancel it first.",
        action: "wait"
      };
    }
    throw err;
  }

  // Create corresponding Visit (using dynamic import to prevent circular dependency)
  const { createVisit } = await import("../visit/visit.service.js");
  const visit = await createVisit(
    queue._id,
    userId,
    doctorId,
    session._id,
    bookingDateStr
  );

  // ── 10. Compute guidance & ETA based on session state (NO visible reordering) ──
  const ss = session.sessionStatus;
  let estimatedWaitTime = null;
  let guidance = "";

  const patientsAhead = await Queue.countDocuments({
    doctorId,
    sessionId: session._id,
    status: "waiting",
    queueNumber: { $lt: queueNumber }
  });

  if (ss === "active") {
    const current = await Queue.findOne({
      doctorId,
      sessionId: session._id,
      status: "in_progress"
    });

    let remainingTime = 0;
    const avgTime = await calculateAvgConsultationTime(doctorId);
    if (current?.startedAt) {
      const elapsed = (Date.now() - new Date(current.startedAt).getTime()) / 60000;
      remainingTime = Math.max(avgTime - elapsed, 0);
    }
    estimatedWaitTime = roundMins(remainingTime + patientsAhead * avgTime);

    if (patientsAhead === 0) guidance = "You are next! Please proceed to the doctor.";
    else if (patientsAhead <= 2) guidance = "Your turn is coming soon. Please be nearby.";
    else guidance = "You can arrive closer to your estimated time.";

  } else if (ss === "paused") {
    guidance = "Doctor is on a short break. Your spot is saved — please wait nearby.";
  } else {
    guidance = "Session hasn't started yet. Please arrive before the session begins.";
  }

  // ── 11. Notify patient ─────────────────────────────────────────────────────
  await createNotification(
    userId,
    isPriority ? "Priority Booking Confirmed 🌟" : "Booking Confirmed ✅",
    `Booking confirmed with Dr. ${doctor.name}.${isPriority ? " Priority credit applied." : ""}`,
    "booking",
    {
      category: "queue",
      eventType: "booking_confirmed",
      aggregateType: "Queue",
      aggregateId: queue._id,
      metadata: { route: "/queue", entityId: queue._id.toString() }
    }
  ).catch(() => {});

  // Expose ONLY patientsAhead, eta, status to patient
  return {
    canBook: true,
    booking: {
      queueId: queue._id,
      status: queue.status,
      isPriority: queue.isPriority,
      patientsAhead,
      eta: estimatedWaitTime,
      visit
    },
    timing: {
      estimatedWaitTime,
      sessionStatus: ss
    },
    guidance,
    message:
      ss === "active"
        ? "Booking confirmed. Track your live queue status."
        : ss === "paused"
        ? "Booking confirmed. Doctor is on a break — expect a short delay."
        : "Booking confirmed. ETA will show once the doctor starts the session."
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  START SESSION  (inactive → active)
// ═══════════════════════════════════════════════════════════════════════════════
export const startSession = async (doctorId) => {
  const session = await getOrCreateSession(doctorId);

  if (session.sessionStatus === "closed") {
    throw Object.assign(new Error("Session is already closed for today."), { status: 400 });
  }
  if (session.sessionStatus === "active") {
    throw Object.assign(new Error("Session is already active."), { status: 400 });
  }
  if (session.sessionStatus === "paused") {
    throw Object.assign(new Error("Session is paused. Please resume instead."), { status: 400 });
  }

  session.sessionStatus = "active";
  session.isActive = true;
  session.startedAt = session.startedAt || new Date();
  session.lastActiveSegmentStartedAt = new Date();
  session.pausedAt = undefined;
  await session.save();

  // Sync scheduled visits to waiting
  const Visit = mongoose.model("Visit");
  const { appendTimelineEvent } = await import("../visit/visit.service.js");
  const scheduledVisits = await Visit.find({ sessionId: session._id, status: "scheduled", deletedAt: null });
  for (const v of scheduledVisits) {
    v.status = "waiting";
    await v.save();
    await appendTimelineEvent(v._id, "QUEUE_UPDATED", "Visit status updated to waiting because session started.");
  }

  // Audit log
  await AuditLog.create({ doctorId, action: "start_session" });

  // Move first waiting patient (respecting priority selection) to in_progress
  const first = await Queue.findOne({
    doctorId,
    sessionId: session._id,
    status: "waiting"
  }).sort({ isPriority: -1, queueNumber: 1 });

  if (first) {
    first.status = "in_progress";
    first.startedAt = new Date();
    await first.save();
    await createNotification(
      first.userId,
      "Your Turn Has Started 🏥",
      `Dr. ${(await Doctor.findById(doctorId))?.name}'s session started. Please proceed now.`,
      "update",
      {
        category: "queue",
        eventType: "turn_started",
        aggregateType: "Queue",
        aggregateId: first._id,
        metadata: { route: "/queue", entityId: first._id.toString() }
      }
    ).catch(() => {});
  }

  return {
    message: "Session started successfully.",
    firstPatient: first ? { name: first.userId, queueNumber: first.queueNumber } : null,
    totalWaiting: await Queue.countDocuments({
      doctorId, sessionId: session._id, status: "waiting"
    })
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  PAUSE SESSION  (active → paused)
// ═══════════════════════════════════════════════════════════════════════════════
export const pauseSession = async (doctorId) => {
  const today = getTodayIST();
  const session = await QueueSession.findOne({ doctorId, date: today });

  if (!session) throw Object.assign(new Error("No session found for today."), { status: 404 });
  if (session.sessionStatus !== "active") {
    throw Object.assign(new Error("Session must be active to pause."), { status: 400 });
  }

  const activeDeltaMs = Date.now() - new Date(session.lastActiveSegmentStartedAt || session.startedAt || Date.now()).getTime();
  const activeDeltaMins = Math.round(Math.max(activeDeltaMs / 60000, 0));

  session.sessionStatus = "paused";
  session.isActive = false;
  session.pausedAt = new Date();
  await session.save();

  if (activeDeltaMins > 0) {
    const todayIST = getTodayIST();
    setImmediate(() => {
      incrementDailyAnalytics(
        doctorId,
        todayIST,
        { $inc: { activeSessionMinutes: activeDeltaMins } }
      ).catch(err => {
        console.error("Failed to update daily analytics in background:", err);
      });
    });
  }

  // Log transition to DoctorAvailabilityLog
  const previousLog = await DoctorAvailabilityLog.findOne({
    doctorId,
    endedAt: { $exists: false }
  }).sort({ startedAt: -1 });

  if (previousLog) {
    previousLog.endedAt = new Date();
    previousLog.durationMs = previousLog.endedAt - previousLog.startedAt;
    await previousLog.save();
  }

  await DoctorAvailabilityLog.create({
    doctorId,
    sessionId: session._id,
    eventType: "session_pause",
    state: "break",
    startedAt: new Date()
  });

  // Audit log
  await AuditLog.create({ doctorId, action: "pause_session" });

  // Notify all waiting and in-progress patients
  const affected = await Queue.find({
    doctorId,
    sessionId: session._id,
    status: { $in: ["waiting", "in_progress"] },
    isActive: true
  }).select("userId");

  await Promise.allSettled(
    affected.map(p =>
      createNotification(
        p.userId,
        "Doctor on a Short Break ⏸",
        "The doctor is taking a brief break. Please wait nearby — session will resume shortly.",
        "update",
        {
          category: "session",
          eventType: "session_paused",
          aggregateType: "QueueSession",
          aggregateId: session._id,
          dedupeKey: `pause_${doctorId}_${p.userId}`,
          metadata: { route: "/queue", entityId: session._id.toString() }
        }
      )
    )
  );

  return {
    message: "Session paused. All waiting patients have been notified.",
    affectedPatients: affected.length
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  RESUME SESSION  (paused → active)
// ═══════════════════════════════════════════════════════════════════════════════
export const resumeSession = async (doctorId) => {
  const today = getTodayIST();
  const session = await QueueSession.findOne({ doctorId, date: today });

  if (!session) throw Object.assign(new Error("No session found for today."), { status: 404 });
  if (session.sessionStatus !== "paused") {
    throw Object.assign(new Error("Session must be paused to resume."), { status: 400 });
  }

  const pausedDuration = session.pausedAt ? Date.now() - new Date(session.pausedAt).getTime() : 0;
  const pausedDeltaMins = Math.round(Math.max(pausedDuration / 60000, 0));

  session.accumulatedPausedMs = (session.accumulatedPausedMs || 0) + pausedDuration;
  session.sessionStatus = "active";
  session.isActive = true;
  session.lastActiveSegmentStartedAt = new Date();
  session.pausedAt = undefined;
  await session.save();

  if (pausedDeltaMins > 0) {
    const todayIST = getTodayIST();
    setImmediate(() => {
      incrementDailyAnalytics(
        doctorId,
        todayIST,
        { $inc: { pausedMinutes: pausedDeltaMins } }
      ).catch(err => {
        console.error("Failed to update daily analytics in background:", err);
      });
    });
  }

  // Log transition to DoctorAvailabilityLog
  const previousLog = await DoctorAvailabilityLog.findOne({
    doctorId,
    endedAt: { $exists: false }
  }).sort({ startedAt: -1 });

  if (previousLog) {
    previousLog.endedAt = new Date();
    previousLog.durationMs = previousLog.endedAt - previousLog.startedAt;
    await previousLog.save();
  }

  await DoctorAvailabilityLog.create({
    doctorId,
    sessionId: session._id,
    eventType: "session_resume",
    state: "available",
    startedAt: new Date()
  });

  // Audit log
  await AuditLog.create({ doctorId, action: "resume_session" });

  // If no patient currently in_progress, pull the next waiting one (respecting priority selection)
  const alreadyInProgress = await Queue.findOne({
    doctorId,
    sessionId: session._id,
    status: "in_progress"
  });

  let resumed = null;
  if (!alreadyInProgress) {
    const next = await Queue.findOne({
      doctorId,
      sessionId: session._id,
      status: "waiting"
    }).sort({ isPriority: -1, queueNumber: 1 });

    if (next) {
      next.status = "in_progress";
      next.startedAt = new Date();
      await next.save();
      resumed = next;
    await createNotification(
      next.userId,
      "Doctor Resumed — Your Turn! 🏥",
      "The doctor is back. Please proceed to the consultation room now.",
      "update",
      {
        category: "queue",
        eventType: "turn_started",
        aggregateType: "Queue",
        aggregateId: next._id,
        metadata: { route: "/queue", entityId: next._id.toString() }
      }
    ).catch(() => {});
  }
}

// Notify remaining waiting patients
const waiting = await Queue.find({
  doctorId,
  sessionId: session._id,
  status: "waiting",
  isActive: true
}).select("userId");

await Promise.allSettled(
  waiting.map(p =>
    createNotification(
      p.userId,
      "Doctor Resumed ▶",
      "The doctor has resumed. Queue is moving again.",
      "update",
      {
        category: "session",
        eventType: "session_resumed",
        aggregateType: "QueueSession",
        aggregateId: session._id,
        dedupeKey: `resume_${doctorId}_${p.userId}`,
        metadata: { route: "/queue", entityId: session._id.toString() }
      }
    )
  )
);

  return {
    message: "Session resumed.",
    resumedPatient: resumed ? { queueNumber: resumed.queueNumber } : null
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CLOSE SESSION  (active | paused → closed)
// ═══════════════════════════════════════════════════════════════════════════════
export const closeSession = async (doctorId) => {
  const today = getTodayIST();
  const session = await QueueSession.findOne({ doctorId, date: today });

  if (!session) throw Object.assign(new Error("No session found for today."), { status: 404 });
  if (session.sessionStatus === "closed") {
    throw Object.assign(new Error("Session is already closed."), { status: 400 });
  }
  if (session.sessionStatus === "inactive") {
    throw Object.assign(new Error("Cannot close a session that was never started."), { status: 400 });
  }

  // ── Edge Case: Disable closing if a consultation is in progress ──
  const inProgressPatient = await Queue.findOne({
    doctorId,
    sessionId: session._id,
    status: "in_progress"
  });
  if (inProgressPatient) {
    throw Object.assign(
      new Error("Cannot close session while a patient consultation is in progress. Please complete or skip the current patient first."),
      { status: 400 }
    );
  }

  const now = new Date();
  let activeDeltaMins = 0;
  let pausedDeltaMins = 0;

  if (session.sessionStatus === "active") {
    const activeDeltaMs = now.getTime() - new Date(session.lastActiveSegmentStartedAt || session.startedAt || now).getTime();
    activeDeltaMins = Math.round(Math.max(activeDeltaMs / 60000, 0));
  } else if (session.sessionStatus === "paused" && session.pausedAt) {
    const pausedDuration = now.getTime() - new Date(session.pausedAt).getTime();
    pausedDeltaMins = Math.round(Math.max(pausedDuration / 60000, 0));
    session.accumulatedPausedMs = (session.accumulatedPausedMs || 0) + pausedDuration;
  }

  session.sessionStatus = "closed";
  session.isActive = false;
  session.pausedAt = undefined;
  session.closedAt = now;
  await session.save();

  const todayIST = getTodayIST();
  if (activeDeltaMins > 0 || pausedDeltaMins > 0) {
    setImmediate(() => {
      incrementDailyAnalytics(
        doctorId,
        todayIST,
        {
          $inc: {
            activeSessionMinutes: activeDeltaMins,
            pausedMinutes: pausedDeltaMins
          }
        }
      ).catch(err => {
        console.error("Failed to update daily analytics in background:", err);
      });
    });
  }

  // Audit log
  await AuditLog.create({ doctorId, action: "close_session" });

  // Cancel all remaining waiting patients
  const remaining = await Queue.find({
    doctorId,
    sessionId: session._id,
    status: "waiting",
    isActive: true
  });

  await Promise.all(
    remaining.map(async (p) => {
      p.status = "cancelled";
      p.isActive = false;
      p.cancelledAt = new Date();
      p.cancelReason = "session_closed";

      const runAnalytics = !p.analyticsProcessed;
      if (runAnalytics) {
        p.analyticsProcessed = true;
      }
      await p.save();

      // Sync corresponding Visit to cancelled due to session_closed
      const Visit = mongoose.model("Visit");
      const { appendTimelineEvent } = await import("../visit/visit.service.js");
      const visit = await Visit.findOne({ queueId: p._id, deletedAt: null });
      if (visit) {
        visit.status = "cancelled";
        visit.visitOutcome = "session_closed";
        visit.endedAt = new Date();
        await visit.save();
        await appendTimelineEvent(visit._id, "VISIT_CANCELLED", "Visit cancelled due to session close.", {});
      }

      if (runAnalytics) {
        const todayIST = getTodayIST();
        setImmediate(() => {
          incrementDailyAnalytics(
            doctorId,
            todayIST,
            { $inc: { cancelled: 1 } }
          ).catch(err => {
            console.error("Failed to update daily analytics in background:", err);
          });
        });
      }

      // Issue Priority Credit (expires in 48 hours)
      await BookingCredit.create({
        userId: p.userId,
        credits: 1,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        reason: "session_closed"
      });

      // Update patient stats
      const pStats = await getOrCreatePatientStats(p.userId);
      pStats.cancelledVisits = (pStats.cancelledVisits || 0) + 1;
      await pStats.save();

      await createNotification(
        p.userId,
        "Session Closed — Booking Cancelled ❌",
        "The doctor has ended today's session. Your booking was auto-cancelled and you have received a 48-hour priority credit for your next booking.",
        "alert",
        {
          category: "session",
          eventType: "session_closed",
          aggregateType: "Queue",
          aggregateId: p._id,
          metadata: { route: "/queue", entityId: p._id.toString() }
        }
      ).catch(() => {});
    })
  );

  return {
    message: "Session closed for today.",
    cancelledPatients: remaining.length
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  COMPLETE PATIENT (Atomic Transaction)
// ═══════════════════════════════════════════════════════════════════════════════
export const completeQueue = async (queueId, doctorId) => {
  if (!queueId) {
    throw Object.assign(new Error("Queue ID is required."), { status: 400 });
  }

  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();
  try {
    const current = await Queue.findOne({ _id: queueId, doctorId }).session(mongooseSession);
    if (!current || current.status !== "in_progress") {
      throw Object.assign(new Error("No patient is currently in progress."), { status: 400 });
    }

    const now = new Date();
    const durationMs = now.getTime() - new Date(current.startedAt).getTime();
    current.status = "completed";
    current.closedReason = "completed";
    current.completedAt = now;
    current.consultationDurationMs = durationMs;
    current.isActive = false;

    // Idempotent analytics check
    const runAnalytics = !current.analyticsProcessed;
    if (runAnalytics) {
      current.analyticsProcessed = true;
    }

    await current.save({ session: mongooseSession });

    let analyticsData = null;
    if (runAnalytics) {
      const todayIST = getTodayIST();
      const completedCount = await Queue.countDocuments({
        doctorId,
        userId: current.userId,
        status: "completed"
      }).session(mongooseSession);

      let uInc = 0;
      let rInc = 0;
      if (completedCount === 1) {
        uInc = 1;
      } else if (completedCount === 2) {
        rInc = 1;
      }

      const waitMs = new Date(current.startedAt).getTime() - new Date(current.createdAt).getTime();
      const waitMins = Math.round(Math.max(waitMs / 60000, 0));
      const consultMins = Math.round(Math.max(durationMs / 60000, 0));

      analyticsData = {
        doctorId,
        todayIST,
        update: {
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
      };
    }

    // Update patient stats (+1 completed, +2 reliability)
    const stats = await getOrCreatePatientStats(current.userId, mongooseSession);
    stats.completedVisits = (stats.completedVisits || 0) + 1;
    stats.reliabilityScore = Math.min(100, (stats.reliabilityScore || 100) + 2);
    await stats.save({ session: mongooseSession });

    // Log audit
    await AuditLog.create([{
      doctorId,
      action: "completed",
      queueId: current._id
    }], { session: mongooseSession });

    // Auto-advance selection (priority first, then queueNumber chronological)
    const next = await Queue.findOne({
      doctorId: current.doctorId,
      sessionId: current.sessionId,
      status: "waiting"
    }).sort({ isPriority: -1, queueNumber: 1 }).session(mongooseSession);

    if (next) {
      next.status = "in_progress";
      next.startedAt = new Date();
      await next.save({ session: mongooseSession });

      // Lock 1: Insert notification into outbox inside the transaction
      await createNotification(
        next.userId,
        "Your Turn Has Started 🏥",
        "The previous patient is done. Please proceed to the doctor now.",
        "update",
        {
          session: mongooseSession,
          aggregateType: "Queue",
          aggregateId: next._id,
          eventType: "turn_started",
          metadata: { route: "/queue", entityId: next._id.toString() }
        }
      );
    }

    await mongooseSession.commitTransaction();
    mongooseSession.endSession();

    if (analyticsData) {
      setImmediate(() => {
        incrementDailyAnalytics(
          analyticsData.doctorId,
          analyticsData.todayIST,
          analyticsData.update
        ).catch(err => {
          console.error("Failed to update daily analytics in background:", err);
        });
      });
    }

    return {
      message: "Patient consultation completed.",
      nextPatient: next ? { queueNumber: next.queueNumber } : null,
      queueEmpty: !next
    };
  } catch (error) {
    await mongooseSession.abortTransaction();
    mongooseSession.endSession();
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  SKIP PATIENT (Atomic Transaction)
// ═══════════════════════════════════════════════════════════════════════════════
export const skipQueue = async (queueId, doctorId) => {
  if (!queueId) {
    throw Object.assign(new Error("Queue ID is required."), { status: 400 });
  }

  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();
  try {
    const current = await Queue.findOne({ _id: queueId, doctorId }).session(mongooseSession);
    if (!current || current.status !== "in_progress") {
      throw Object.assign(new Error("No patient is currently in progress."), { status: 400 });
    }

    current.status = "skipped";
    current.closedReason = "skipped";
    current.isActive = false;

    // Idempotent analytics check
    const runAnalytics = !current.analyticsProcessed;
    if (runAnalytics) {
      current.analyticsProcessed = true;
    }

    await current.save({ session: mongooseSession });

    let analyticsData = null;
    if (runAnalytics) {
      const todayIST = getTodayIST();
      analyticsData = {
        doctorId,
        todayIST,
        update: { $inc: { skipped: 1 } }
      };
    }

    // Log audit
    await AuditLog.create([{
      doctorId,
      action: "skipped",
      queueId: current._id
    }], { session: mongooseSession });

    // Auto-advance selection
    const next = await Queue.findOne({
      doctorId: current.doctorId,
      sessionId: current.sessionId,
      status: "waiting"
    }).sort({ isPriority: -1, queueNumber: 1 }).session(mongooseSession);

    // Lock 1: Insert outbox notification for skipped patient
    await createNotification(
      current.userId,
      "Turn Skipped",
      "Your queue turn was skipped. Please contact the hospital desk if you are still nearby.",
      "alert",
      {
        session: mongooseSession,
        aggregateType: "Queue",
        aggregateId: current._id,
        eventType: "turn_skipped",
        metadata: { route: "/queue", entityId: current._id.toString() }
      }
    );

    if (next) {
      next.status = "in_progress";
      next.startedAt = new Date();
      await next.save({ session: mongooseSession });

      // Lock 1: Insert outbox notification for advanced patient
      await createNotification(
        next.userId,
        "Your Turn Has Started 🏥",
        "Please proceed to the doctor now.",
        "update",
        {
          session: mongooseSession,
          aggregateType: "Queue",
          aggregateId: next._id,
          eventType: "turn_started",
          metadata: { route: "/queue", entityId: next._id.toString() }
        }
      );
    }

    await mongooseSession.commitTransaction();
    mongooseSession.endSession();

    if (analyticsData) {
      setImmediate(() => {
        incrementDailyAnalytics(
          analyticsData.doctorId,
          analyticsData.todayIST,
          analyticsData.update
        ).catch(err => {
          console.error("Failed to update daily analytics in background:", err);
        });
      });
    }

    return {
      message: "Patient skipped.",
      nextPatient: next ? { queueNumber: next.queueNumber } : null
    };
  } catch (error) {
    await mongooseSession.abortTransaction();
    mongooseSession.endSession();
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MARK PATIENT NO-SHOW (Atomic Transaction)
// ═══════════════════════════════════════════════════════════════════════════════
export const markPatientNoShow = async (queueId, doctorId) => {
  if (!queueId) {
    throw Object.assign(new Error("Queue ID is required."), { status: 400 });
  }

  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();
  try {
    const current = await Queue.findOne({ _id: queueId, doctorId }).session(mongooseSession);
    if (!current || current.status !== "in_progress") {
      throw Object.assign(new Error("No patient is currently in progress."), { status: 400 });
    }

    current.status = "no_show";
    current.closedReason = "no_show";
    current.isActive = false;

    // Idempotent analytics check
    const runAnalytics = !current.analyticsProcessed;
    if (runAnalytics) {
      current.analyticsProcessed = true;
    }

    await current.save({ session: mongooseSession });

    // Sync Visit to no_show
    const Visit = mongoose.model("Visit");
    const { appendTimelineEvent } = await import("../visit/visit.service.js");
    const visit = await Visit.findOne({ queueId: current._id, deletedAt: null }).session(mongooseSession);
    if (visit) {
      visit.status = "no_show";
      visit.visitOutcome = "no_show";
      visit.endedAt = new Date();
      await visit.save({ session: mongooseSession });
      await appendTimelineEvent(visit._id, "NO_SHOW", "Patient marked as no-show by doctor.", {}, mongooseSession);
    }

    let analyticsData = null;
    if (runAnalytics) {
      const todayIST = getTodayIST();
      analyticsData = {
        doctorId,
        todayIST,
        update: { $inc: { noShow: 1 } }
      };
    }

    // Deduct patient's reliability score (-15, or -30 if repeated)
    const stats = await getOrCreatePatientStats(current.userId, mongooseSession);
    const currentNoShows = stats.noShowCountThisMonth || 0;
    const penalty = currentNoShows > 0 ? 30 : 15;
    stats.reliabilityScore = Math.max(0, (stats.reliabilityScore || 100) - penalty);
    stats.noShowCount = (stats.noShowCount || 0) + 1;
    stats.noShowCountThisMonth = currentNoShows + 1;
    stats.lastNoShowAt = new Date();
    await stats.save({ session: mongooseSession });

    // Log audit
    await AuditLog.create([{
      doctorId,
      action: "no_show",
      queueId: current._id
    }], { session: mongooseSession });

    // Auto-advance selection
    const next = await Queue.findOne({
      doctorId: current.doctorId,
      sessionId: current.sessionId,
      status: "waiting"
    }).sort({ isPriority: -1, queueNumber: 1 }).session(mongooseSession);

    // Lock 1: Insert outbox notification for no-show patient
    await createNotification(
      current.userId,
      "Missed Call — Marked No-Show ⚠️",
      "You were not present when called by the doctor. Your booking has been marked as no-show.",
      "alert",
      {
        session: mongooseSession,
        aggregateType: "Queue",
        aggregateId: current._id,
        eventType: "no_show",
        metadata: { route: "/queue", entityId: current._id.toString() }
      }
    );

    if (next) {
      next.status = "in_progress";
      next.startedAt = new Date();
      await next.save({ session: mongooseSession });

      // Lock 1: Insert outbox notification for advanced patient
      await createNotification(
        next.userId,
        "Your Turn Has Started 🏥",
        "Please proceed to the doctor now.",
        "update",
        {
          session: mongooseSession,
          aggregateType: "Queue",
          aggregateId: next._id,
          eventType: "turn_started",
          metadata: { route: "/queue", entityId: next._id.toString() }
        }
      );
    }

    await mongooseSession.commitTransaction();
    mongooseSession.endSession();

    if (analyticsData) {
      setImmediate(() => {
        incrementDailyAnalytics(
          analyticsData.doctorId,
          analyticsData.todayIST,
          analyticsData.update
        ).catch(err => {
          console.error("Failed to update daily analytics in background:", err);
        });
      });
    }

    return {
      message: "Patient marked as no-show.",
      nextPatient: next ? { queueNumber: next.queueNumber } : null
    };
  } catch (error) {
    await mongooseSession.abortTransaction();
    mongooseSession.endSession();
    throw error;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  GET MY QUEUE (Patient View - Omit QueueNumber, return PatientsAhead and ETA)
// ═══════════════════════════════════════════════════════════════════════════════
export const getMyQueue = async (userId) => {
  const queue = await Queue.findOne({ userId, isActive: true })
    .populate("doctorId", "name avgConsultationTime")
    .populate("sessionId");

  if (!queue) {
    throw Object.assign(new Error("No active booking found."), { status: 404 });
  }

  const session = queue.sessionId;
  const sessionStatus = session?.sessionStatus || "inactive";
  const sessionActive = sessionStatus === "active";

  let eta = null;
  let isNext = false;

  // Chronological queue number comparison only
  const patientsAhead = await Queue.countDocuments({
    doctorId: queue.doctorId._id,
    sessionId: session._id,
    status: "waiting",
    queueNumber: { $lt: queue.queueNumber }
  });

  if (sessionActive) {
    const avgTime = await calculateAvgConsultationTime(queue.doctorId._id);

    const current = await Queue.findOne({
      doctorId: queue.doctorId._id,
      sessionId: session._id,
      status: "in_progress"
    });

    let remainingTime = 0;
    if (current?.startedAt) {
      const elapsed = (Date.now() - new Date(current.startedAt).getTime()) / 60000;
      remainingTime = Math.max(avgTime - elapsed, 0);
    }

    eta = roundMins(remainingTime + patientsAhead * avgTime);

    // Is this patient next in line?
    if (queue.status === "waiting" && current) {
      const nextInLine = await Queue.findOne({
        doctorId: queue.doctorId._id,
        sessionId: session._id,
        status: "waiting"
      }).sort({ isPriority: -1, queueNumber: 1 });

      isNext = nextInLine?._id.toString() === queue._id.toString();
    }
  }

  const VisitModel = mongoose.model("Visit");
  const visitDoc = await VisitModel.findOne({ queueId: queue._id, deletedAt: null });

  return {
    patientsAhead,
    eta,
    status: queue.status,
    doctorName: queue.doctorId.name,
    sessionStatus,
    sessionActive,
    isNext,
    visitId: visitDoc?._id || null,
    publicId: visitDoc?.publicId || null
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  GET DOCTOR QUEUE (Doctor View)
// ═══════════════════════════════════════════════════════════════════════════════
export const getDoctorQueue = async (doctorId) => {
  const today = getTodayIST();
  const session = await QueueSession.findOne({ doctorId, date: today });
  const doctor = await Doctor.findById(doctorId);

  if (!session || !doctor) {
    return {
      sessionState: "inactive",
      sessionStatus: "inactive",
      sessionActive: false,
      stats: {
        waiting: 0,
        completed: 0,
        skipped: 0,
        noShow: 0,
        remaining: 0
      },
      currentPatient: null,
      upcomingPatients: [],
      history: [],
      queue: [],
      totalPatients: 0
    };
  }

  // Find all queue entries for today's session
  const allPatients = await Queue.find({
    doctorId,
    sessionId: session._id
  })
    .populate("userId", "name")
    .sort({ queueNumber: 1 });

  let waiting = 0;
  let completed = 0;
  let skipped = 0;
  let noShow = 0;
  let remaining = 0;
  let cancelled = 0;

  let currentPatient = null;
  const upcomingPatients = [];
  const history = [];

  for (const q of allPatients) {
    const patientObj = {
      _id: q._id,
      name: q.userId?.name || "Unknown Patient",
      queueNumber: q.queueNumber,
      status: q.status,
      isPriority: q.isPriority || false,
      createdAt: q.createdAt,
      startedAt: q.startedAt,
      completedAt: q.completedAt
    };

    if (q.status === "in_progress") {
      currentPatient = patientObj;
      remaining++;
    } else if (q.status === "waiting") {
      upcomingPatients.push(patientObj);
      waiting++;
      remaining++;
    } else if (q.status === "completed") {
      history.push(patientObj);
      completed++;
    } else if (q.status === "skipped") {
      history.push(patientObj);
      skipped++;
    } else if (q.status === "no_show") {
      history.push(patientObj);
      noShow++;
    } else if (q.status === "cancelled") {
      cancelled++;
    }
  }

  // Sort upcoming patients chronologically (no reordering in visible queue)
  upcomingPatients.sort((a, b) => a.queueNumber - b.queueNumber);

  const avgTime = await calculateAvgConsultationTime(doctorId);

  // Compute wait times for upcoming list
  let currentPatientTimeRemaining = 0;
  if (currentPatient) {
    const elapsed = (Date.now() - new Date(currentPatient.startedAt).getTime()) / 60000;
    currentPatientTimeRemaining = Math.max(avgTime - elapsed, 0);
  }

  const upcomingPatientsListFormatted = upcomingPatients.map((patient, idx) => {
    const eta = roundMins(currentPatientTimeRemaining + idx * avgTime);
    return {
      _id: patient._id,
      name: patient.name,
      patientsAhead: idx,
      eta,
      isPriority: patient.isPriority,
      createdAt: patient.createdAt,
      status: patient.status
    };
  });

  // Sort history by completedAt desc, or just updatedAt desc
  history.sort((a, b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));

  // Current patient formatting
  let currentPatientObj = null;
  if (currentPatient) {
    const elapsed = Math.floor((Date.now() - new Date(currentPatient.startedAt).getTime()) / 1000);
    const remMins = Math.max(avgTime - (elapsed / 60), 0);

    currentPatientObj = {
      _id: currentPatient._id,
      name: currentPatient.name,
      patientsAhead: 0,
      elapsed,
      eta: roundMins(remMins),
      status: currentPatient.status,
      queueNumber: currentPatient.queueNumber
    };
  }

  // Backward compatibility fields
  const activeQueuesForCompat = [];
  if (currentPatient) {
    activeQueuesForCompat.push(currentPatient);
  }
  activeQueuesForCompat.push(...upcomingPatients);

  let activeDurationMs = 0;
  if (session.startedAt) {
    const end = session.closedAt || new Date();
    const elapsed = end.getTime() - new Date(session.startedAt).getTime();
    let pausedTime = session.accumulatedPausedMs || 0;
    if (session.sessionStatus === "paused" && session.pausedAt) {
      pausedTime += Date.now() - new Date(session.pausedAt).getTime();
    }
    activeDurationMs = Math.max(elapsed - pausedTime, 0);
  }

  const totalProcessed = completed + skipped + noShow + cancelled;
  const completionRate = totalProcessed > 0
    ? Math.round((completed / totalProcessed) * 100)
    : 100;

  return {
    sessionState: session.sessionStatus,
    sessionStatus: session.sessionStatus, // backward compat
    sessionActive: session.isActive, // backward compat
    sessionStartedAt: session.startedAt || null,
    activeDurationMs,
    serverNow: new Date(),
    stats: {
      waiting,
      completed,
      skipped,
      noShow,
      remaining,
      avgConsultationTime: avgTime,
      completionRate
    },
    currentPatient: currentPatientObj,
    upcomingPatients: upcomingPatientsListFormatted,
    history,
    queue: activeQueuesForCompat, // backward compat
    totalPatients: allPatients.length
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  CANCEL QUEUE (Patient)
// ═══════════════════════════════════════════════════════════════════════════════
export const cancelQueue = async (userId) => {
  const queue = await Queue.findOne({ userId, isActive: true });
  if (!queue) throw Object.assign(new Error("No active booking found."), { status: 404 });
  if (queue.status === "cancelled") {
    throw Object.assign(new Error("Booking is already cancelled."), { status: 400 });
  }

  const wasInProgress = queue.status === "in_progress";

  queue.status = "cancelled";
  queue.isActive = false;
  queue.cancelledAt = new Date();
  queue.cancelReason = "patient_cancelled";

  // Idempotent analytics check
  const runAnalytics = !queue.analyticsProcessed;
  if (runAnalytics) {
    queue.analyticsProcessed = true;
  }

  await queue.save();

  // Sync Visit to cancelled
  const Visit = mongoose.model("Visit");
  const { appendTimelineEvent } = await import("../visit/visit.service.js");
  const visit = await Visit.findOne({ queueId: queue._id, deletedAt: null });
  if (visit) {
    visit.status = "cancelled";
    visit.visitOutcome = "cancelled";
    visit.endedAt = new Date();
    await visit.save();
    await appendTimelineEvent(visit._id, "VISIT_CANCELLED", "Visit cancelled by patient.", {});
  }

  if (runAnalytics) {
    const todayIST = getTodayIST();
    setImmediate(() => {
      incrementDailyAnalytics(
        queue.doctorId,
        todayIST,
        { $inc: { cancelled: 1 } }
      ).catch(err => {
        console.error("Failed to update daily analytics in background:", err);
      });
    });
  }

  // early cancel penalty (-1 reliability score)
  const stats = await getOrCreatePatientStats(userId);
  stats.cancelledVisits = (stats.cancelledVisits || 0) + 1;
  stats.reliabilityScore = Math.max(0, (stats.reliabilityScore || 100) - 1);
  await stats.save();

  // If they were in-progress, advance queue
  const session = await QueueSession.findById(queue.sessionId);
  if (wasInProgress && session?.sessionStatus === "active") {
    const next = await Queue.findOne({
      doctorId: queue.doctorId,
      sessionId: queue.sessionId,
      status: "waiting"
    }).sort({ isPriority: -1, queueNumber: 1 });

    if (next) {
      next.status = "in_progress";
      next.startedAt = new Date();
      await next.save();
      await createNotification(
        next.userId,
        "Your Turn Has Started 🏥",
        "Please proceed to the doctor now.",
        "update",
        {
          category: "queue",
          eventType: "turn_started",
          aggregateType: "Queue",
          aggregateId: next._id,
          metadata: { route: "/queue", entityId: next._id.toString() }
        }
      ).catch(() => {});
    }
  }

  await createNotification(
    userId,
    "Booking Cancelled",
    "Your booking has been successfully cancelled.",
    "alert",
    {
      category: "queue",
      eventType: "booking_cancelled",
      aggregateType: "Queue",
      aggregateId: queue._id,
      metadata: { route: "/queue", entityId: queue._id.toString() }
    }
  ).catch(() => {});

  return { message: "Booking cancelled successfully." };
};

// ═══════════════════════════════════════════════════════════════════════════════
//  QUEUE HISTORY (Patient - Omit QueueNumber)
// ═══════════════════════════════════════════════════════════════════════════════
export const getQueueHistory = async (userId) => {
  const history = await Queue.find({ userId, isActive: false })
    .populate("doctorId", "name specialization")
    .sort({ createdAt: -1 })
    .lean();

  const VisitModel = mongoose.model("Visit");
  return Promise.all(history.map(async q => {
    const visitDoc = await VisitModel.findOne({ queueId: q._id, deletedAt: null });
    const status = q.status;
    const outcomeMap = {
      completed: "Visited",
      cancelled: "Cancelled",
      skipped: "Missed",
      no_show: "No-Show"
    };
    return {
      queueId: q._id,
      doctorName: q.doctorId?.name,
      specialization: q.doctorId?.specialization,
      status,
      outcome: outcomeMap[status] || status,
      cancelReason: q.cancelReason || null,
      bookedAt: q.createdAt,
      completedAt: q.completedAt || null,
      cancelledAt: q.cancelledAt || null,
      skippedAt: status === "skipped" ? q.updatedAt : null,
      visitId: visitDoc?._id || null,
      publicId: visitDoc?.publicId || null
    };
  }));
};
