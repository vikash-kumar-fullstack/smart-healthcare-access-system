import mongoose from "mongoose";

const adminAuditSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  action: {
    type: String,
    required: true
  },
  targetType: {
    type: String,
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  before: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  after: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  reason: {
    type: String,
    default: ""
  },
  requestId: {
    type: String,
    default: ""
  }
}, { timestamps: true });

adminAuditSchema.index({ adminId: 1, createdAt: -1 });

const AdminAudit = mongoose.model("AdminAudit", adminAuditSchema);
export default AdminAudit;
