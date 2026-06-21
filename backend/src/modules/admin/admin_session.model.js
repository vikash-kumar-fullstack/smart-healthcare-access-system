import mongoose from "mongoose";

const adminSessionSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  adminSessionId: {
    type: String,
    required: true,
    unique: true
  },
  issuedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  lastActivity: {
    type: Date,
    default: Date.now,
    required: true
  }
}, { timestamps: true });

const AdminSession = mongoose.model("AdminSession", adminSessionSchema);
export default AdminSession;
