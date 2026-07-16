import mongoose from "mongoose";

const oauthAuditSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    enum: ["google", "linkedin"],
    required: true
  },
  role: {
    type: String,
    default: "unknown"
  },
  status: {
    type: String,
    enum: ["success", "failure"],
    required: true
  },
  errorMessage: {
    type: String,
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const OAuthAudit = mongoose.models.OAuthAudit || mongoose.model("OAuthAudit", oauthAuditSchema);

export default OAuthAudit;
