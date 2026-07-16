import mongoose from "mongoose";
import DoctorSchedule from "./doctor_schedule.model.js";
import DoctorScheduleOverride from "./doctor_schedule_override.model.js";
import DoctorLeave from "./doctor_leave.model.js";
import DoctorBreak from "./doctor_break.model.js";
import QueueSession from "../queue/queueSession.model.js";
import Queue from "../queue/queue.model.js";
import Doctor from "./doctor.model.js";
import HospitalHoliday from "../hospital/hospital_holiday.model.js";
import Hospital from "../hospital/hospital.model.js";
import HospitalSchedulingPolicy from "../hospital/hospital_scheduling_policy.model.js";
import AppointmentBooking from "../queue/appointment_booking.model.js";
import AdminAudit from "../admin/admin_audit.model.js";
import { getTodayIST } from "../search/utils.js";

// In-memory slot caching layer
const slotCache = new Map();

/**
 * Gets slot cache key
 */
const getCacheKey = (doctorId, date, version) => {
  return `${doctorId.toString()}_${date}_v${version}`;
};

/**
 * Invalidation trigger
 */
export const invalidateSlotCache = (doctorId, date) => {
  if (doctorId && date) {
    for (const key of slotCache.keys()) {
      if (key.startsWith(`${doctorId.toString()}_${date}`)) {
        slotCache.delete(key);
      }
    }
  } else if (doctorId) {
    for (const key of slotCache.keys()) {
      if (key.startsWith(doctorId.toString())) {
        slotCache.delete(key);
      }
    }
  } else {
    slotCache.clear();
  }
};

/**
 * Time parse helper: "09:00" -> minutes from midnight
 */
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Check if two time ranges overlap on the same day
 */
const isOverlapping = (start1, end1, start2, end2) => {
  const s1 = parseTimeToMinutes(start1);
  const e1 = parseTimeToMinutes(end1);
  const s2 = parseTimeToMinutes(start2);
  const e2 = parseTimeToMinutes(end2);
  return s1 < e2 && s2 < e1;
};

/**
 * Check if weekly schedule is locked due to active session on today
 */
export const checkScheduleLocked = async (doctorId) => {
  const todayStr = getTodayIST();
  const activeSession = await QueueSession.findOne({
    doctorId,
    date: todayStr,
    sessionState: { $in: ["ACTIVE", "PAUSED"] }
  });
  if (activeSession) {
    return {
      locked: true,
      reason: "An active session is currently running today. Roster cannot be directly edited."
    };
  }

  // Check lock buffer window (60 minutes before today's first session starts)
  const schedules = await DoctorSchedule.find({
    doctorId,
    dayOfWeek: new Date().getDay(),
    status: "published"
  });

  if (schedules.length > 0) {
    const nowMinutes = parseTimeToMinutes(new Date().toLocaleTimeString("en-US", { hour12: false }).substring(0, 5));
    for (const sched of schedules) {
      const startMinutes = parseTimeToMinutes(sched.startTime);
      if (startMinutes - nowMinutes > 0 && startMinutes - nowMinutes <= 60) {
        return {
          locked: true,
          reason: `Roster is locked within 60 minutes of session start (${sched.startTime}). Use overrides.`
        };
      }
    }
  }

  return { locked: false };
};

/**
 * Save schedule drafts
 */
export const saveWeeklyScheduleDraft = async (doctorId, shifts) => {
  const lockCheck = await checkScheduleLocked(doctorId);
  if (lockCheck.locked) {
    throw new Error(lockCheck.reason);
  }

  // Validate split shift overlaps in draft payload
  for (let i = 0; i < shifts.length; i++) {
    for (let j = i + 1; j < shifts.length; j++) {
      if (
        shifts[i].dayOfWeek === shifts[j].dayOfWeek &&
        isOverlapping(shifts[i].startTime, shifts[i].endTime, shifts[j].startTime, shifts[j].endTime)
      ) {
        throw new Error(`Split shift overlaps detected on weekday ${shifts[i].dayOfWeek}`);
      }
    }
  }

  // Find latest version
  const latestSchedule = await DoctorSchedule.findOne({ doctorId }).sort({ version: -1 });
  const nextVersion = latestSchedule ? latestSchedule.version + 1 : 1;

  // Insert draft shifts
  const createdShifts = [];
  for (const s of shifts) {
    const doc = await DoctorSchedule.create({
      doctorId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      status: "draft",
      version: nextVersion,
      effectiveFrom: new Date()
    });
    createdShifts.push(doc);
  }

  invalidateSlotCache(doctorId);
  return { version: nextVersion, shifts: createdShifts };
};

