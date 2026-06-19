import mongoose from "mongoose";

const doctorAnalyticsDailySchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  date: {
    type: String, // Format: YYYY-MM-DD (Asia/Kolkata timezone)
    required: true
  },
  periodStartAt: {
    type: Date,
    required: true
  },
  periodEndAt: {
    type: Date,
    required: true
  },
  completed: {
    type: Number,
    default: 0
  },
  skipped: {
    type: Number,
    default: 0
  },
  noShow: {
    type: Number,
    default: 0
  },
  cancelled: {
    type: Number,
    default: 0
  },
  totalConsultationMinutes: {
    type: Number,
    default: 0
  },
  consultationCount: {
    type: Number,
    default: 0
  },
  totalWaitMinutes: {
    type: Number,
    default: 0
  },
  waitCount: {
    type: Number,
    default: 0
  },
  activeSessionMinutes: {
    type: Number,
    default: 0
  },
  pausedMinutes: {
    type: Number,
    default: 0
  },
  uniquePatients: {
    type: Number,
    default: 0
  },
  returningPatients: {
    type: Number,
    default: 0
  },
  analyticsVersion: {
    type: Number,
    default: 1
  }
}, { timestamps: true });

// Ensure unique cache per doctor per date
doctorAnalyticsDailySchema.index({ doctorId: 1, date: 1 }, { unique: true });

const DoctorAnalyticsDaily = mongoose.model("DoctorAnalyticsDaily", doctorAnalyticsDailySchema);
export default DoctorAnalyticsDaily;
