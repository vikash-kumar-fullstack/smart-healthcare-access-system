import mongoose from "mongoose";

const adminReportSchema = new mongoose.Schema({
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  reportType: {
    type: String,
    enum: ["doctor_performance", "queue_summary", "hospital_summary", "system_report"],
    required: true
  },
  status: {
    type: String,
    enum: ["requested", "processing", "completed", "failed"],
    default: "requested"
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  generatedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const AdminReport = mongoose.model("AdminReport", adminReportSchema);
export default AdminReport;
