import Doctor from "./doctor.model.js";
import Queue from "../queue/queue.model.js";
import Hospital from "../hospital/hospital.model.js";
import QueueSession from "../queue/queueSession.model.js";
import DoctorSchedule from "./doctor_schedule.model.js";
import DoctorScheduleOverride from "./doctor_schedule_override.model.js";
import DoctorAvailabilityLog from "./doctor_availability_log.model.js";
import BookingCredit from "../queue/booking_credit.model.js";
import PatientStats from "../queue/patient_stats.model.js";
import { createNotification } from "../notification/notification.service.js";
import mongoose from "mongoose";
import DoctorAnalyticsDaily from "./doctor_analytics_daily.model.js";
import AnalyticsRebuildAuditLog from "./analytics_rebuild_audit_log.model.js";
import { incrementSystemMetric } from "./system_monitoring.model.js";

// ─── IST-safe date (same helper as queue.service.js) ─────────────────────────
const getTodayIST = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// ─── Round to whole minutes ───────────────────────────────────────────────────
const roundMins = (n) => Math.round(Math.max(n ?? 0, 0));

export const getNextAvailableSlot = async (doctorId, startDateStr) => {
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
//  GET DOCTORS
//  Production fix: single aggregation pipeline instead of N+1 queries.
//  Before: 3 DB queries per doctor (session, queueLoad, currentPatient).
//  After:  1 aggregation + 1 find — O(1) queries regardless of doctor count.
// ═══════════════════════════════════════════════════════════════════════════════
export const getDoctors = async (query) => {
  const { hospitalId, specialization } = query;

  // ── 1. Build doctor filter ─────────────────────────────────────────────────
  const doctorFilter = {};
  if (hospitalId)     doctorFilter.hospitalId     = new mongoose.Types.ObjectId(hospitalId);
  if (specialization) doctorFilter.specialization = specialization;

  const today = getTodayIST();

  // ── 2. Single aggregation: joins sessions + queue counts in one round trip ─
  const enriched = await Doctor.aggregate([
    { $match: doctorFilter },

    // Look up today's session for each doctor
    {
      $lookup: {
        from:     "queuesessions",
        let:      { doctorId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$doctorId", "$$doctorId"] },
                  { $eq: ["$date", today] }
                ]
              }
            }
          }
        ],
        as: "sessions"
      }
    },
    { $addFields: { session: { $arrayElemAt: ["$sessions", 0] } } },

    // Look up active queue entries for today's session
    {
      $lookup: {
        from:     "queues",
        let:      { sessionId: "$session._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$sessionId", "$$sessionId"] },
                  { $in: ["$status", ["waiting", "in_progress"]] }
                ]
              }
            }
          },
          { $sort: { queueNumber: 1 } }
        ],
        as: "activeQueue"
      }
    },

    // Compute derived fields
    {
      $addFields: {
        queueLoad:     { $size: "$activeQueue" },
        sessionStatus: { $ifNull: ["$session.sessionStatus", "inactive"] },
        // The in-progress patient (first match with status = in_progress)
        inProgressEntry: {
          $arrayElemAt: [
            {
              $filter: {
                input: "$activeQueue",
                as:    "q",
                cond:  { $eq: ["$$q.status", "in_progress"] }
              }
            },
            0
          ]
        }
      }
    },

    // Project only what we need going forward
    {
      $project: {
        name:               1,
        specialization:     1,
        hospitalId:         1,
        avgConsultationTime: { $ifNull: ["$avgConsultationTime", 5] },
        defaultQueueLimit:  { $ifNull: ["$defaultQueueLimit", 50] },
        isAvailable:        1,
        availabilityState:  { $ifNull: ["$availabilityState", "available"] },
        temporaryNotice:    1,
        rating:             1,
        experienceYears:    1,
        queueLoad:          1,
        sessionStatus:      1,
        inProgressEntry:    1,
        activeQueue:        1
      }
    }
  ]);

  // ── 3. Post-process in JS (no more DB calls) ───────────────────────────────
  const now = Date.now();

  const result = await Promise.all(enriched.map(async (doc) => {
    const ss      = doc.sessionStatus;
    const avgTime = doc.avgConsultationTime;
    const limit   = doc.defaultQueueLimit;

    // ETA calculation — only meaningful when session is active
    let estimatedWaitTime = 0;
    if (ss === "active" || ss === "paused") {
      let remainingTime = 0;
      if (doc.inProgressEntry?.startedAt) {
        const elapsed = (now - new Date(doc.inProgressEntry.startedAt)) / 60000;
        remainingTime = Math.max(avgTime - elapsed, 0);
      }
      const waitingBefore = Math.max(doc.queueLoad - 1, 0);
      estimatedWaitTime = roundMins(remainingTime + waitingBefore * avgTime);
    }

    // Decoupled availability calculation
    let computedAvailabilityState = doc.availabilityState || "available";
    let isDelayed = false;
    if (computedAvailabilityState === "break" && doc.temporaryNotice?.expectedUntil) {
      if (new Date(doc.temporaryNotice.expectedUntil).getTime() < Date.now()) {
        computedAvailabilityState = "delayed";
        isDelayed = true;
      }
    }

    // Booking availability:
    // - Doctor availabilityState must not be unavailable
    // - Session status must not be closed/closing
    // - Queue must have space
    const sessionAllowsBooking =
      ss === "active" || ss === "paused" || ss === "inactive";

    const isAvailable =
      computedAvailabilityState !== "unavailable" &&
      sessionAllowsBooking &&
      doc.queueLoad < limit;

    const nextAvailable = isAvailable ? null : await getNextAvailableSlot(doc._id, today);

    // Ranking score
    let score = 0;
    if (isAvailable)    score += 30;
    if (ss === "active") score += 20;
    score += Math.max(0, 60 - estimatedWaitTime);   // lower wait = higher score
    score += (doc.rating || 0) * 5;
    score += (doc.experienceYears || 0) * 0.5;

    return {
      id:               doc._id,
      name:             doc.name,
      specialization:   doc.specialization,
      rating:           doc.rating,
      experienceYears:  doc.experienceYears,
      isAvailable,
      availabilityState: computedAvailabilityState,
      temporaryNotice:  doc.temporaryNotice,
      isDelayed,
      nextAvailable,
      defaultQueueLimit: limit,
      queueLoad:        doc.queueLoad,
      estimatedWaitTime,    // always whole number (0 when session inactive)
      sessionStatus:    ss, // "inactive" | "active" | "paused" | "closed"
      score
    };
  }));

  // Sort: best score first (available + low wait + high rating)
  result.sort((a, b) => b.score - a.score);

  // Strip internal score before returning
  return result.map(({ score, ...d }) => d);
};


