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

doctorScheduleOverrideSchema.post("save", async function (doc) {
  try {
    const { updateDoctorAvailabilitySnapshot } = await import("../search/availability.service.js");
    const { incrementAvailabilityVersion } = await import("../search/utils.js");
    await incrementAvailabilityVersion();
    await updateDoctorAvailabilitySnapshot(doc.doctorId);
  } catch (err) {
    console.error("Failed to update availability snapshot on schedule override save:", err);
  }
});

const DoctorScheduleOverride = mongoose.model("DoctorScheduleOverride", doctorScheduleOverrideSchema);
export default DoctorScheduleOverride;
