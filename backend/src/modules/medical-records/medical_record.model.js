import mongoose from "mongoose";

const medicalRecordSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  visitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Visit",
    default: null
  },
  doctorSnapshot: {
    name: { type: String, required: true },
    specialization: { type: String, required: true },
    hospitalName: { type: String, required: true }
  },
  latestVersion: {
    type: Number,
    default: 1
  },
  activeVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MedicalRecordVersion",
    required: true
  },
  status: {
    type: String,
    enum: ["active", "locked", "archived", "deleted"],
    default: "active"
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

medicalRecordSchema.index({ patientId: 1, createdAt: -1 });
medicalRecordSchema.index({ visitId: 1 });

const MedicalRecord = mongoose.model("MedicalRecord", medicalRecordSchema);
export default MedicalRecord;