// ═══════════════════════════════════════════════════════════════════════════════
//  CREATE DOCTOR
// ═══════════════════════════════════════════════════════════════════════════════
export const createDoctorService = async (data) => {
  const { name, specialization, hospitalId, avgConsultationTime, experienceYears, userId } = data;

  const existingDoctor = await Doctor.findOne({ userId });
  if (existingDoctor) {
    const err = new Error("Doctor profile already exists for this user.");
    err.status = 409;
    throw err;
  }

  const hospital = await Hospital.findById(hospitalId);
  if (!hospital || !hospital.isActive) {
    const err = new Error("Invalid or inactive hospital.");
    err.status = 400;
    throw err;
  }

  return await Doctor.create({
    name,
    specialization,
    hospitalId,
    avgConsultationTime: avgConsultationTime || 5,
    experienceYears: experienceYears || 0,
    userId,
    status: "pending_profile",
    profileCompleted: false
  });
};


// ═══════════════════════════════════════════════════════════════════════════════
//  UPDATE DOCTOR
// ═══════════════════════════════════════════════════════════════════════════════
export const updateDoctorService = async (id, data) => {
  const doctor = await Doctor.findByIdAndUpdate(id, data, { returnDocument: "after" });
  if (!doctor) {
    const err = new Error("Doctor not found.");
    err.status = 404;
    throw err;
  }
  return doctor;
};


// ═══════════════════════════════════════════════════════════════════════════════
//  TOGGLE DOCTOR AVAILABILITY
// ═══════════════════════════════════════════════════════════════════════════════
export const toggleDoctorService = async (id) => {
  const doctor = await Doctor.findById(id);
  if (!doctor) {
    const err = new Error("Doctor not found.");
    err.status = 404;
    throw err;
  }
  doctor.isAvailable = !doctor.isAvailable;
  await doctor.save();
  return doctor;
};


