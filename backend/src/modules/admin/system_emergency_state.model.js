import mongoose from "mongoose";

const systemEmergencyStateSchema = new mongoose.Schema({
  singletonKey: {
    type: String,
    default: "global",
    unique: true,
    required: true
  },
  pauseBookings: {
    type: Boolean,
    default: false
  },
  readonly: {
    type: Boolean,
    default: false
  },
  maintenance: {
    type: Boolean,
    default: false
  },
  activatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  reason: {
    type: String,
    default: ""
  },
  activatedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const SystemEmergencyState = mongoose.model("SystemEmergencyState", systemEmergencyStateSchema);
export default SystemEmergencyState;
