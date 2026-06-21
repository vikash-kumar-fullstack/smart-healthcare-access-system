import mongoose from "mongoose";

const adminDashboardCacheSchema = new mongoose.Schema({
  dashboardVersion: {
    type: Number,
    default: 3,
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  activeDoctors: {
    type: Number,
    default: 0
  },
  activeHospitals: {
    type: Number,
    default: 0
  },
  activePatients: {
    type: Number,
    default: 0
  },
  bookings: {
    type: Number,
    default: 0
  },
  completionRate: {
    type: Number,
    default: 0
  },
  noShowRate: {
    type: Number,
    default: 0
  },
  retentionRate: {
    type: Number,
    default: 0
  },
  queueHealth: {
    type: Number,
    default: 0
  },
  systemHealth: {
    type: String,
    default: "healthy"
  }
}, { timestamps: true });

const AdminDashboardCache = mongoose.model("AdminDashboardCache", adminDashboardCacheSchema);
export default AdminDashboardCache;
