import mongoose from "mongoose";

const doctorScheduleSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  dayOfWeek: {
    type: Number, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    required: true,
    min: 0,
    max: 6
  },
  startTime: {
    type: String, // "HH:MM" format (24h)
    required: true
  },
  endTime: {
    type: String, // "HH:MM" format (24h)
    required: true
  },
  enabled: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

doctorScheduleSchema.index({ doctorId: 1, dayOfWeek: 1 }, { unique: true });

const DoctorSchedule = mongoose.model("DoctorSchedule", doctorScheduleSchema);
export default DoctorSchedule;
