import mongoose from "mongoose";

const doctorBreakSchema = new mongoose.Schema({
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
    type: String, // "HH:MM"
    required: true
  },
  endTime: {
    type: String, // "HH:MM"
    required: true
  },
  breakType: {
    type: String,
    enum: ["lunch", "meeting", "emergency_break", "custom"],
    default: "lunch"
  },
  reason: {
    type: String
  }
}, { timestamps: true });

doctorBreakSchema.index({ doctorId: 1, date: 1, startTime: 1 });

const DoctorBreak = mongoose.model("DoctorBreak", doctorBreakSchema);
export default DoctorBreak;
