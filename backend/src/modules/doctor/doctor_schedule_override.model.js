import mongoose from "mongoose";

const doctorScheduleOverrideSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  date: {
    type: String, // "YYYY-MM-DD"
    required: true
  },
  startTime: {
    type: String // "HH:MM" (optional if full day leave)
  },
  endTime: {
    type: String // "HH:MM" (optional if full day leave)
  },
  enabled: {
    type: Boolean,
    default: true // false = holiday/leave
  },
  isFullDay: {
    type: Boolean,
    default: false // true = full day block
  }
}, { timestamps: true });

doctorScheduleOverrideSchema.index({ doctorId: 1, date: 1 }, { unique: true });

const DoctorScheduleOverride = mongoose.model("DoctorScheduleOverride", doctorScheduleOverrideSchema);
export default DoctorScheduleOverride;
