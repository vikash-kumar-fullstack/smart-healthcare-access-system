import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true
  },

  specialization: {
    type: String,
    required: true
  },

  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true
  },

  avgConsultationTime: {
    type: Number, // minutes
    default: 5
  },

  defaultQueueLimit: {
    type: Number,
    default: 50
  },

  isAvailable: {
    type: Boolean,
    default: true
  },

  availabilityState: {
    type: String,
    enum: ["available", "break", "unavailable"],
    default: "available"
  },

  temporaryNotice: {
    message: {
      type: String,
      default: ""
    },
    expectedUntil: {
      type: Date
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },

  rating: {
    type: Number,
    default: 0
  },

  experienceYears: {
    type: Number,
    default: 0
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },

  status: {
    type: String,
    enum: ["pending_profile", "pending_activation", "active", "inactive", "suspended"],
    default: "pending_profile"
  },

  profileCompleted: {
    type: Boolean,
    default: false
  },

  completedProfileAt: Date,
  activatedAt: Date

}, { timestamps: true });

const Doctor = mongoose.model("Doctor", doctorSchema);

export default Doctor;