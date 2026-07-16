import AppointmentBooking from "./appointment_booking.model.js";
import ReminderQueue from "./reminder_queue.model.js";
import AppointmentTimeline from "./appointment_timeline.model.js";
import { getTodayIST } from "../search/utils.js";
import { dispatchToUser, dispatchToDoctor } from "../realtime/event_dispatcher.js";

// Helper to parse "09:00" to minutes
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Process pending reminders scheduled in the queue
 */
export const processReminderQueue = async () => {
  const pending = await ReminderQueue.find({
    $or: [
      { status: "pending" },
      { status: "failed", retryCount: { $lt: 3 } }
    ],
    sendAt: { $lte: new Date() }
  }).populate("bookingId");

  for (const reminder of pending) {
    try {
      const booking = reminder.bookingId;
      if (booking && booking.status !== "CANCELLED") {
        // Emit WebSockets event and mock notification
        await dispatchToUser(booking.userId, "REMINDER_SENT", {
          bookingNumber: booking.bookingNumber,
          type: reminder.type,
          message: getReminderMessage(reminder.type, booking.slotTime)
        });

        // Add to timeline
        await AppointmentTimeline.create({
          bookingId: booking._id,
          actor: "system",
          event: "REMINDER_SENT",
          metadata: { type: reminder.type }
        });
      }

      reminder.status = "sent";
      await reminder.save();
    } catch (err) {
      reminder.retryCount = (reminder.retryCount || 0) + 1;
      reminder.error = err.message;
      if (reminder.retryCount >= (reminder.maxRetries || 3)) {
        reminder.status = "dlq";
        const booking = reminder.bookingId;
        if (booking) {
          await AppointmentTimeline.create({
            bookingId: booking._id,
            actor: "system",
            source: "system_worker",
            event: "REMINDER_DEAD_LETTER_QUEUE",
            metadata: { type: reminder.type, error: err.message }
          });
        }
      } else {
        reminder.status = "failed";
      }
      await reminder.save();
    }
  }
};

const getReminderMessage = (type, slotTime) => {
  if (type === "24h") return `Appointment tomorrow at ${slotTime}.`;
  if (type === "1h") return `Your consultation is expected in about 1 hour (${slotTime}).`;
  if (type === "30m") return `Please proceed towards the hospital. Slot: ${slotTime}.`;
  return `Doctor will call you shortly (10 minutes remaining).`;
};

/**
 * Automatically sweeps unchecked-in patients and marks them as NO_SHOW
 */
export const sweepNoShowAppointments = async () => {
  const todayStr = getTodayIST();
  const bookings = await AppointmentBooking.find({
    date: todayStr,
    arrivalStatus: "NOT_ARRIVED",
    status: { $in: ["BOOKED", "CONFIRMED", "REMINDER_SENT"] }
  });

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const booking of bookings) {
    const slotMinutes = parseTimeToMinutes(booking.slotTime);
    // Cutoff is 5 minutes before the slot time
    if (currentMinutes >= slotMinutes - 5) {
      booking.arrivalStatus = "NO_SHOW";
      booking.status = "CANCELLED";
      await booking.save();

      await AppointmentTimeline.create({
        bookingId: booking._id,
        actor: "system",
        event: "NO_SHOW",
        metadata: { reason: "Automatic no-show sweep (missed check-in cutoff)" }
      });

      try {
        await dispatchToDoctor(booking.doctorId, "NO_SHOW", {
          bookingNumber: booking.bookingNumber
        });
        await dispatchToUser(booking.userId, "NO_SHOW", {
          bookingNumber: booking.bookingNumber,
          message: "You missed your check-in cutoff buffer. The booking has been marked as No Show."
        });
      } catch (wsErr) {
        console.error("Realtime no-show sweep emit failed:", wsErr);
      }
    }
  }
};

// Scheduler tickers (runs every 10 seconds for testing convenience)
let timerId = null;
export const startReminderWorker = (intervalMs = 10000) => {
  if (timerId) return;
  timerId = setInterval(async () => {
    try {
      await processReminderQueue();
      await sweepNoShowAppointments();
    } catch (err) {
      console.error("Reminder Worker/No-Show Sweep Error:", err);
    }
  }, intervalMs);
};

export const stopReminderWorker = () => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
};
