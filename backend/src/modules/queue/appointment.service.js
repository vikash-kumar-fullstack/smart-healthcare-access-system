import mongoose from "mongoose";
import AppointmentBooking from "./appointment_booking.model.js";
import AppointmentTimeline from "./appointment_timeline.model.js";
import ReminderQueue from "./reminder_queue.model.js";
import BookingCounter from "./booking_counter.model.js";
import HospitalSchedulingPolicy from "../hospital/hospital_scheduling_policy.model.js";
import Doctor from "../doctor/doctor.model.js";
import QueueSession from "./queueSession.model.js";
import User from "../auth/auth.model.js";
import { getTodayIST } from "../search/utils.js";
import { dispatchToUser, dispatchToDoctor } from "../realtime/event_dispatcher.js";
import { incrementKPI } from "./queue.service.js";

// Helper to parse "09:00" to minutes
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

// Helper to check if a target date is within the hospital policy's window
const isWithinBookingWindow = async (hospitalId, targetDateStr) => {
  const policy = await HospitalSchedulingPolicy.findOne({ hospitalId });
  const windowDays = policy ? policy.bookingWindowDays : 7; // default 7 days

  const today = new Date(getTodayIST() + "T00:00:00Z");
  const target = new Date(targetDateStr + "T00:00:00Z");

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 0 && diffDays <= windowDays;
};

/**
 * Immutable Timeline Audit Logger
 */
export const logTimeline = async (bookingId, actor, actorId, event, source = "web_portal", metadata = {}) => {
  return await AppointmentTimeline.create({
    bookingId,
    actor,
    actorId,
    source,
    event,
    metadata
  });
};

/**
 * Pre-schedule reminders inside ReminderQueue
 */
export const scheduleReminders = async (booking) => {
  const todayStr = getTodayIST();
  if (booking.date !== todayStr) {
    // 24-hour reminder scheduled for yesterday at the same time
    const slotTimeDate = new Date(`${booking.date}T${booking.slotTime}:00`);
    const sendAt24h = new Date(slotTimeDate.getTime() - 24 * 60 * 60 * 1000);
    await ReminderQueue.create({
      bookingId: booking._id,
      sendAt: sendAt24h,
      type: "24h",
      channels: ["in-app", "email"]
    });
  }

  const baseDate = new Date(`${booking.date}T${booking.slotTime}:00`);
  const alerts = [
    { type: "1h", min: 60, chan: ["in-app", "email"] },
    { type: "30m", min: 30, chan: ["in-app", "sms"] },
    { type: "10m", min: 10, chan: ["in-app", "whatsapp"] }
  ];

  for (const alert of alerts) {
    const sendAt = new Date(baseDate.getTime() - alert.min * 60 * 1000);
    if (sendAt > new Date()) {
      await ReminderQueue.create({
        bookingId: booking._id,
        sendAt,
        type: alert.type,
        channels: alert.chan
      });
    }
  }
};

/**
 * bookAppointment
 */
