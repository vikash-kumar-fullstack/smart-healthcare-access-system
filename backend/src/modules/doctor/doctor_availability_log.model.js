import mongoose from "mongoose";

const doctorAvailabilityLogSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "QueueSession"
  },
  eventType: {
    type: String,
    enum: ["manual_change", "auto_delay", "session_pause", "session_resume"],
    required: true
  },
  state: {
    type: String,
    required: true
  },
  startedAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  durationMs: {
    type: Number
  }
}, { timestamps: true });

doctorAvailabilityLogSchema.index({ doctorId: 1, startedAt: -1 });

const DoctorAvailabilityLog = mongoose.model("DoctorAvailabilityLog", doctorAvailabilityLogSchema);
export default DoctorAvailabilityLog;