export const getDoctorProfileService = async (userId) => {
  const doctor = await Doctor.findOne({ userId }).populate("hospitalId", "name address");
  if (!doctor) return null;
  const doctorId = doctor._id;
  const schedules = await DoctorSchedule.find({ doctorId });
  const overrides = await DoctorScheduleOverride.find({ doctorId });
  return {
    ...doctor.toObject(),
    schedules,
    overrides
  };
};


export const completeDoctorProfileService = async (userId, data) => {
  const { avgConsultationTime, experienceYears } = data;

  const doctor = await Doctor.findOne({ userId });
  if (!doctor) {
    const err = new Error("Doctor profile not found.");
    err.status = 404;
    throw err;
  }

  if (doctor.profileCompleted) {
    const err = new Error("Profile already completed.");
    err.status = 409;
    throw err;
  }

  return await Doctor.findOneAndUpdate(
    { userId },
    {
      avgConsultationTime,
      experienceYears,
      profileCompleted: true,
      status: "pending_activation",
      completedProfileAt: new Date()
    },
    { returnDocument: "after" }
  ).populate("hospitalId", "name address");
};

const getOrCreatePatientStats = async (userId, dbSession = null) => {
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

export const updateSettingsService = async (userId, data) => {
  const {
    availabilityState,
    temporaryNotice,
    defaultQueueLimit,
    avgConsultationTime,
    schedules,
    overrides,
    sessionPolicy,
    version
  } = data;

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const doctor = await Doctor.findOne({ userId }).session(dbSession);
    if (!doctor) {
      const err = new Error("Doctor profile not found.");
      err.status = 404;
      throw err;
    }

    // Concurrency Check
    if (version !== undefined && doctor.__v !== version) {
      const err = new Error("Conflict: Settings have been modified by another session. Please reload.");
      err.status = 409;
      throw err;
    }

    const todayStr = getTodayIST();
    const queueSession = await QueueSession.findOne({ doctorId: doctor._id, date: todayStr }).session(dbSession);

    // Block changes if session is in closing state
    if (queueSession && queueSession.sessionStatus === "closing") {
      const err = new Error("Cannot update settings while the queue session is closing.");
      err.status = 409;
      err.canUpdate = false;
      err.retry = true;
      throw err;
    }

    const oldAvailabilityState = doctor.availabilityState;

    if (defaultQueueLimit !== undefined) {
      doctor.defaultQueueLimit = defaultQueueLimit;
    }
    if (avgConsultationTime !== undefined) {
      doctor.avgConsultationTime = avgConsultationTime;
    }
    if (temporaryNotice !== undefined) {
      doctor.temporaryNotice = {
        message: temporaryNotice.message ?? "",
        expectedUntil: temporaryNotice.expectedUntil ? new Date(temporaryNotice.expectedUntil) : null,
        createdAt: new Date()
      };
    }

    if (availabilityState !== undefined) {
      doctor.availabilityState = availabilityState;

      // Handle availability log
      if (availabilityState !== oldAvailabilityState) {
        const previousLog = await DoctorAvailabilityLog.findOne({
          doctorId: doctor._id,
          endedAt: { $exists: false }
        }).sort({ startedAt: -1 }).session(dbSession);

        if (previousLog) {
          previousLog.endedAt = new Date();
          previousLog.durationMs = previousLog.endedAt - previousLog.startedAt;
          await previousLog.save({ session: dbSession });
        }

        await DoctorAvailabilityLog.create([{
          doctorId: doctor._id,
          sessionId: queueSession ? queueSession._id : null,
          eventType: "manual_change",
          state: availabilityState,
          startedAt: new Date()
        }], { session: dbSession });

        // Apply session policy if doctor goes offline / unavailable
        if (availabilityState === "unavailable" && queueSession) {
          if (sessionPolicy === "close_session") {
            const inProgressPatient = await Queue.findOne({
              doctorId: doctor._id,
              sessionId: queueSession._id,
              status: "in_progress"
            }).session(dbSession);

            if (inProgressPatient) {
              const err = new Error("Cannot close session while a patient consultation is in progress. Please complete or skip the current patient first.");
              err.status = 400;
              throw err;
            }

            if (queueSession.sessionStatus === "paused" && queueSession.pausedAt) {
              const pausedDuration = Date.now() - new Date(queueSession.pausedAt).getTime();
              queueSession.accumulatedPausedMs = (queueSession.accumulatedPausedMs || 0) + pausedDuration;
            }
            queueSession.sessionStatus = "closed";
            queueSession.isActive = false;
            queueSession.pausedAt = undefined;
            queueSession.closedAt = new Date();
            await queueSession.save({ session: dbSession });

            // Cancel waiting patients
            const remaining = await Queue.find({
              doctorId: doctor._id,
              sessionId: queueSession._id,
              status: "waiting",
              isActive: true
            }).session(dbSession);

            for (const p of remaining) {
              p.status = "cancelled";
              p.isActive = false;
              p.cancelledAt = new Date();
              p.cancelReason = "session_closed";
              await p.save({ session: dbSession });

              await BookingCredit.create([{
                userId: p.userId,
                credits: 1,
                expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
                reason: "session_closed"
              }], { session: dbSession });

              const pStats = await getOrCreatePatientStats(p.userId, dbSession);
              pStats.cancelledVisits = (pStats.cancelledVisits || 0) + 1;
              await pStats.save({ session: dbSession });

              await createNotification(
                p.userId,
                "Session Closed — Booking Cancelled ❌",
                "The doctor has ended today's session. Your booking was auto-cancelled and you have received a 48-hour priority credit.",
                "alert",
                {
                  session: dbSession,
                  category: "session",
                  eventType: "session_closed",
                  aggregateType: "Queue",
                  aggregateId: p._id,
                  metadata: { route: "/queue", entityId: p._id.toString() }
                }
              ).catch(() => {});
            }
          } else if (sessionPolicy === "stop_bookings") {
            queueSession.sessionStatus = "closing";
            await queueSession.save({ session: dbSession });
          }
        }
      }
    }

    // Save doctor document (increments version)
    await doctor.save({ session: dbSession });

    // Update Schedules
    if (Array.isArray(schedules)) {
      for (const s of schedules) {
        await DoctorSchedule.findOneAndUpdate(
          { doctorId: doctor._id, dayOfWeek: s.dayOfWeek },
          { startTime: s.startTime, endTime: s.endTime, enabled: s.enabled },
          { upsert: true, returnDocument: "after", session: dbSession }
        );
      }
    }

    // Update Overrides
    if (Array.isArray(overrides)) {
      for (const o of overrides) {
        await DoctorScheduleOverride.findOneAndUpdate(
          { doctorId: doctor._id, date: o.date },
          { startTime: o.startTime, endTime: o.endTime, enabled: o.enabled, isFullDay: o.isFullDay },
          { upsert: true, returnDocument: "after", session: dbSession }
        );
      }
    }

    await dbSession.commitTransaction();
    dbSession.endSession();

    // Return trimmed details
    return {
      availabilityState: doctor.availabilityState,
      scheduleUpdated: Boolean((schedules && schedules.length > 0) || (overrides && overrides.length > 0)),
      version: doctor.__v
    };
  } catch (err) {
    await dbSession.abortTransaction();
    dbSession.endSession();
    throw err;
  }
};

