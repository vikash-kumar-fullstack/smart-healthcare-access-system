import mongoose from "mongoose";

const doctorAvailabilitySnapshotSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
    unique: true
  },
  available: {
    type: Boolean,
    required: true,
    default: false
  },
  currentQueue: {
    type: Number,
    required: true,
    default: 0
  },
  nextAvailable: {
    type: String,
    required: true,
    default: ""
  },
  lastComputedAt: {
    type: Date,
    required: true,
    default: Date.now
  }
}, { timestamps: true });

doctorAvailabilitySnapshotSchema.index({ doctorId: 1 }, { unique: true });

const DoctorAvailabilitySnapshot = mongoose.model("DoctorAvailabilitySnapshot", doctorAvailabilitySnapshotSchema);
export default DoctorAvailabilitySnapshot;
