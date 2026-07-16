import mongoose from "mongoose";

const appointmentTimelineSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AppointmentBooking",
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  actor: {
    type: String,
    enum: ["patient", "receptionist", "doctor", "system"],
    required: true
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  source: {
    type: String,
    enum: ["mobile_app", "web_portal", "reception_desk", "system_worker"],
    required: true,
    default: "web_portal"
  },
  event: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

const AppointmentTimeline = mongoose.model("AppointmentTimeline", appointmentTimelineSchema);
export default AppointmentTimeline;
