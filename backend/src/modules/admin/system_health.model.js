import mongoose from "mongoose";

const systemHealthSchema = new mongoose.Schema({
  dbLatency: {
    type: Number,
    required: true
  },
  searchP95: {
    type: Number,
    required: true
  },
  notificationBacklog: {
    type: Number,
    required: true
  },
  queueBacklog: {
    type: Number,
    required: true
  },
  activeSockets: {
    type: Number,
    required: true
  },
  errorRate: {
    type: Number,
    required: true
  },
  cacheHitRate: {
    type: Number,
    required: true
  }
}, { timestamps: true });

const SystemHealth = mongoose.model("SystemHealth", systemHealthSchema);
export default SystemHealth;
