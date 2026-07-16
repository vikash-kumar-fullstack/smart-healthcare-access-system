import mongoose from "mongoose";

const queueKPISchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true
  },
  date: {
    type: String,
    required: true
  },
  totalBookings: {
    type: Number,
    default: 0
  },
  totalCheckIns: {
    type: Number,
    default: 0
  },
  totalNoShows: {
    type: Number,
    default: 0
  },
  totalTransfers: {
    type: Number,
    default: 0
  },
  totalCompletions: {
    type: Number,
    default: 0
  },
  totalLateCheckIns: {
    type: Number,
    default: 0
  },
  totalWaitTimeMs: {
    type: Number,
    default: 0
  },
  totalCheckInDelayMs: {
    type: Number,
    default: 0
  },
  totalSlotsBooked: {
    type: Number,
    default: 0
  },
  totalSlotsAvailable: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

queueKPISchema.index({ hospitalId: 1, date: 1 }, { unique: true });

const QueueKPI = mongoose.model("QueueKPI", queueKPISchema);
export default QueueKPI;