export const bookAppointment = async (userId, doctorId, date, slotTime) => {
  const doctor = await Doctor.findById(doctorId).populate("hospitalId");
  if (!doctor) throw new Error("Doctor profile not found.");
  if (doctor.status !== "verified" && doctor.status !== "active") {
    throw new Error("Doctor is currently not active or suspended.");
  }

  // Booking window limit checking
  const allowed = await isWithinBookingWindow(doctor.hospitalId._id, date);
  if (!allowed) {
    throw new Error("Booking outside allowed window defined by hospital policy.");
  }

  // Prevent duplicate concurrent booking slots
  const exists = await AppointmentBooking.findOne({
    doctorId,
    date,
    slotTime,
    status: { $in: ["BOOKED", "CONFIRMED", "READY", "IN_CONSULTATION"] }
  });
  if (exists) {
    throw new Error("Slot already booked. Choose another timing.");
  }

  // Resolve session
  let session = await QueueSession.findOne({ doctorId, date });
  if (!session) {
    try {
      session = await QueueSession.create({
        doctorId,
        date,
        sessionState: "CREATED",
        scheduleSnapshot: {
          startTime: "09:00",
          endTime: "17:00",
          queueLimit: doctor.defaultQueueLimit || 50,
          doctorName: doctor.name,
          hospitalName: doctor.hospitalId?.name || "Partnered Hospital",
          averageConsultationTime: doctor.avgConsultationTime || 10,
          scheduleVersion: 1
        }
      });
    } catch (createErr) {
      if (createErr.code === 11000) {
        session = await QueueSession.findOne({ doctorId, date });
      } else {
        throw createErr;
      }
    }
  }

  // Hospital code initials
  const hospName = doctor.hospitalId?.name || "General Hospital";
  const hospCode = hospName
    .split(" ")
    .map(w => w[0].toUpperCase())
    .join("")
    .substring(0, 3);
  const cleanDate = date.replace(/-/g, "").substring(2);

  // Atomic Running Number Counter per hospital & date
  const counter = await BookingCounter.findOneAndUpdate(
    { hospitalId: doctor.hospitalId._id, date },
    { $inc: { count: 1 } },
    { upsert: true, new: true, returnDocument: "after" }
  );

  const runningNum = String(counter.count).padStart(4, "0");
  const bookingNumber = `${hospCode}-${cleanDate}-${runningNum}`;

  const booking = await AppointmentBooking.create({
    bookingNumber,
    userId,
    doctorId,
    hospitalId: doctor.hospitalId._id,
    sessionId: session._id,
    date,
    slotTime,
    status: "BOOKED",
    arrivalStatus: "NOT_ARRIVED"
  });

  // Log audit timeline
  await logTimeline(booking._id, "patient", userId, "BOOKED", "web_portal", {
    bookingNumber,
    slotTime,
    date
  });

  // Schedule notifications
  await scheduleReminders(booking);

  // Continuous KPI aggregates update
  await incrementKPI(doctor.hospitalId._id, date, { totalBookings: 1, totalSlotsBooked: 1 });

  // Emit websocket events
  try {
    await dispatchToDoctor(doctorId, "BOOKING_CREATED", { bookingNumber, slotTime });
  } catch (wsErr) {
    console.error("Realtime event emit failed:", wsErr);
  }

  return booking;
};

/**
 * checkInAppointment
 */
export const checkInAppointment = async (bookingSearch, hospitalId, method = "app", operatorId = null, reason = null) => {
  const booking = await AppointmentBooking.findOne({
    hospitalId,
    $or: [
      { bookingNumber: bookingSearch },
      { userId: mongoose.isValidObjectId(bookingSearch) ? bookingSearch : new mongoose.Types.ObjectId() }
    ]
  }).populate("userId");

  if (!booking) {
    // Attempt lookup by patient phone
    const user = await User.findOne({ phone: bookingSearch });
    if (user) {
      const byPhone = await AppointmentBooking.findOne({
        hospitalId,
        userId: user._id,
        date: getTodayIST(),
        status: { $in: ["BOOKED", "CONFIRMED", "REMINDER_SENT"] }
      });
      if (byPhone) return executeCheckIn(byPhone, method, operatorId, reason);
    }
    throw new Error("No active booking found matching search credentials.");
  }

  return executeCheckIn(booking, method, operatorId, reason);
};

