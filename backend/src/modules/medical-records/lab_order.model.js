import mongoose from "mongoose";

const labOrderSchema = new mongoose.Schema({
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
  tests: [{
    type: String,
    required: true
  }],
  priority: {
    type: String,
    enum: ["routine", "urgent", "stat"],
    default: "routine"
  },
  instructions: {
    type: String,
    default: ""
  },
  sampleType: {
    type: String,
    enum: ["blood", "urine", "stool", "other"],
    default: "blood"
  },
  status: {
    type: String,
    enum: ["ORDERED", "SAMPLE_COLLECTED", "PROCESSING", "COMPLETED", "CANCELLED"],
    default: "ORDERED"
  },
  notes: {
    type: String,
    default: ""
  }
}, { timestamps: true });

const LabOrder = mongoose.models.LabOrder || mongoose.model("LabOrder", labOrderSchema);
export default LabOrder;
