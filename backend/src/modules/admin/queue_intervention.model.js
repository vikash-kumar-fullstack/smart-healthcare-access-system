import mongoose from "mongoose";

const queueInterventionSchema = new mongoose.Schema({
  queueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "QueueSession",
    required: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ["force_close", "force_reopen", "emergency_pause", "reassign_patient"],
    required: true
  }
}, { timestamps: true });

const QueueIntervention = mongoose.model("QueueIntervention", queueInterventionSchema);
export default QueueIntervention;
