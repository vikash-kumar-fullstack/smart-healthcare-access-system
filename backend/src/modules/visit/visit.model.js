import mongoose from "mongoose";

const visitSchema = new mongoose.Schema({
  publicId: {
    type: String,
    required: true,
    unique: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true
  },
  queueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Queue",
    required: true,
    unique: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "QueueSession",
    required: true
  },
  bookingDate: {
    type: String,
    required: true
  },
  startedAt: Date,
  endedAt: Date,
  status: {
    type: String,
    enum: ["scheduled", "waiting", "in_progress", "completed", "cancelled", "no_show"],
    default: "scheduled"
  },
  consultationDurationMs: {
    type: Number,
    default: 0
  },
  visitOutcome: {
    type: String,
    enum: ["consulted", "follow_up_required", "referred", "cancelled", "no_show", "session_closed"]
  },
  latestSummaryVersion: {
    type: Number,
    default: 0
  },
  timelineSequence: {
    type: Number,
    default: 0
  },
  doctorSnapshot: {
    name: { type: String, required: true },
    specialization: { type: String, required: true },
    hospitalName: { type: String, required: true }
  },
  patientSnapshot: {
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String }
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  version: {
    type: Number,
    default: 1
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

visitSchema.index({ patientId: 1, bookingDate: 1 });
visitSchema.index({ doctorId: 1, bookingDate: 1 });
visitSchema.index({ status: 1 });

const Visit = mongoose.model("Visit", visitSchema);
export default Visit;
