import mongoose from "mongoose";

const clinicalNoteSchema = new mongoose.Schema({
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
  visitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Visit",
    required: true,
    index: true
  },
  chiefComplaint: {
    type: String,
    required: true
  },
  presentIllness: {
    type: String,
    default: ""
  },
  pastHistory: {
    type: String,
    default: ""
  },
  familyHistory: {
    type: String,
    default: ""
  },
  examination: {
    type: String,
    default: ""
  },
  diagnosis: {
    type: String,
    required: true
  },
  clinicalNotes: {
    type: String,
    default: ""
  },
  advice: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    enum: ["DRAFT", "SIGNED"],
    default: "DRAFT"
  }
}, { timestamps: true });

const ClinicalNote = mongoose.models.ClinicalNote || mongoose.model("ClinicalNote", clinicalNoteSchema);
export default ClinicalNote;
