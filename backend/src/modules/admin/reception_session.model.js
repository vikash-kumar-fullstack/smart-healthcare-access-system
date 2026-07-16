import mongoose from "mongoose";

const receptionSessionSchema = new mongoose.Schema({
  receptionistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Receptionist",
    required: true
  },
  loginTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  logoutTime: {
    type: Date,
    default: null
  },
  counterNumber: {
    type: String,
    default: "Counter 2"
  },
  ipAddress: {
    type: String,
    default: "127.0.0.1"
  },
  deviceInfo: {
    type: String,
    default: "Web Browser Client"
  },
  status: {
    type: String,
    enum: ["active", "ended"],
    default: "active"
  }
}, { timestamps: true });

const ReceptionSession = mongoose.models.ReceptionSession || mongoose.model("ReceptionSession", receptionSessionSchema);

export default ReceptionSession;
