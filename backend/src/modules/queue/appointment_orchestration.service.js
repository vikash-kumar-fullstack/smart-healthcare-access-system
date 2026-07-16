import mongoose from "mongoose";
import AppointmentBooking from "./appointment_booking.model.js";
import AppointmentTimeline from "./appointment_timeline.model.js";
import ReminderQueue from "./reminder_queue.model.js";
import BookingCounter from "./booking_counter.model.js";
import HospitalSchedulingPolicy from "../hospital/hospital_scheduling_policy.model.js";
import Doctor from "../doctor/doctor.model.js";
import Hospital from "../hospital/hospital.model.js";
import QueueSession from "./queueSession.model.js";
import User from "../auth/auth.model.js";
import { getTodayIST } from "../search/utils.js";
import { dispatchToUser, dispatchToDoctor } from "../realtime/event_dispatcher.js";

// Helper to parse "09:00" to minutes
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

// Helper for timeline logging
export const logTimeline = async (bookingId, actor, actorId, event, metadata = {}) => {
  await AppointmentTimeline.create({
    bookingId,
    actor,
    actorId,
    event,
    metadata
  });
};

// Helper to schedule reminders
const scheduleReminders = async (booking) => {
  const slotDateTime = new Date(`${booking.date}T${booking.slotTime}:00`);
  const reminderSlots = [
    { type: "24h", durationMs: 24 * 60 * 60 * 1000 },
    { type: "1h", durationMs: 1 * 60 * 60 * 1000 },
    { type: "30m", durationMs: 30 * 60 * 1000 },
    { type: "10m", durationMs: 10 * 60 * 1000 }
  ];

  const reminders = [];
  const now = new Date();
  for (const r of reminderSlots) {
    const sendAt = new Date(slotDateTime.getTime() - r.durationMs);
    if (sendAt > now) {
      reminders.push({
        bookingId: booking._id,
        sendAt,
        type: r.type,
        status: "pending"
      });
    }
  }
  if (reminders.length > 0) {
    await ReminderQueue.insertMany(reminders);
  }
};

/**
 * bookAppointment
 */
export const bookAppointment = async (userId, doctorId, date, slotTime) => {
  const doctor = await Doctor.findById(doctorId).populate("hospitalId");
  if (!doctor) throw new Error("Doctor profile not found.");

  const policy = await HospitalSchedulingPolicy.findOne({ hospitalId: doctor.hospitalId });
  const windowDays = policy ? policy.bookingWindowDays : 7;

  // Check booking window dates
  const todayIST = getTodayIST();
  const today = new Date(todayIST);
  const targetDate = new Date(date);
  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0 || diffDays > windowDays) {
    throw new Error(`Booking outside allowed window of ${windowDays} days.`);
  }

  // Check duplicate slot booking
  const existing = await AppointmentBooking.findOne({
    doctorId,
    date,
    slotTime,
    status: { $nin: ["CANCELLED", "EXPIRED"] }
  });
  if (existing) throw new Error("This slot is already booked.");

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

  // Safe concurrency-safe counter atomic increment
  const counter = await BookingCounter.findOneAndUpdate(
    { hospitalId: doctor.hospitalId._id, date },
    { $inc: { count: 1 } },
    { upsert: true, new: true }
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
  await logTimeline(booking._id, "patient", userId, "BOOKED", {
    bookingNumber,
    slotTime,
    date
  });

  // Schedule notifications
  await scheduleReminders(booking);

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
export const checkInAppointment = async (bookingSearch, hospitalId, method = "app", operatorId = null) => {
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
        status: { $nin: ["CANCELLED", "EXPIRED"] }
      });
      if (byPhone) return executeCheckIn(byPhone, method, operatorId);
    }
    throw new Error("No active booking found for this search parameter.");
  }

  return executeCheckIn(booking, method, operatorId);
};

