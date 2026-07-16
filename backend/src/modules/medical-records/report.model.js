import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  visitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Visit",
    required: true,
    index: true
  },
  labOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LabOrder",
    default: null
  },
  fileUrl: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ["discharge_summary", "lab_report", "medical_certificate", "scan"],
    required: true
  },
  status: {
    type: String,
    enum: ["active", "archived"],
    default: "active"
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  version: {
    type: Number,
    default: 1
  }
}, { timestamps: true });

const Report = mongoose.models.Report || mongoose.model("Report", reportSchema);
export default Report;
