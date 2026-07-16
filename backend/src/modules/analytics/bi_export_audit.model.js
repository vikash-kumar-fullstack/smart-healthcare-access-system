import mongoose from "mongoose";

const biExportAuditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  exportedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  format: {
    type: String,
    enum: ["pdf", "csv", "excel", "json"],
    required: true
  },
  filters: {
    type: Map,
    of: String
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital"
  },
  reportType: {
    type: String,
    required: true
  },
  reason: {
    type: String,
    default: "General Review"
  }
});

const BIExportAudit = mongoose.models.BIExportAudit || mongoose.model("BIExportAudit", biExportAuditSchema);
export default BIExportAudit;
