import mongoose from "mongoose";

const searchMonitoringDailySchema = new mongoose.Schema({
  date: {
    type: String, // "YYYY-MM-DD"
    required: true
  },
  scope: {
    type: String, // e.g. "global", etc.
    required: true,
    default: "global"
  },
  latencyP50: {
    type: Number,
    default: 0
  },
  latencyP95: {
    type: Number,
    default: 0
  },
  latencyP99: {
    type: Number,
    default: 0
  },
  latencyBuckets: [{
    type: Number
  }],
  cacheHit: {
    type: Number,
    default: 0
  },
  cacheMiss: {
    type: Number,
    default: 0
  },
  emptySearch: {
    type: Number,
    default: 0
  },
  spellCorrectionRate: {
    type: Number,
    default: 0
  },
  degradedCount: {
    type: Number,
    default: 0
  },
  successCount: {
    type: Number,
    default: 0
  },
  failureCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

searchMonitoringDailySchema.index({ date: 1, scope: 1 }, { unique: true });

const SearchMonitoringDaily = mongoose.model("SearchMonitoringDaily", searchMonitoringDailySchema);
export default SearchMonitoringDaily;