const executeCheckIn = async (booking, method, operatorId) => {
  if (booking.arrivalStatus === "CHECKED_IN") {
    throw new Error("Patient is already checked in.");
  }

  const policy = await HospitalSchedulingPolicy.findOne({ hospitalId: booking.hospitalId });
  const graceMinutes = policy ? policy.lateCheckInGraceMinutes : 5;

  const slotDateTime = new Date(`${booking.date}T${booking.slotTime}:00`);
  const checkInStart = new Date(slotDateTime.getTime() - 30 * 60 * 1000);
  const checkInEnd = new Date(slotDateTime.getTime() - 5 * 60 * 1000 + graceMinutes * 60 * 1000);
  const now = new Date();

  // Validate checkin windows if self checkin (app / qr); bypassed globally for demo environment
  if (false && method !== "reception") {
    if (now < checkInStart) {
      throw new Error("Check-in window opens 30 minutes before your slot time.");
    }
    if (now > checkInEnd) {
      booking.arrivalStatus = "NO_SHOW";
      booking.status = "CANCELLED";
      await booking.save();
      await logTimeline(booking._id, "system", null, "NO_SHOW", { reason: "Missed check-in window" });
      throw new Error("Check-in window closed. Marked as No Show.");
    }
  }

  // Update checkin values
  booking.arrivalStatus = "CHECKED_IN";
  booking.status = "READY";
  booking.checkInTime = now;
  booking.checkInMethod = method;
  await booking.save();

  const actor = method === "reception" ? "receptionist" : "patient";
  await logTimeline(booking._id, actor, operatorId || booking.userId, "CHECKED_IN", { method });

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
 * getReadyQueue
 */
export const getReadyQueue = async (doctorId, dateStr) => {
  // Finds all checked-in bookings today in strict chronological booking order
  const bookings = await AppointmentBooking.find({
    doctorId,
    date: dateStr,
    status: { $in: ["READY", "IN_CONSULTATION"] },
    arrivalStatus: "CHECKED_IN"
  })
    .sort({ slotTime: 1 })
    .populate("userId", "name phone");

  const currentlySeeing = bookings.find(b => b.status === "IN_CONSULTATION");

  return bookings.map((b, idx) => {
    const readyBefore = bookings.filter((other, oIdx) => other.status === "READY" && oIdx < idx).length;
    return {
      bookingId: b._id,
      bookingNumber: b.bookingNumber,
      slotTime: b.slotTime,
      patientName: b.userId?.name || "Anonymous",
      arrivalStatus: b.arrivalStatus,
      status: b.status,
      patientsReadyBefore: readyBefore,
      estimatedWaitMinutes: readyBefore * 10,
      currentlySeeing: currentlySeeing ? currentlySeeing.bookingNumber : "None"
    };
  });
};

/**
 * callNextPatient
 */
export const callNextPatient = async (doctorId, dateStr, operatorId = null) => {
  const readyList = await AppointmentBooking.find({
    doctorId,
    date: dateStr,
    status: "READY",
    arrivalStatus: "CHECKED_IN"
  }).sort({ slotTime: 1 });

  if (readyList.length === 0) {
    throw new Error("No ready patients waiting in the queue.");
  }

  // Clear current consultation if any
  await AppointmentBooking.updateMany(
    { doctorId, date: dateStr, status: "IN_CONSULTATION" },
    { $set: { status: "COMPLETED" } }
  );

  const nextBooking = readyList[0];
  nextBooking.status = "IN_CONSULTATION";
  await nextBooking.save();

  await logTimeline(nextBooking._id, "doctor", operatorId, "IN_CONSULTATION");

  try {
    await dispatchToDoctor(doctorId, "PATIENT_CALLED", {
      bookingNumber: nextBooking.bookingNumber,
      slotTime: nextBooking.slotTime
    });
  } catch (wsErr) {
    console.error("Realtime next patient broadcast failed:", wsErr);
  }

  return nextBooking;
};

/**
 * completeConsultation
 */
export const completeConsultation = async (bookingId, operatorId = null) => {
  const booking = await AppointmentBooking.findById(bookingId);
  if (!booking) throw new Error("Booking not found.");

  booking.status = "COMPLETED";
  await booking.save();

  await logTimeline(booking._id, "doctor", operatorId, "COMPLETED");

  try {
    await dispatchToDoctor(booking.doctorId, "CONSULTATION_COMPLETED", {
      bookingNumber: booking.bookingNumber
    });
  } catch (wsErr) {
    console.error("Realtime complete consultation broadcast failed:", wsErr);
  }

  return booking;
};

/**
 * transferAppointment
 */
export const transferAppointment = async (bookingId, newDoctorId, reason, operatorId = null) => {
  const booking = await AppointmentBooking.findById(bookingId);
  if (!booking) throw new Error("Booking not found.");

  const previousDoctorId = booking.doctorId;

  booking.status = "TRANSFERRED";
  await booking.save();

  await logTimeline(booking._id, "receptionist", operatorId, "TRANSFERRED", {
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

  await logTimeline(newBooking._id, "system", null, "TRANSFERRED_RECEIVED", {
    previousBookingId: booking._id,
    transferredFromDoctorId: previousDoctorId
  });

  try {
    await dispatchToDoctor(previousDoctorId, "TRANSFERRED", { bookingNumber: booking.bookingNumber });
    await dispatchToDoctor(newDoctorId, "BOOKING_CREATED", { bookingNumber: booking.bookingNumber, slotTime: booking.slotTime });
  } catch (wsErr) {
    console.error("Realtime transfer broadcast failed:", wsErr);
  }

  return newBooking;
};

/**
 * registerWalkIn
 */
export const registerWalkIn = async (hospitalId, doctorId, userId, isPriority = false, operatorId = null) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) throw new Error("Doctor profile not found.");

  const policy = await HospitalSchedulingPolicy.findOne({ hospitalId });
  if (policy && !policy.allowEmergencyWalkIn) {
    throw new Error("Emergency walk-in bookings are disabled by hospital policy.");
  }

  // Count active walk-ins today
  const walkinCount = await AppointmentBooking.countDocuments({
    hospitalId,
    date: getTodayIST(),
    notes: "Emergency Walk-in"
  });

  const limit = policy ? policy.walkInCapacity : 5;
  if (walkinCount >= limit) {
    throw new Error(`Walk-in capacity limit (${limit}) reached for today.`);
  }

  // Generate slot time dynamically (right now!)
  const now = new Date();
  const timeLabel = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  let session = await QueueSession.findOne({ doctorId, date: getTodayIST() });
  if (!session) {
    session = await QueueSession.create({
      doctorId,
      date: getTodayIST(),
      sessionState: "CREATED",
      scheduleSnapshot: {
        startTime: "09:00",
        endTime: "17:00",
        queueLimit: doctor.defaultQueueLimit || 50,
        doctorName: doctor.name,
        hospitalName: "Walkin Hospital",
        averageConsultationTime: doctor.avgConsultationTime || 10,
        scheduleVersion: 1
      }
    });
  }

  // Generate booking number
  const counter = await BookingCounter.findOneAndUpdate(
    { hospitalId, date: getTodayIST() },
    { $inc: { count: 1 } },
    { upsert: true, new: true }
  );
  const hospName = doctor.name; // fallback name
  const hospCode = "EMG";
  const cleanDate = getTodayIST().replace(/-/g, "").substring(2);
  const bookingNumber = `${hospCode}-${cleanDate}-${String(counter.count).padStart(4, "0")}`;

  const booking = await AppointmentBooking.create({
    bookingNumber,
    userId,
    doctorId,
    hospitalId,
    sessionId: session._id,
    date: getTodayIST(),
    slotTime: timeLabel,
    status: "READY",
    arrivalStatus: "CHECKED_IN",
    checkInTime: now,
    checkInMethod: "reception",
    notes: "Emergency Walk-in"
  });

  await logTimeline(booking._id, "receptionist", operatorId, "BOOKED_WALKIN", {
    isPriority,
    bookingNumber
  });

  try {
    await dispatchToDoctor(doctorId, "PATIENT_READY", { bookingNumber });
  } catch (wsErr) {
    console.error("Realtime walk-in ready emit failed:", wsErr);
  }

  return booking;
};
