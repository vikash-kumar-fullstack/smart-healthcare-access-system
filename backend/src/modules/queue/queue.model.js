import mongoose from "mongoose";
import { incrementSystemMetric } from "../doctor/system_monitoring.model.js";

const queueSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },

  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "QueueSession",
    required: true
  },

  queueNumber: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: ["waiting", "in_progress", "completed", "cancelled", "skipped", "no_show"],
    default: "waiting"
  },

  isPriority: {
    type: Boolean,
    default: false
  },

  bookedAt: {
    type: Date,
    default: Date.now
  },

  startedAt: Date,
  completedAt: Date,
  cancelledAt: Date,

  cancelReason: {
    type: String,
    enum: ["patient_cancelled", "session_closed", "doctor_cancelled"],
    default: null
  },

  closedReason: {
    type: String,
    enum: ["no_show", "completed", "skipped"],
    default: null
  },

  estimatedStartTime: Date,

  consultationDurationMs: Number,

  analyticsProcessed: {
    type: Boolean,
    default: false
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

queueSchema.index({ doctorId: 1, sessionId: 1 });
queueSchema.index({ doctorId: 1, status: 1 });
queueSchema.index({ doctorId: 1, createdAt: -1 });
queueSchema.index(
  { userId: 1, isActive: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

queueSchema.post("init", function (doc) {
  doc._originalStatus = doc.status;
});

queueSchema.pre("save", async function () {
  if (!this.isNew && this.isModified()) {
    const oldStatus = this._originalStatus || this.get("status", null, { getters: false });
    if (["completed", "no_show", "cancelled"].includes(oldStatus)) {
      throw new Error("Queue entry is immutable after completion/cancellation (Lock 1).");
    }
  }

  if (this.isModified("status")) {
    const oldStatus = this._originalStatus;
    const newStatus = this.status;
    if (oldStatus !== undefined && oldStatus !== newStatus) {
      incrementSystemMetric("queue_transition_count", 1).catch(err => {
        console.error("Failed to increment queue transition count metric:", err);
      });
    }
    this._originalStatus = newStatus;
  }
});

const Queue = mongoose.model("Queue", queueSchema);
export default Queue;
