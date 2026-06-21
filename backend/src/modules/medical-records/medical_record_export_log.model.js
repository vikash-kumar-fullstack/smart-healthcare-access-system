import mongoose from "mongoose";

const medicalRecordExportLogSchema = new mongoose.Schema({
  recordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MedicalRecord",
    required: true
  },
  exportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  format: {
    type: String,
    required: true
  },
  version: {
    type: Number,
    required: true
  }
}, { timestamps: true });

medicalRecordExportLogSchema.index({ recordId: 1 });
medicalRecordExportLogSchema.index({ exportedBy: 1 });

const MedicalRecordExportLog = mongoose.model("MedicalRecordExportLog", medicalRecordExportLogSchema);
export default MedicalRecordExportLog;
