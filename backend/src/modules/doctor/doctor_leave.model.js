import mongoose from "mongoose";

const doctorLeaveSchema = new mongoose.Schema({
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  leaveType: {
    type: String,
    enum: ["half_day", "full_day", "multiple_days", "emergency"],
    required: true
  },
  startDate: {
    type: String, // "YYYY-MM-DD"
    required: true
  },
  endDate: {
    type: String, // "YYYY-MM-DD"
    required: true
  },
  startTime: {
    type: String // "HH:MM" for half_day/emergency
  },
  endTime: {
    type: String // "HH:MM" for half_day/emergency
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrence: {
    dayOfWeek: { type: Number }, // 0 = Sunday, 1 = Monday ...
    weeksCount: { type: Number, default: 8 }
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  reason: {
    type: String
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

doctorLeaveSchema.index({ doctorId: 1, startDate: 1, endDate: 1 });

const DoctorLeave = mongoose.model("DoctorLeave", doctorLeaveSchema);
export default DoctorLeave;
