import mongoose from "mongoose";

const hospitalSchedulingPolicySchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true,
    unique: true
  },
  bookingWindowDays: {
    type: Number,
    default: 7
  },
  bookingCutoffMinutes: {
    type: Number,
    default: 30
  },
  lateCheckInGraceMinutes: {
    type: Number,
    default: 5
  },
  allowLateArrival: {
    type: Boolean,
    default: true
  },
  allowTransfer: {
    type: Boolean,
    default: true
  },
  allowEmergencyWalkIn: {
    type: Boolean,
    default: true
  },
  walkInCapacity: {
    type: Number,
    default: 5
  },
  maxPatientsPerSession: {
    type: Number,
    default: 25
  },
  queueStrategy: {
    type: String,
    enum: ["booking_ready_queue"],
    default: "booking_ready_queue"
  },
  appointmentReminderPolicy: {
    type: Map,
    of: Boolean,
    default: {
      "24h": true,
      "1h": true,
      "30m": true,
      "10m": true
    }
  }
}, { timestamps: true });

const HospitalSchedulingPolicy = mongoose.model("HospitalSchedulingPolicy", hospitalSchedulingPolicySchema);
export default HospitalSchedulingPolicy;