const executeCheckIn = async (booking, method, operatorId, reason) => {
  const now = new Date();

  // Enforce mandatory reception override check
  if (method === "reception") {
    if (!operatorId || !reason) {
      throw new Error("Reason and Operator ID are mandatory for reception overrides.");
    }
  }

  if (booking.status === "READY" || booking.arrivalStatus === "CHECKED_IN") {
    throw new Error("Booking is already checked in.");
  }

  // Load policy configurations
  const policy = await HospitalSchedulingPolicy.findOne({ hospitalId: booking.hospitalId });
  const openBuffer = policy ? policy.checkInOpenMinutes : 30;
  const graceMinutes = policy ? policy.lateCheckInGraceMinutes : 10;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [slotH, slotM] = booking.slotTime.split(":").map(Number);
  const slotMinutes = slotH * 60 + slotM;

  // Manual reception override bypasses check-in window limits; bypassed globally for demo environment
  if (false && method !== "reception") {
    // Opening check: e.g. slotTime - 30 minutes
    if (currentMinutes < slotMinutes - openBuffer) {
      throw new Error(`Check-in window opens ${openBuffer} minutes before slot (${booking.slotTime}).`);
    }

    // Closing check: e.g. slotTime + graceMinutes
    if (currentMinutes > slotMinutes + graceMinutes) {
      // Mark automatically as NO_SHOW / CANCELLED
      booking.arrivalStatus = "NO_SHOW";
      booking.status = "CANCELLED";
      await booking.save();

      await logTimeline(booking._id, "system", null, "NO_SHOW", "system_worker", {
        reason: "Missed check-in window and grace parameters"
      });

      // Increment KPIs
      await incrementKPI(booking.hospitalId, booking.date, { totalNoShows: 1 });

      throw new Error("Check-in window closed. Booking marked as No Show.");
    }
  }

  // Check if checked in late
  const isLate = currentMinutes > slotMinutes;

  // Update checkin values
  booking.arrivalStatus = "CHECKED_IN";
  booking.status = "READY";
  booking.checkInTime = now;
  booking.checkInMethod = method;
  await booking.save();

  // Update queue status upon check-in verification
  try {
    const QueueModel = mongoose.model("Queue");
    const QueueSessionModel = mongoose.model("QueueSession");

    const queue = await QueueModel.findOne({
      userId: booking.userId,
      doctorId: booking.doctorId,
      sessionId: booking.sessionId,
      isActive: true
    });

    if (queue) {
      queue.status = "waiting";
      await queue.save();

      const { triggerQueueRealtimeEvents } = await import("./queue.service.js");
      const session = await QueueSessionModel.findById(booking.sessionId);
      await triggerQueueRealtimeEvents(booking.doctorId, session, null, queue, "CHECK_IN");
    }
  } catch (err) {
    console.error("Failed to update queue status during check-in:", err);
  }

  const actor = method === "reception" ? "receptionist" : "patient";
  const source = method === "reception" ? "reception_desk" : "mobile_app";

  await logTimeline(booking._id, actor, operatorId || booking.userId, "CHECKED_IN", source, {
    method,
    reason,
    isLate
  });

  // Calculate check-in delay metrics
  let checkInDelayMs = 0;
  if (isLate) {
    checkInDelayMs = (currentMinutes - slotMinutes) * 60 * 1000;
  }

  // Increment KPIs
  await incrementKPI(booking.hospitalId, booking.date, {
    totalCheckIns: 1,
    totalLateCheckIns: isLate ? 1 : 0,
    totalCheckInDelayMs: checkInDelayMs
  });

  // Broadcast updates
  try {
    await dispatchToDoctor(booking.doctorId, "PATIENT_READY", {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber
    });
  } catch (wsErr) {
    console.error("Realtime event checkin broadcast failed:", wsErr);
  }

  return booking;
};

/**
 * transferAppointment
 */
export const transferAppointment = async (bookingId, newDoctorId, reason, operatorId) => {
  // Validate mandatory override details
  if (!reason || !operatorId) {
    throw new Error("Reason and Operator ID are mandatory for reception overrides.");
  }

  const booking = await AppointmentBooking.findById(bookingId);
  if (!booking) throw new Error("Booking not found.");

  const previousDoctorId = booking.doctorId;

  booking.status = "TRANSFERRED";
  await booking.save();

  await logTimeline(booking._id, "receptionist", operatorId, "TRANSFERRED", "reception_desk", {
    reason,
    transferredToDoctorId: newDoctorId,
    previousDoctorId
  });

  // Create peer transfer Booking record with same bookingNumber
  const newBooking = await AppointmentBooking.create({
    bookingNumber: booking.bookingNumber,
    userId: booking.userId,
    doctorId: newDoctorId,
    hospitalId: booking.hospitalId,
    sessionId: booking.sessionId,
    date: booking.date,
    slotTime: booking.slotTime,
    status: "BOOKED",
    arrivalStatus: booking.arrivalStatus,
    transferredFromDoctorId: previousDoctorId
  });

  await logTimeline(newBooking._id, "system", null, "TRANSFERRED_RECEIVED", "system_worker", {
    previousBookingId: booking._id,
    transferredFromDoctorId: previousDoctorId
  });

  // Continuous KPI updates
  await incrementKPI(booking.hospitalId, booking.date, { totalTransfers: 1 });

  try {
    await dispatchToDoctor(previousDoctorId, "TRANSFERRED", { bookingNumber: booking.bookingNumber });
    await dispatchToDoctor(newDoctorId, "BOOKING_CREATED", { bookingNumber: booking.bookingNumber, slotTime: booking.slotTime });
  } catch (wsErr) {
    console.error("Realtime transfer broadcast failed:", wsErr);
  }

  return newBooking;
};
