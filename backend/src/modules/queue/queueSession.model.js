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
    queueLimit: { type: Number },
    doctorName: { type: String },
    hospitalName: { type: String },
    averageConsultationTime: { type: Number },
    scheduleVersion: { type: Number }
  },

  // Deterministic state machine field
  sessionState: {
    type: String,
    enum: ["CREATED", "READY", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"],
    default: "CREATED"
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

queueSessionSchema.pre("save", function () {
  if (this.isModified("sessionStatus")) {
    const status = this.sessionStatus;
    if (status === "inactive") this.sessionState = "CREATED";
    else if (status === "active") this.sessionState = "ACTIVE";
    else if (status === "paused") this.sessionState = "PAUSED";
    else if (status === "closed" || status === "closing") this.sessionState = "COMPLETED";
  } else if (this.isModified("sessionState")) {
    const state = this.sessionState;
    if (state === "CREATED" || state === "READY") {
      this.sessionStatus = "inactive";
      this.isActive = false;
    } else if (state === "ACTIVE") {
      this.sessionStatus = "active";
      this.isActive = true;
    } else if (state === "PAUSED") {
      this.sessionStatus = "paused";
      this.isActive = true;
    } else if (state === "COMPLETED" || state === "CANCELLED") {
      this.sessionStatus = "closed";
      this.isActive = false;
    }
  }
});

queueSessionSchema.index({ doctorId: 1, date: 1, "scheduleSnapshot.startTime": 1 }, { unique: true });
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