import mongoose from "mongoose";
import { encrypt, decrypt } from "../../utils/crypto.service.js";

const patientHealthProfileSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  bloodGroup: {
    type: String,
    required: true
  },
  allergies: [String],
  chronicDiseases: [String],
  currentMedications: [String],
  height: { type: Number, default: null },
  weight: { type: Number, default: null },
  emergencyContact: {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    relation: { type: String, required: true }
  },
  medicalAlerts: [String],
  vaccinationSummary: [
    {
      name: { type: String, required: true },
      date: Date,
      dose: String
    }
  ],
  primaryHospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital"
  },
  primaryDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor"
  },
  lastVisitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Visit"
  },
  healthRiskFlags: [String],
  organDonor: {
    type: Boolean,
    default: false
  },
  smoking: {
    type: String,
    enum: ["never", "former", "active"],
    default: "never"
  },
  alcohol: {
    type: String,
    enum: ["never", "occasional", "heavy"],
    default: "never"
  },
  pregnancyStatus: {
    type: String,
    enum: ["not_pregnant", "pregnant", "unknown"],
    default: "not_pregnant"
  },
  disabilityFlags: [String],
  preferredLanguage: {
    type: String,
    default: "English"
  }
}, { timestamps: true });

patientHealthProfileSchema.pre("save", function () {
  if (this.emergencyContact && this.emergencyContact.phone) {
    this.emergencyContact.phone = encrypt(this.emergencyContact.phone);
  }
});

patientHealthProfileSchema.post("init", function (doc) {
  if (doc.emergencyContact && doc.emergencyContact.phone) {
    doc.emergencyContact.phone = decrypt(doc.emergencyContact.phone);
  }
});

patientHealthProfileSchema.post("save", function (doc) {
  if (doc.emergencyContact && doc.emergencyContact.phone) {
    doc.emergencyContact.phone = decrypt(doc.emergencyContact.phone);
  }
});

const PatientHealthProfile = mongoose.models.PatientHealthProfile || mongoose.model("PatientHealthProfile", patientHealthProfileSchema);
export default PatientHealthProfile;
