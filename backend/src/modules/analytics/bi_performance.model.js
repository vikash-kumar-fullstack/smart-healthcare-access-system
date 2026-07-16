import mongoose from "mongoose";

const biPerformanceSchema = new mongoose.Schema({
  endpoint: {
    type: String,
    required: true,
    index: true
  },
  queryTimeMs: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
});

const BIQueryPerformance = mongoose.models.BIQueryPerformance || mongoose.model("BIQueryPerformance", biPerformanceSchema);
export default BIQueryPerformance;
