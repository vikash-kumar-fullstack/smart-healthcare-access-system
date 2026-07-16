import DoctorAvailabilitySnapshot from "./doctor_availability_snapshot.model.js";
import DoctorSchedule from "../doctor/doctor_schedule.model.js";
import DoctorScheduleOverride from "../doctor/doctor_schedule_override.model.js";
import Doctor from "../doctor/doctor.model.js";
import QueueSession from "../queue/queueSession.model.js";
import Queue from "../queue/queue.model.js";
import { getNextAvailableSlot } from "../doctor/doctor.service.js";
import { getTodayIST, incrementAvailabilityVersion } from "./utils.js";

export const isDoctorOnShift = async (doctorId, now = new Date()) => {
  if (process.env.NODE_ENV !== "production") {
    return true; // Always on shift for demo/testing convenience (24/7 Availability)
  }
  const options = { timeZone: "Asia/Kolkata" };
  const formatter = new Intl.DateTimeFormat("en-US", {
    ...options,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const getPart = (type) => parts.find(p => p.type === type).value;
  
  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");
  
  const dateStr = `${year}-${month}-${day}`; // "YYYY-MM-DD"
  const timeStr = `${hour}:${minute}`; // "HH:MM"
  
  // 1. Check override for today
  const override = await DoctorScheduleOverride.findOne({ doctorId, date: dateStr });
  if (override) {
    if (override.isFullDay || !override.enabled) {
      return false; // Leave/Holiday
    }
    return timeStr >= override.startTime && timeStr <= override.endTime;
  }
  
  // 2. Check regular schedule
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const schedule = await DoctorSchedule.findOne({ doctorId, dayOfWeek });
  if (!schedule || !schedule.enabled) {
    return false;
  }
  
  return timeStr >= schedule.startTime && timeStr <= schedule.endTime;
};

export const updateDoctorAvailabilitySnapshot = async (doctorId) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor) return null;

  const today = getTodayIST();
  const now = new Date();

  // 1. Check if doctor is currently on shift
  const onShift = await isDoctorOnShift(doctorId, now);

  // 2. Retrieve active session for today
  const session = await QueueSession.findOne({ doctorId, date: today });
  const sessionActive = session && ["active", "paused"].includes(session.sessionStatus);

  // 3. Count waiting patients
  const currentQueue = await Queue.countDocuments({
    doctorId,
    status: "waiting",
    isActive: true
  });

  // 4. Evaluate availability flag
  const isSuspendedOrInactive = ["suspended", "inactive", "pending_profile", "pending_activation"].includes(doctor.status);
  const isDoctorSettingAvailable = !doctor.availabilityState || doctor.availabilityState === "available" || doctor.availabilityState === "break";
  
  const limit = session?.maxQueueLimit || doctor.defaultQueueLimit || 50;
  const queueIsFull = currentQueue >= limit;

  // Available iff:
  // - Doctor status is active
  // - Doctor settings say available/break
  // - On shift OR has a session currently active/paused
  // - Queue is not full
  const available = !isSuspendedOrInactive && isDoctorSettingAvailable && (onShift || sessionActive) && !queueIsFull;

  // 5. Get next slot label
  const nextAvailable = available ? "Now" : await getNextAvailableSlot(doctorId, today);

  // 6. Update snapshot database document
  const snapshot = await DoctorAvailabilitySnapshot.findOneAndUpdate(
    { doctorId },
    {
      available,
      currentQueue,
      nextAvailable,
      lastComputedAt: now
    },
    { upsert: true, new: true }
  );

  // Invalidate cache by incrementing availability version
  await incrementAvailabilityVersion();

  return snapshot;
};

// Safeguard function to retrieve snapshot with 2-minute max age recompute rule
export const getOrRecomputeSnapshot = async (doctorId) => {
  let snapshot = await DoctorAvailabilitySnapshot.findOne({ doctorId });
  const now = new Date();
  
  if (!snapshot || (now.getTime() - new Date(snapshot.lastComputedAt).getTime() > 120000)) {
    snapshot = await updateDoctorAvailabilitySnapshot(doctorId);
  }
  
  return snapshot;
};
