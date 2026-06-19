import mongoose from "mongoose";

const systemMonitoringSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    default: "global"
  },
  analytics_generation_ms: {
    type: Number,
    default: 0
  },
  rebuild_ms: {
    type: Number,
    default: 0
  },
  booking_block_count: {
    type: Number,
    default: 0
  },
  queue_transition_count: {
    type: Number,
    default: 0
  },
  notification_ack_race_count: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const SystemMonitoring = mongoose.model("SystemMonitoring", systemMonitoringSchema);

export const incrementSystemMetric = async (key, val = 1) => {
  try {
    await SystemMonitoring.findOneAndUpdate(
      { name: "global" },
      { $inc: { [key]: val } },
      { upsert: true, returnDocument: "after" }
    );
  } catch (err) {
    console.error("Failed to update system monitoring metric:", err);
  }
};

export default SystemMonitoring;
