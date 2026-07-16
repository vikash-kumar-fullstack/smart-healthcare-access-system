import mongoose from "mongoose";

const realtimeMonitoringSchema = new mongoose.Schema({
  activeConnections: {
    type: Number,
    default: 0
  },
  disconnectRate: {
    type: Number,
    default: 0
  },
  ackRate: {
    type: Number,
    default: 0
  },
  retryRate: {
    type: Number,
    default: 0
  },
  recoveryRate: {
    type: Number,
    default: 0
  },
  avgLatency: {
    type: Number,
    default: 0
  },
  avgAckLatency: {
    type: Number,
    default: 0
  },
  p95AckLatency: {
    type: Number,
    default: 0
  },
  eventsPerMinute: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const RealtimeMonitoring = mongoose.model("RealtimeMonitoring", realtimeMonitoringSchema);
export default RealtimeMonitoring;