/**
 * Publish Schedule Draft
 */
export const publishWeeklySchedule = async (doctorId, version) => {
  const lockCheck = await checkScheduleLocked(doctorId);
  if (lockCheck.locked) {
    throw new Error(lockCheck.reason);
  }

  const draftShifts = await DoctorSchedule.find({ doctorId, version, status: "draft" });
  if (draftShifts.length === 0) {
    throw new Error(`No draft schedule version ${version} found for doctor.`);
  }

  // Archive previous published schedules
  await DoctorSchedule.updateMany(
    { doctorId, status: "published" },
    { $set: { status: "archived", effectiveUntil: new Date() } }
  );

  // Promote draft
  await DoctorSchedule.updateMany(
    { doctorId, version, status: "draft" },
    { $set: { status: "published", effectiveFrom: new Date(), effectiveUntil: null } }
  );

  invalidateSlotCache(doctorId);
  return { success: true, publishedVersion: version };
};

/**
 * Break Management
 */
export const createBreak = async (doctorId, date, startTime, endTime, breakType, reason, isEmergencyOverride = false, adminId = null) => {
  // Check overlapping breaks
  const existingBreak = await DoctorBreak.findOne({
    doctorId,
    date,
    $or: [
      { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
    ]
  });

  if (existingBreak) {
    throw new Error("A break already exists in this time interval.");
  }

  // Check active bookings overlap
  const overlappingBookings = await Queue.find({
    doctorId,
    isActive: true,
    status: "waiting",
    slotTime: { $ne: null }
  }).populate("sessionId");

  const bookedCollisions = overlappingBookings.filter(b => {
    if (!b.sessionId || b.sessionId.date !== date) return false;
    return parseTimeToMinutes(b.slotTime) >= parseTimeToMinutes(startTime) && parseTimeToMinutes(b.slotTime) < parseTimeToMinutes(endTime);
  });

  if (bookedCollisions.length > 0 && !isEmergencyOverride) {
    throw new Error("Cannot schedule break: Active appointments are already booked in this interval.");
  }

  if (bookedCollisions.length > 0 && isEmergencyOverride && adminId) {
    // Log Compliance Override Audit
    await AdminAudit.create({
      adminId,
      action: "SCHEDULE_OVERRIDE",
      targetType: "DoctorBreak",
      targetId: doctorId,
      reason: `Emergency break override: ${reason || "No reason given"}. Displacing ${bookedCollisions.length} bookings.`,
      before: { activeBookings: bookedCollisions.length },
      after: { breakCreated: true }
    });
  }

  const breakDoc = await DoctorBreak.create({
    doctorId,
    date,
    startTime,
    endTime,
    breakType,
    reason
  });

  invalidateSlotCache(doctorId, date);
  return breakDoc;
};

/**
 * Request leave
 */
export const requestLeave = async (doctorId, leaveType, startDate, endDate, startTime, endTime, reason, isRecurring = false, recurrence = null) => {
  return await DoctorLeave.create({
    doctorId,
    leaveType,
    startDate,
    endDate,
    startTime,
    endTime,
    isRecurring,
    recurrence,
    status: "pending",
    reason
  });
};

export const getLeaves = async (hospitalId = null) => {
  let query = {};
  if (hospitalId) {
    const doctors = await Doctor.find({ hospitalId }, "_id");
    const doctorIds = doctors.map(d => d._id);
    query = { doctorId: { $in: doctorIds } };
  }
  return await DoctorLeave.find(query)
    .populate({
      path: "doctorId",
      populate: { path: "userId", select: "name email phone" }
    })
    .populate("approvedBy", "name email")
    .sort({ createdAt: -1 });
};

export const rejectLeave = async (leaveId, adminId, reasonOverride = "") => {
  const leave = await DoctorLeave.findById(leaveId);
  if (!leave) throw new Error("Leave request not found.");
  if (leave.status !== "pending") throw new Error("Leave is already processed.");

  leave.status = "rejected";
  leave.approvedBy = adminId;
  if (reasonOverride) {
    leave.reason = `${leave.reason || ""} (Rejected: ${reasonOverride})`;
  }
  await leave.save();
  return leave;
};

/**
 * Approve leave and trigger Auto-Reassignment
 */
export const approveLeave = async (leaveId, adminId, reasonOverride = "") => {
  const leave = await DoctorLeave.findById(leaveId);
  if (!leave) throw new Error("Leave request not found.");
  if (leave.status !== "pending") throw new Error("Leave is already processed.");

  leave.status = "approved";
  leave.approvedBy = adminId;
  await leave.save();

  // Create audit trail
  await AdminAudit.create({
    adminId,
    action: "EMERGENCY_OVERRIDE",
    targetType: "DoctorLeave",
    targetId: leave._id,
    reason: `Leave request approved. Reason: ${reasonOverride || leave.reason}`,
    before: { status: "pending" },
    after: { status: "approved" }
  });

  // Calculate leave days/hours
  const affectedDates = [];
  const startD = new Date(leave.startDate);
  const endD = new Date(leave.endDate);

  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    if (leave.isRecurring && leave.recurrence?.dayOfWeek !== undefined) {
      if (d.getDay() === leave.recurrence.dayOfWeek) {
        affectedDates.push(dateStr);
      }
    } else {
      affectedDates.push(dateStr);
    }
  }

  // Perform reassignment/cancellation logic
  const reassignments = [];
  const cancellations = [];

  for (const dateStr of affectedDates) {
    invalidateSlotCache(leave.doctorId, dateStr);

    const activeSessions = await QueueSession.find({ doctorId: leave.doctorId, date: dateStr });
    for (const session of activeSessions) {
      const bookings = await Queue.find({
        doctorId: leave.doctorId,
        sessionId: session._id,
        isActive: true,
        status: "waiting"
      });

      for (const booking of bookings) {
        // Filter out by time window if partial day leave
        if (leave.leaveType === "half_day" || leave.leaveType === "emergency") {
          const slotMin = parseTimeToMinutes(booking.slotTime);
          const startMin = parseTimeToMinutes(leave.startTime);
          const endMin = parseTimeToMinutes(leave.endTime);
          if (slotMin < startMin || slotMin >= endMin) {
            continue; // Not affected by partial day leave
          }
        }

        // Try Auto-Reassignment to equivalent doctor
        const reassigned = await attemptAutoReassignment(booking, dateStr);
        if (reassigned) {
          reassignments.push({ bookingId: booking._id, newDoctorId: reassigned._id });
        } else {
          // Cancel booking
          booking.isActive = false;
          booking.status = "cancelled";
          booking.cancelledAt = new Date();
          booking.cancelReason = "doctor_cancelled";
          await booking.save();
          cancellations.push(booking._id);

          // Emit realtime cancellation update
          try {
            const { dispatchToUser } = await import("../realtime/event_dispatcher.js");
            await dispatchToUser(booking.userId, "QUEUE_UPDATED", {
              action: "BOOKING_CANCELLED",
              queueId: booking._id,
              reason: "Doctor is unavailable due to approved leave."
            });
          } catch (wsErr) {
            console.error("WebSocket failure during leave cancel broadcast:", wsErr);
          }
        }
      }
    }
  }

  return { leave, reassignments, cancellations };
};

