import mongoose from "mongoose";

const medicalRecordAnalyticsDailySchema = new mongoose.Schema({
  date: {
    type: String, // Format: YYYY-MM-DD
    required: true,
    unique: true
  },
  recordsCreated: {
    type: Number,
    default: 0
  },
  attachmentsUploaded: {
    type: Number,
    default: 0
  },
  versionsCreated: {
    type: Number,
    default: 0
  },
  exportsGenerated: {
    type: Number,
    default: 0
  },
  archiveCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const MedicalRecordAnalyticsDaily = mongoose.model("MedicalRecordAnalyticsDaily", medicalRecordAnalyticsDailySchema);
export default MedicalRecordAnalyticsDaily;
