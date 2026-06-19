import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  action: {
    type: String,
    enum: ["start_session", "pause_session", "resume_session", "close_session", "completed", "skipped", "no_show"],
    required: true
  },
  queueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Queue"
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;
