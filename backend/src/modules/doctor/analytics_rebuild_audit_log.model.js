import mongoose from "mongoose";

const analyticsRebuildAuditLogSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  startDate: {
    type: String,
    required: true
  },
  endDate: {
    type: String,
    required: true
  },
  timeTakenMs: {
    type: Number,
    default: 0
  },
  rowsRebuilt: {
    type: Number,
    default: 0
  },
  rebuildStatus: {
    type: String,
    enum: ["idle", "running", "completed", "failed"],
    default: "idle",
    required: true
  }
}, { timestamps: true });

analyticsRebuildAuditLogSchema.index({ doctorId: 1, createdAt: -1 });

const AnalyticsRebuildAuditLog = mongoose.model("AnalyticsRebuildAuditLog", analyticsRebuildAuditLogSchema);
export default AnalyticsRebuildAuditLog;
