import mongoose from "mongoose";

const patientStatsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  reliabilityScore: {
    type: Number,
    default: 100
  },
  noShowCount: {
    type: Number,
    default: 0
  },
  noShowCountThisMonth: {
    type: Number,
    default: 0
  },
  completedVisits: {
    type: Number,
    default: 0
  },
  cancelledVisits: {
    type: Number,
    default: 0
  },
  lastNoShowAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const PatientStats = mongoose.model("PatientStats", patientStatsSchema);
export default PatientStats;
