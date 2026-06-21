import mongoose from "mongoose";

const medicalRecordVersionSchema = new mongoose.Schema({
  recordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MedicalRecord",
    required: true
  },
  version: {
    type: Number,
    required: true
  },
  summary: {
    chiefComplaint: { type: String, required: true },
    doctorNotes: { type: String, required: true },
    consultationSummary: { type: String, required: true },
    followUpAdvice: { type: String, default: "" }
  },
  diagnosis: [
    {
      name: { type: String, required: true },
      severity: {
        type: String,
        enum: ["high", "medium", "low"],
        default: "low"
      },
      confidence: { type: Number, default: 100 },
      notes: { type: String, default: "" },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
    }
  ],
  medications: [
    {
      name: { type: String, required: true },
      dosage: { type: String, required: true },
      frequency: { type: String, required: true },
      duration: { type: String, required: true },
      instructions: { type: String, default: "" }
    }
  ],
  visibilityRules: {
    visibleToPatient: { type: Boolean, default: true },
    visibleToDoctor: { type: Boolean, default: true },
    containsInternalNotes: { type: Boolean, default: false }
  },
  searchText: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, { timestamps: true });

medicalRecordVersionSchema.index({ recordId: 1, version: 1 }, { unique: true });
medicalRecordVersionSchema.index({ createdBy: 1 });
medicalRecordVersionSchema.index({ searchText: "text" });

const MedicalRecordVersion = mongoose.model("MedicalRecordVersion", medicalRecordVersionSchema);
export default MedicalRecordVersion;