// ─── GET DOCTOR ANALYTICS SERVICE ────────────────────────────────────────────
export const getDoctorAnalyticsService = async (userId, rangeVal, download) => {
  const doctor = await Doctor.findOne({ userId });
  if (!doctor) {
    throw Object.assign(new Error("Doctor profile not found."), { status: 404 });
  }
  const doctorId = doctor._id;

  let numDays = 7;
  if (rangeVal === "30days") numDays = 30;
  else if (rangeVal === "today") numDays = 1;

  const getPastDatesIST = (daysCount) => {
    const dates = [];
    const date = new Date();
    for (let i = 0; i < daysCount; i++) {
      dates.push(date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
      date.setDate(date.getDate() - 1);
    }
    return dates.reverse();
  };

  const targetDates = getPastDatesIST(numDays);
  const startDateStr = targetDates[0];
  const endDateStr = targetDates[targetDates.length - 1];

  const cachedDaily = await DoctorAnalyticsDaily.find({
    doctorId,
    date: { $in: targetDates }
  });

  const dailyMap = {};
  for (const d of targetDates) {
    dailyMap[d] = {
      date: d,
      completed: 0,
      skipped: 0,
      noShow: 0,
      cancelled: 0,
      totalConsultationMinutes: 0,
      consultationCount: 0,
      totalWaitMinutes: 0,
      waitCount: 0,
      activeSessionMinutes: 0,
      pausedMinutes: 0,
      uniquePatients: 0,
      returningPatients: 0
    };
  }

  for (const item of cachedDaily) {
    dailyMap[item.date] = {
      date: item.date,
      completed: item.completed,
      skipped: item.skipped,
      noShow: item.noShow,
      cancelled: item.cancelled,
      totalConsultationMinutes: item.totalConsultationMinutes,
      consultationCount: item.consultationCount,
      totalWaitMinutes: item.totalWaitMinutes,
      waitCount: item.waitCount,
      activeSessionMinutes: item.activeSessionMinutes,
      pausedMinutes: item.pausedMinutes,
      uniquePatients: item.uniquePatients,
      returningPatients: item.returningPatients
    };
  }

  // Include live active session deltas for today
  const todayIST = getTodayIST();
  if (dailyMap[todayIST]) {
    const todaySession = await QueueSession.findOne({ doctorId, date: todayIST });
    if (todaySession) {
      let activeDeltaMins = 0;
      let pausedDeltaMins = 0;
      const now = new Date();

      if (todaySession.sessionStatus === "active") {
        const activeDeltaMs = now.getTime() - new Date(todaySession.lastActiveSegmentStartedAt || todaySession.startedAt || now).getTime();
        activeDeltaMins = Math.round(Math.max(activeDeltaMs / 60000, 0));
      } else if (todaySession.sessionStatus === "paused" && todaySession.pausedAt) {
        const pausedDuration = now.getTime() - new Date(todaySession.pausedAt).getTime();
        pausedDeltaMins = Math.round(Math.max(pausedDuration / 60000, 0));
      }

      dailyMap[todayIST].activeSessionMinutes += activeDeltaMins;
      dailyMap[todayIST].pausedMinutes += pausedDeltaMins;
    }
  }

  if (download === "true" || download === true) {
    let csv = "Date,Completed,Skipped,NoShow,Cancelled,TotalConsultationMinutes,ConsultationCount,TotalWaitMinutes,WaitCount,ActiveSessionMinutes,PausedMinutes,UniquePatients,ReturningPatients\n";
    for (const d of targetDates) {
      const item = dailyMap[d];
      csv += `${item.date},${item.completed},${item.skipped},${item.noShow},${item.cancelled},${item.totalConsultationMinutes},${item.consultationCount},${item.totalWaitMinutes},${item.waitCount},${item.activeSessionMinutes},${item.pausedMinutes},${item.uniquePatients},${item.returningPatients}\n`;
    }
    return {
      csvReady: true,
      downloadType: "inline",
      csvData: csv
    };
  }

  let totalConsulted = 0;
  let totalSkipped = 0;
  let totalNoShow = 0;
  let totalCancelled = 0;
  let sumConsultMinutes = 0;
  let sumConsultCount = 0;
  let sumWaitMinutes = 0;
  let sumWaitCount = 0;
  let sumActiveMinutes = 0;
  let sumPausedMinutes = 0;
  let sumUniquePatients = 0;
  let sumReturningPatients = 0;

  const trends = [];
  for (const d of targetDates) {
    const item = dailyMap[d];
    totalConsulted += item.completed;
    totalSkipped += item.skipped;
    totalNoShow += item.noShow;
    totalCancelled += item.cancelled;
    sumConsultMinutes += item.totalConsultationMinutes;
    sumConsultCount += item.consultationCount;
    sumWaitMinutes += item.totalWaitMinutes;
    sumWaitCount += item.waitCount;
    sumActiveMinutes += item.activeSessionMinutes;
    sumPausedMinutes += item.pausedMinutes;
    sumUniquePatients += item.uniquePatients;
    sumReturningPatients += item.returningPatients;

    trends.push({
      date: item.date,
      completed: item.completed,
      noShow: item.noShow,
      cancelled: item.cancelled
    });
  }

  const totalFinishedBookings = totalConsulted + totalSkipped + totalNoShow + totalCancelled;
  const completionRate = totalFinishedBookings > 0 ? Math.round((totalConsulted / totalFinishedBookings) * 100) : 100;
  const noShowRate = totalFinishedBookings > 0 ? Math.round((totalNoShow / totalFinishedBookings) * 100) : 0;
  const avgConsultationTime = sumConsultCount > 0 ? Math.round((sumConsultMinutes / sumConsultCount) * 10) / 10 : (doctor.avgConsultationTime || 5);
  const avgWaitTime = sumWaitCount > 0 ? Math.round((sumWaitMinutes / sumWaitCount) * 10) / 10 : 0;
  const totalActiveHours = sumActiveMinutes / 60;
  const throughput = totalActiveHours > 0 ? Math.round((totalConsulted / totalActiveHours) * 10) / 10 : 0;
  const patientRetention = sumUniquePatients > 0 ? Math.round((sumReturningPatients / sumUniquePatients) * 100) : 0;
  const totalSessionHours = Math.round((sumActiveMinutes / 60) * 10) / 10;

  const waitTimeScore = avgWaitTime <= 10 ? 100 : Math.max(0, 100 - (avgWaitTime - 10) * 2);
  const uptimeRatio = (sumActiveMinutes + sumPausedMinutes) > 0 ? (sumActiveMinutes / (sumActiveMinutes + sumPausedMinutes)) : 1;
  const uptimeScore = uptimeRatio * 100;
  const healthScore = Math.round(completionRate * 0.4 + (100 - noShowRate) * 0.3 + waitTimeScore * 0.2 + uptimeScore * 0.1);

  // Previous Period aggregates for comparison
  let prevNumDays = numDays;
  const prevDates = [];
  const dateObj = new Date();
  dateObj.setDate(dateObj.getDate() - numDays);
  for (let i = 0; i < prevNumDays; i++) {
    prevDates.push(dateObj.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
    dateObj.setDate(dateObj.getDate() - 1);
  }
  prevDates.reverse();

  const prevCachedDaily = await DoctorAnalyticsDaily.find({
    doctorId,
    date: { $in: prevDates }
  });

  let prevConsulted = 0;
  let prevSkipped = 0;
  let prevNoShow = 0;
  let prevCancelled = 0;
  let prevActiveMins = 0;
  let prevPausedMins = 0;
  let prevWaitMins = 0;
  let prevWaitCount = 0;

  for (const item of prevCachedDaily) {
    prevConsulted += item.completed;
    prevSkipped += item.skipped;
    prevNoShow += item.noShow;
    prevCancelled += item.cancelled;
    prevActiveMins += item.activeSessionMinutes;
    prevPausedMins += item.pausedMinutes;
    prevWaitMins += item.totalWaitMinutes;
    prevWaitCount += item.waitCount;
  }

  const prevFinished = prevConsulted + prevSkipped + prevNoShow + prevCancelled;
  const prevCompletionRate = prevFinished > 0 ? Math.round((prevConsulted / prevFinished) * 100) : 100;
  const prevNoShowRate = prevFinished > 0 ? Math.round((prevNoShow / prevFinished) * 100) : 0;
  const prevAvgWait = prevWaitCount > 0 ? prevWaitMins / prevWaitCount : 0;
  const prevWaitScore = prevAvgWait <= 10 ? 100 : Math.max(0, 100 - (prevAvgWait - 10) * 2);
  const prevUptime = (prevActiveMins + prevPausedMins) > 0 ? (prevActiveMins / (prevActiveMins + prevPausedMins)) : 1;
  const prevHealthScore = Math.round(prevCompletionRate * 0.4 + (100 - prevNoShowRate) * 0.3 + prevWaitScore * 0.2 + prevUptime * 10);

  return {
    version: "v1",
    generatedAt: new Date().toISOString(),
    range: rangeVal,
    period: {
      start: startDateStr,
      end: endDateStr,
      timezone: "Asia/Kolkata"
    },
    hasData: totalConsulted > 0,
    kpi: {
      totalConsulted,
      completionRate,
      noShowRate,
      avgConsultationTime,
      avgWaitTime,
      throughput,
      totalSessionHours,
      healthScore,
      patientRetention
    },
    trends,
    outcomes: {
      completed: totalConsulted,
      skipped: totalSkipped,
      noShow: totalNoShow,
      cancelled: totalCancelled
    },
    efficiency: {
      activeSessionHours: Math.round((sumActiveMinutes / 60) * 10) / 10,
      pausedHours: Math.round((sumPausedMinutes / 60) * 10) / 10
    },
    comparison: {
      previousPeriod: {
        totalConsulted: prevConsulted,
        completionRate: prevCompletionRate,
        healthScore: prevHealthScore
      }
    }
  };
};

// ─── REBUILD DOCTOR ANALYTICS SERVICE ─────────────────────────────────────────
export const rebuildDoctorAnalyticsService = async (doctorId, startDateStr, endDateStr, requestedBy = null) => {
  // Enforce circuit breaker: max one rebuild per doctor per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentRebuild = await AnalyticsRebuildAuditLog.findOne({
    doctorId,
    createdAt: { $gte: oneHourAgo }
  });
  if (recentRebuild) {
    throw Object.assign(new Error("Circuit breaker active: Only one rebuild per doctor per hour is allowed."), { status: 429 });
  }

  const rebuildStartTime = Date.now();

  const getPeriodBoundsLocal = (dateStr) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    start.setMinutes(start.getMinutes() - 330);
    const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    end.setMinutes(end.getMinutes() - 330);
    return { start, end };
  };

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw Object.assign(new Error("Invalid startDate or endDate format. Use YYYY-MM-DD."), { status: 400 });
  }

  // Create audit log with "running" status if requestedBy is provided
  let auditLog = null;
  if (requestedBy) {
    auditLog = await AnalyticsRebuildAuditLog.create({
      doctorId,
      requestedBy,
      startDate: startDateStr,
      endDate: endDateStr,
      rebuildStatus: "running",
      timeTakenMs: 0,
      rowsRebuilt: 0
    });
  }

  try {
    const dates = [];
    let current = new Date(start);
    while (current <= end) {
      dates.push(current.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
      current.setDate(current.getDate() + 1);
    }

    // 1. Fetch sessions first
    const sessions = await QueueSession.find(
      { doctorId, date: { $in: dates } },
      { _id: 1, date: 1, startedAt: 1, closedAt: 1, accumulatedPausedMs: 1, sessionStatus: 1, pausedAt: 1 }
    ).lean();

    const sessionMap = new Map();
    for (const session of sessions) {
      sessionMap.set(session.date, session);
    }

    const sessionIds = sessions.map(s => s._id);

    // 2. Fetch queues for target sessions
    const allQueues = await Queue.find(
      { doctorId, sessionId: { $in: sessionIds } },
      { _id: 1, userId: 1, sessionId: 1, status: 1, consultationDurationMs: 1, startedAt: 1, createdAt: 1 }
    ).lean();

    const queuesBySessionId = new Map();
    const targetUserIds = new Set();
    for (const q of allQueues) {
      targetUserIds.add(q.userId.toString());
      const sId = q.sessionId.toString();
      if (!queuesBySessionId.has(sId)) {
        queuesBySessionId.set(sId, []);
      }
      queuesBySessionId.get(sId).push(q);
    }

    // 3. Delete daily caches and fetch first two completed queues for target users in parallel
    const [, rawCompletedQueues] = await Promise.all([
      DoctorAnalyticsDaily.deleteMany({ doctorId, date: { $in: dates } }),
      Queue.aggregate([
        {
          $match: {
            doctorId: new mongoose.Types.ObjectId(doctorId),
            userId: { $in: Array.from(targetUserIds).map(id => new mongoose.Types.ObjectId(id)) },
            status: "completed"
          }
        },
        { $sort: { createdAt: 1 } },
        {
          $group: {
            _id: "$userId",
            firstTwo: { $push: { _id: "$_id", createdAt: "$createdAt" } }
          }
        },
        {
          $project: {
            firstTwo: { $slice: ["$firstTwo", 2] }
          }
        }
      ])
    ]);

    const queuePriorCompletedCountMap = new Map();
    for (const doc of rawCompletedQueues) {
      const qList = doc.firstTwo || [];
      if (qList.length > 0) {
        queuePriorCompletedCountMap.set(qList[0]._id.toString(), 0);
      }
      if (qList.length > 1) {
        queuePriorCompletedCountMap.set(qList[1]._id.toString(), 1);
      }
    }

    // Iterate day-by-day and calculate metrics entirely in-memory
    for (const dateStr of dates) {
      const session = sessionMap.get(dateStr);
      if (!session) continue;

      const queues = queuesBySessionId.get(session._id.toString()) || [];

      let completed = 0;
      let skipped = 0;
      let noShow = 0;
      let cancelled = 0;
      let totalConsultationMinutes = 0;
      let consultationCount = 0;
      let totalWaitMinutes = 0;
      let waitCount = 0;

      for (const q of queues) {
        if (q.status === "completed") {
          completed++;
          if (q.consultationDurationMs) {
            totalConsultationMinutes += Math.round(q.consultationDurationMs / 60000);
            consultationCount++;
          }
          if (q.startedAt && q.createdAt) {
            const waitMs = new Date(q.startedAt).getTime() - new Date(q.createdAt).getTime();
            totalWaitMinutes += Math.round(Math.max(waitMs / 60000, 0));
            waitCount++;
          }
        } else if (q.status === "skipped") {
          skipped++;
        } else if (q.status === "no_show") {
          noShow++;
        } else if (q.status === "cancelled") {
          cancelled++;
        }
      }

      let uniquePatients = 0;
      let returningPatients = 0;

      const completedQueues = queues.filter(q => q.status === "completed");
      for (const q of completedQueues) {
        const completedBefore = queuePriorCompletedCountMap.has(q._id.toString())
          ? queuePriorCompletedCountMap.get(q._id.toString())
          : 2;
        if (completedBefore === 0) {
          uniquePatients++;
        } else if (completedBefore === 1) {
          returningPatients++;
        }
      }

      let activeMinutes = 0;
      let pausedMinutes = 0;
      if (session.startedAt) {
        const endLimit = session.closedAt || new Date();
        const elapsedMs = endLimit.getTime() - new Date(session.startedAt).getTime();
        let pausedMs = session.accumulatedPausedMs || 0;
        if (session.sessionStatus === "paused" && session.pausedAt) {
          pausedMs += Date.now() - new Date(session.pausedAt).getTime();
        }
        activeMinutes = Math.round(Math.max(elapsedMs - pausedMs, 0) / 60000);
        pausedMinutes = Math.round(pausedMs / 60000);
      }

      const { start: periodStartAt, end: periodEndAt } = getPeriodBoundsLocal(dateStr);

      await DoctorAnalyticsDaily.create({
        doctorId,
        date: dateStr,
        periodStartAt,
        periodEndAt,
        completed,
        skipped,
        noShow,
        cancelled,
        totalConsultationMinutes,
        consultationCount,
        totalWaitMinutes,
        waitCount,
        activeSessionMinutes: activeMinutes,
        pausedMinutes: pausedMinutes,
        uniquePatients,
        returningPatients
      });
    }

    const rebuildDuration = Date.now() - rebuildStartTime;

    // Track system monitoring metric for rebuild elapsed time (fire-and-forget)
    incrementSystemMetric("rebuild_ms", rebuildDuration).catch(err => console.error(err));

    // Update audit log if requestedBy is provided (fire-and-forget)
    if (auditLog) {
      AnalyticsRebuildAuditLog.findByIdAndUpdate(
        auditLog._id,
        {
          rebuildStatus: "completed",
          timeTakenMs: rebuildDuration,
          rowsRebuilt: sessions.length
        },
        { returnDocument: "after" }
      ).catch(err => console.error(err));
    }

    return { success: true, message: `Rebuilt analytics for ${dates.length} days.` };
  } catch (error) {
    const rebuildDuration = Date.now() - rebuildStartTime;
    if (auditLog) {
      AnalyticsRebuildAuditLog.findByIdAndUpdate(
        auditLog._id,
        {
          rebuildStatus: "failed",
          timeTakenMs: rebuildDuration
        },
        { returnDocument: "after" }
      ).catch(err => console.error(err));
    }
    throw error;
  }
};
