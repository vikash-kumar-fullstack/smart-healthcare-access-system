import mongoose from "mongoose";

const medicalAttachmentSchema = new mongoose.Schema({
  recordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MedicalRecord",
    default: null
  },
  version: {
    type: Number,
    default: 1
  },
  clinicalNoteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ClinicalNote",
    default: null
  },
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Prescription",
    default: null
  },
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Report",
    default: null
  },
  storageKey: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  attachmentType: {
    type: String,
    enum: ["image", "pdf", "lab_report", "prescription", "scan", "clinical_note"],
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  deletedAt: {
    type: Date,
    default: null
  },
  purgedAt: {
    type: Date,
    default: null
  },
  retentionUntil: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const MedicalAttachment = mongoose.model("MedicalAttachment", medicalAttachmentSchema);
export default MedicalAttachment;
