import mongoose from "mongoose";

const systemHealthRollupSchema = new mongoose.Schema({
  period: {
    type: String,
    enum: ["daily", "weekly", "monthly"],
    required: true
  },
  date: {
    type: String,
    required: true
  },
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
  },
  recordsSampled: {
    type: Number,
    required: true
  }
}, { timestamps: true });

systemHealthRollupSchema.index({ period: 1, date: 1 }, { unique: true });

const SystemHealthRollup = mongoose.model("SystemHealthRollup", systemHealthRollupSchema);
export default SystemHealthRollup;
