import mongoose from "mongoose";

const patientConsentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  granteeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  granteeType: {
    type: String,
    enum: ["doctor", "hospital", "user"],
    required: true
  },
  scope: [{
    type: String,
    enum: ["view_records", "view_prescriptions", "view_timeline"]
  }],
  expiry: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ["granted", "revoked"],
    default: "granted"
  },
  reason: {
    type: String,
    default: ""
  }
}, { timestamps: true });

const PatientConsent = mongoose.models.PatientConsent || mongoose.model("PatientConsent", patientConsentSchema);
export default PatientConsent;
