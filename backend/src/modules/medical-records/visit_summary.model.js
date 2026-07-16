import mongoose from "mongoose";

const visitSummarySchema = new mongoose.Schema({
  visitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Visit",
    required: true,
    unique: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  clinicalNoteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ClinicalNote",
    required: true
  },
  prescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Prescription",
    required: true
  },
  labOrderIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "LabOrder"
  }],
  followUpId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FollowUp",
    default: null
  },
  pdfUrl: {
    type: String,
    default: null
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const VisitSummary = mongoose.models.VisitSummary || mongoose.model("VisitSummary", visitSummarySchema);
export default VisitSummary;
