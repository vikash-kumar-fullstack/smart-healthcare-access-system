import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  deviceName: {
    type: String,
    default: "Unknown Device"
  },
  browser: {
    type: String,
    default: "Unknown Browser"
  },
  platform: {
    type: String,
    default: "Unknown Platform"
  },
  ipAddress: {
    type: String,
    default: ""
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  refreshTokenHash: {
    type: String,
    required: true,
    unique: true
  }
}, { timestamps: false });

const Session = mongoose.model("Session", sessionSchema);
export default Session;
