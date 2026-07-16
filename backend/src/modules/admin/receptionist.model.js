import mongoose from "mongoose";

const receptionistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true
  },
  employeeId: {
    type: String,
    required: true,
    unique: true
  },
  shift: {
    type: String,
    enum: ["Morning", "Evening", "Night", "General", "Weekend"],
    default: "General"
  },
  status: {
    type: String,
    enum: ["active", "inactive", "archived"],
    default: "active"
  },
  permissions: {
    type: [String],
    default: ["checkin", "walkin", "transfers"]
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Receptionist = mongoose.models.Receptionist || mongoose.model("Receptionist", receptionistSchema);

export default Receptionist;
