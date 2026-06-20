import mongoose from "mongoose";

/**
 * Session States:
 *  inactive  – session created, doctor hasn't started yet
 *  active    – doctor is currently seeing patients
 *  paused    – doctor is on a temporary break
 *  closed    – doctor has ended the day (no new bookings)
 */
const queueSessionSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },

  date: {
    type: String, // "YYYY-MM-DD"
    required: true
  },

  currentQueueNumber: {
    type: Number,
    default: 0
  },

  maxQueueLimit: {
    type: Number,
    default: 50
  },

  scheduleSnapshot: {
    startTime: { type: String },
    endTime: { type: String },
    queueLimit: { type: Number }
  },

  // Full state machine field
  sessionStatus: {
    type: String,
    enum: ["inactive", "active", "paused", "closed", "closing"],
    default: "inactive"
  },

  // Kept for backward-compatibility; always mirrors sessionStatus
  isActive: {
    type: Boolean,
    default: false
  },

  startedAt: { type: Date },
  pausedAt:  { type: Date },
  closedAt:  { type: Date },
  accumulatedPausedMs: {
    type: Number,
    default: 0
  },
  lastActiveSegmentStartedAt: { type: Date }

}, { timestamps: true });

queueSessionSchema.index({ doctorId: 1, date: 1 }, { unique: true });
queueSessionSchema.index({ doctorId: 1, sessionStatus: 1, date: -1 });

queueSessionSchema.post("save", async function (doc) {
  try {
    const { updateDoctorAvailabilitySnapshot } = await import("../search/availability.service.js");
    const { incrementQueueVersion } = await import("../search/utils.js");
    await incrementQueueVersion();
    await updateDoctorAvailabilitySnapshot(doc.doctorId);
  } catch (err) {
    console.error("Failed to update availability snapshot on queue session save:", err);
  }
});

const QueueSession = mongoose.model("QueueSession", queueSessionSchema);

export default QueueSession;