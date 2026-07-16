import mongoose from "mongoose";

const patientTimelineEventSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  actorRole: {
    type: String,
    enum: ["patient", "doctor", "receptionist", "system"],
    required: true
  },
  source: {
    type: String,
    enum: ["mobile_app", "web_portal", "reception_desk", "system_worker"],
    required: true
  },
  eventType: {
    type: String,
    enum: [
      "APPOINTMENT_BOOKED",
      "CHECKED_IN",
      "VISIT_COMPLETED",
      "PRESCRIPTION_CREATED",
      "LAB_ORDERED",
      "REPORT_UPLOADED",
      "FOLLOW_UP",
      "MEDICINE_COMPLETED"
    ],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  referenceType: {
    type: String,
    enum: ["Appointment", "Visit", "Prescription", "LabOrder", "Report", "FollowUp", "Reminder", "AppointmentBooking"],
    required: true
  },
  referenceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

patientTimelineEventSchema.index({ patientId: 1, timestamp: 1 });
patientTimelineEventSchema.index({ eventType: 1 });

const PatientTimelineEvent = mongoose.models.PatientTimelineEvent || mongoose.model("PatientTimelineEvent", patientTimelineEventSchema);
export default PatientTimelineEvent;
