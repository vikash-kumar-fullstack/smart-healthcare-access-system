import mongoose from "mongoose";

const adminActionSchema = new mongoose.Schema({
  actionId: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId(),
    required: true
  },
  correlationId: {
    type: String,
    required: true
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  command: {
    type: String,
    required: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  commandKey: {
    type: String,
    unique: true,
    sparse: true
  },
  responseBody: {
    type: mongoose.Schema.Types.Mixed
  },
  executedAt: {
    type: Date,
    default: Date.now,
    required: true
  }
}, { timestamps: true });

adminActionSchema.index({ correlationId: 1 });
adminActionSchema.index({ adminId: 1, createdAt: -1 });

const AdminAction = mongoose.model("AdminAction", adminActionSchema);
export default AdminAction;
