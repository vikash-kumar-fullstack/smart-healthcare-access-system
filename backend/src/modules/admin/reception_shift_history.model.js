import mongoose from "mongoose";

const receptionShiftHistorySchema = new mongoose.Schema({
  receptionistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Receptionist",
    required: true
  },
  previousShift: {
    type: String,
    enum: ["Morning", "Evening", "Night", "General", "Weekend", null],
    default: null
  },
  newShift: {
    type: String,
    enum: ["Morning", "Evening", "Night", "General", "Weekend"],
    required: true
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const ReceptionShiftHistory = mongoose.models.ReceptionShiftHistory || mongoose.model("ReceptionShiftHistory", receptionShiftHistorySchema);

export default ReceptionShiftHistory;