/**
 * Helper to reassign booking
 */
const attemptAutoReassignment = async (booking, dateStr) => {
  const origDoctor = await Doctor.findById(booking.doctorId);
  if (!origDoctor) return null;

  // Find verified, active doctor of identical specialization
  const peers = await Doctor.find({
    specialization: origDoctor.specialization,
    status: "verified",
    _id: { $ne: booking.doctorId }
  });

  for (const peer of peers) {
    // Generate slots to see if peer is available
    const peerSlots = await generateDoctorSlots(peer._id, dateStr);
    const avSlot = peerSlots.find(s => s.status === "AVAILABLE" && s.time === booking.slotTime);

    if (avSlot) {
      // Find or create peer session
      let peerSession = await QueueSession.findOne({ doctorId: peer._id, date: dateStr });
      if (!peerSession) {
        const schedule = await DoctorSchedule.findOne({
          doctorId: peer._id,
          dayOfWeek: new Date(dateStr).getDay(),
          status: "published"
        });
        if (!schedule) continue;

        peerSession = await QueueSession.create({
          doctorId: peer._id,
          date: dateStr,
          sessionState: "CREATED",
          scheduleSnapshot: {
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            queueLimit: peer.defaultQueueLimit || 50,
            doctorName: peer.name,
            hospitalName: "Partnered Hospital",
            averageConsultationTime: peer.avgConsultationTime || 10,
            scheduleVersion: schedule.version
          }
        });
      }

      booking.doctorId = peer._id;
      booking.sessionId = peerSession._id;
      await booking.save();

      // Emit realtime reassignment update
      try {
        const { dispatchToUser } = await import("../realtime/event_dispatcher.js");
        await dispatchToUser(booking.userId, "QUEUE_UPDATED", {
          action: "BOOKING_REASSIGNED",
          queueId: booking._id,
          newDoctorName: peer.name
        });
      } catch (wsErr) {
        console.error("WebSocket failure during leave reassign broadcast:", wsErr);
      }

      return peer;
    }
  }

  return null;
};

