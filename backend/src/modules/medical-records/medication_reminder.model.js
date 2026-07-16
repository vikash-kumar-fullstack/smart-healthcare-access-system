import mongoose from "mongoose";

const medicationReminderSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  visitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Visit",
    required: true,
    index: true
  },
  medicineName: {
    type: String,
    required: true
  },
  dosage: {
    type: String,
    required: true
  },
  timings: [{
    type: String,
    enum: ["morning", "afternoon", "evening", "night"]
  }],
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

const MedicationReminder = mongoose.models.MedicationReminder || mongoose.model("MedicationReminder", medicationReminderSchema);
export default MedicationReminder;
