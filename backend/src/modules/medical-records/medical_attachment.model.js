import mongoose from "mongoose";

const medicalAttachmentSchema = new mongoose.Schema({
  recordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MedicalRecord",
    required: true
  },
  version: {
    type: Number,
    required: true
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
    enum: ["image", "pdf", "lab_report", "prescription"],
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
  }
}, { timestamps: true });

medicalAttachmentSchema.index({ recordId: 1, version: 1, storageKey: 1 }, { unique: true });

const MedicalAttachment = mongoose.model("MedicalAttachment", medicalAttachmentSchema);
export default MedicalAttachment;