/**
 * Visual calendar aggregator
 */
export const getCalendarData = async (startDate, endDate) => {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  }

  const holidays = await HospitalHoliday.find({
    date: { $in: dates }
  });

  const leaves = await DoctorLeave.find({
    status: "approved",
    $or: [
      { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
    ]
  }).populate("doctorId", "name specialization");

  const sessions = await QueueSession.find({
    date: { $in: dates }
  }).populate("doctorId", "name specialization");

  const breaks = await DoctorBreak.find({
    date: { $in: dates }
  });

  return { holidays, leaves, sessions, breaks };
};

/**
 * Dynamic slots compiler & availability engine
 */
export const generateDoctorSlots = async (doctorId, dateStr) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) return [];

  // Parallelize all DB operations (8-in-1 query block!)
  const [
    holiday,
    fullDayLeave,
    overrides,
    publishedSchedules,
    breaks,
    partialLeaves,
    activeSession,
    policy
  ] = await Promise.all([
    HospitalHoliday.findOne({ date: dateStr }),
    DoctorLeave.findOne({
      doctorId,
      status: "approved",
      startDate: { $lte: dateStr },
      endDate: { $gte: dateStr },
      leaveType: { $in: ["full_day", "multiple_days"] }
    }),
    DoctorScheduleOverride.find({ doctorId, date: dateStr }),
    DoctorSchedule.find({
      doctorId,
      dayOfWeek: new Date(dateStr).getDay(),
      status: "published"
    }),
    DoctorBreak.find({ doctorId, date: dateStr }),
    DoctorLeave.find({
      doctorId,
      status: "approved",
      startDate: { $lte: dateStr },
      endDate: { $gte: dateStr },
      leaveType: { $in: ["half_day", "emergency"] }
    }),
    QueueSession.findOne({ doctorId, date: dateStr }),
    HospitalSchedulingPolicy.findOne({ hospitalId: doctor.hospitalId })
  ]);

  const windowDays = policy ? policy.bookingWindowDays : 7;
  const todayIST = getTodayIST();
  const today = new Date(todayIST);
  const targetDate = new Date(dateStr);
  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0 || diffDays > windowDays) {
    return [];
  }

  if (holiday) {
    return [{ time: "00:00", status: "HOLIDAY", label: holiday.name }];
  }

  if (fullDayLeave) {
    return [{ time: "00:00", status: "LEAVE", label: "Doctor on approved leave" }];
  }

  // 3. Resolve effective schedule
  let scheduleShifts = [];
  let scheduleVersion = 1;

  if (overrides.length > 0) {
    const fullDayOff = overrides.find(o => o.isFullDay && !o.enabled);
    if (fullDayOff) {
      return [];
    }
    const activeOverrides = overrides.filter(o => o.enabled);
    if (activeOverrides.length === 0 && overrides.some(o => !o.enabled)) {
      return [];
    }
    scheduleShifts = activeOverrides.map(o => ({
      startTime: o.startTime,
      endTime: o.endTime,
      enabled: true
    }));
  } else {
    scheduleShifts = publishedSchedules;
    if (publishedSchedules.length > 0) {
      scheduleVersion = publishedSchedules[0].version;
    }
  }

  if (scheduleShifts.length === 0) {
    return [];
  }

  // Cache hit check
  const cacheKey = getCacheKey(doctorId, dateStr, scheduleVersion);
  if (slotCache.has(cacheKey)) {
    return slotCache.get(cacheKey);
  }

  const generated = [];
  const bookings = await AppointmentBooking.find({
    doctorId,
    date: dateStr,
    status: { $nin: ["CANCELLED", "EXPIRED"] }
  });

  const consultTime = doctor.avgConsultationTime || 10;

  for (const shift of scheduleShifts) {
    const startMins = parseTimeToMinutes(shift.startTime);
    const endMins = parseTimeToMinutes(shift.endTime);

    for (let current = startMins; current < endMins; current += consultTime) {
      const slotHour = Math.floor(current / 60).toString().padStart(2, "0");
      const slotMin = (current % 60).toString().padStart(2, "0");
      const timeLabel = `${slotHour}:${slotMin}`;

      let status = "AVAILABLE";

      // Break check
      const insideBreak = breaks.some(b => {
        const bs = parseTimeToMinutes(b.startTime);
        const be = parseTimeToMinutes(b.endTime);
        return current >= bs && current < be;
      });
      if (insideBreak) status = "BREAK";

      // Leave check
      const insideLeave = partialLeaves.some(l => {
        const ls = parseTimeToMinutes(l.startTime);
        const le = parseTimeToMinutes(l.endTime);
        return current >= ls && current < le;
      });
      if (insideLeave) status = "LEAVE";

      // Booking check
      const isBooked = bookings.some(b => b.slotTime === timeLabel);
      if (isBooked && status === "AVAILABLE") status = "BOOKED";

      // LOCKED check (cutoff buffer window)
      const isToday = (dateStr === todayIST);
      if (isToday && status === "AVAILABLE" && process.env.NODE_ENV !== "test") {
        const cutoffMinutes = policy ? policy.bookingCutoffMinutes : 30;
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();
        if (current - nowMins < cutoffMinutes) {
          status = "LOCKED";
        }
      }

      generated.push({ time: timeLabel, status });
    }
  }

  slotCache.set(cacheKey, generated);
  return generated;
};

/**
 * Availability state machine resolver
 */
export const getDoctorAvailabilityState = async (doctorId, dateStr) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor || doctor.status !== "verified") return "Emergency Closed";

  const holiday = await HospitalHoliday.findOne({ date: dateStr });
  if (holiday) return "Holiday";

  const leave = await DoctorLeave.findOne({
    doctorId,
    status: "approved",
    startDate: { $lte: dateStr },
    endDate: { $gte: dateStr }
  });
  if (leave) return "On Leave";

  const session = await QueueSession.findOne({ doctorId, date: dateStr });
  if (!session) return "Not Started";

  if (session.sessionState === "COMPLETED") return "Session Completed";
  if (session.sessionState === "CANCELLED") return "Emergency Closed";
  if (session.sessionState === "PAUSED") return "Break";

  // Check capacity limits
  const activeCount = await Queue.countDocuments({
    doctorId,
    sessionId: session._id,
    isActive: true
  });

  const limit = session.maxQueueLimit || doctor.defaultQueueLimit || 50;
  if (activeCount >= limit) return "Busy";

  return "Available";
};
