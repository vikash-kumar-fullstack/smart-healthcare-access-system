import mongoose from "mongoose";

const realtimeEventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true
  },
  sequenceNumber: {
    type: Number,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      "QUEUE_UPDATED",
      "VISIT_STARTED",
      "VISIT_COMPLETED",
      "NOTIFICATION",
      "EMR_UPDATED",
      "QUEUE_REASSIGNED",
      "SESSION_PAUSED",
      "CHECKIN_STARTED",
      "CHECKIN_COMPLETED",
      "PATIENT_READY",
      "PATIENT_CALLED",
      "CONSULTATION_STARTED",
      "CONSULTATION_COMPLETED",
      "NO_SHOW",
      "TRANSFERRED",
      "BOOKING_CREATED",
      "BOOKING_REBOOKED",
      "REMINDER_SENT",
      "PRESCRIPTION_CREATED",
      "REPORT_UPLOADED",
      "FOLLOWUP_CREATED",
      "MEDICATION_REMINDER",
      "LAB_COMPLETED",
      "PATIENT_TIMELINE_UPDATED"
    ]
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "sent", "acked", "dlq"],
    default: "pending"
  },
  eventVersion: {
    type: Number,
    default: 1
  },
  idempotencyKey: {
    type: String,
    required: true,
    unique: true
  },
  retryCount: {
    type: Number,
    default: 0
  },
  lastSentAt: {
    type: Date
  },
  ackLatencyMs: {
    type: Number
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, { timestamps: true });

realtimeEventSchema.index({ userId: 1, sequenceNumber: 1 }, { unique: true });
realtimeEventSchema.index({ idempotencyKey: 1 }, { unique: true });
realtimeEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RealtimeEvent = mongoose.model("RealtimeEvent", realtimeEventSchema);
export default RealtimeEvent;
