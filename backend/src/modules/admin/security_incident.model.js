import mongoose from "mongoose";

const securityIncidentSchema = new mongoose.Schema({
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium"
  },
  category: {
    type: String,
    enum: ["LOGIN_ABUSE", "RATE_LIMIT_TRIGGER", "ACCESS_DENIED", "TOKEN_REUSE", "SESSION_HIJACK_ATTEMPT", "API_ABUSE_ATTEMPT"],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  detectedAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date,
    default: null
  },
  affectedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  status: {
    type: String,
    enum: ["open", "resolved"],
    default: "open"
  }
}, { timestamps: false });

const SecurityIncident = mongoose.model("SecurityIncident", securityIncidentSchema);
export default SecurityIncident;
