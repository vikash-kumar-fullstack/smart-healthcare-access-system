import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema({
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
  clinicalNoteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ClinicalNote",
    required: true
  },
  medicines: [
    {
      genericName: { type: String, required: true },
      brandName: { type: String },
      route: {
        type: String,
        enum: ["Oral", "Intravenous", "Intramuscular", "Topical", "Inhalation"],
        default: "Oral"
      },
      form: {
        type: String,
        enum: ["tablet", "capsule", "injection", "syrup", "drops", "ointment"],
        default: "tablet"
      },
      dosage: { type: String, required: true },
      frequency: { type: String, required: true },
      duration: { type: String, required: true },
      foodTiming: {
        type: String,
        enum: ["before_food", "after_food", "with_food", "sos"],
        default: "after_food"
      },
      quantity: { type: Number, required: true },
      instructions: { type: String, default: "" },
      refills: { type: Number, default: 0 }
    }
  ],
  status: {
    type: String,
    enum: ["DRAFT", "SIGNED"],
    default: "DRAFT"
  },
  digitalSignature: {
    type: String,
    default: null
  },
  version: {
    type: Number,
    default: 1
  },
  parentPrescriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Prescription",
    default: null
  },
  signatureHash: {
    type: String,
    default: null
  },
  signedAt: {
    type: Date,
    default: null
  },
  signedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  }
}, { timestamps: true });

const Prescription = mongoose.models.Prescription || mongoose.model("Prescription", prescriptionSchema);
export default Prescription;
