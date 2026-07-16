import mongoose from "mongoose";

const followUpSchema = new mongoose.Schema({
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
  nextVisit: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  department: {
    type: String,
    default: "General Medicine"
  },
  expectedDuration: {
    type: Number, // in minutes
    default: 15
  },
  assignedDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "low"
  },
  status: {
    type: String,
    enum: ["scheduled", "completed", "cancelled"],
    default: "scheduled"
  },
  statusHistory: [
    {
      status: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      operatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
    }
  ]
}, { timestamps: true });

const FollowUp = mongoose.models.FollowUp || mongoose.model("FollowUp", followUpSchema);
export default FollowUp;
