import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  actorRole: {
    type: String,
    default: "guest"
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    default: null
  },
  action: {
    type: String,
    required: true
  },
  resourceType: {
    type: String,
    required: true
  },
  resourceId: {
    type: String,
    default: null
  },
  requestMethod: {
    type: String,
    default: ""
  },
  requestPath: {
    type: String,
    default: ""
  },
  ipAddress: {
    type: String,
    default: ""
  },
  userAgent: {
    type: String,
    default: ""
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  success: {
    type: Boolean,
    default: true
  },
  failureReason: {
    type: String,
    default: null
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  actorRoleSnapshot: {
    type: String,
    default: ""
  },
  permissionSnapshot: {
    type: [String],
    default: []
  }
}, { timestamps: false });

// Middleware to prevent modification or deletion (immutability check)
auditLogSchema.pre("save", function (next) {
  if (!this.isNew) {
    if (typeof next === "function") return next(new Error("Audit logs are read-only and immutable."));
    throw new Error("Audit logs are read-only and immutable.");
  }
  if (typeof next === "function") next();
});

auditLogSchema.pre("updateOne", function (next) {
  if (typeof next === "function") return next(new Error("Audit logs are read-only and immutable."));
  throw new Error("Audit logs are read-only and immutable.");
});

auditLogSchema.pre("replaceOne", function (next) {
  if (typeof next === "function") return next(new Error("Audit logs are read-only and immutable."));
  throw new Error("Audit logs are read-only and immutable.");
});

auditLogSchema.pre("deleteOne", function (next) {
  if (typeof next === "function") return next(new Error("Audit logs are read-only and immutable."));
  throw new Error("Audit logs are read-only and immutable.");
});

auditLogSchema.pre("remove", function (next) {
  if (typeof next === "function") return next(new Error("Audit logs are read-only and immutable."));
  throw new Error("Audit logs are read-only and immutable.");
});

const AuditLog = mongoose.models.EnterpriseAuditLog || mongoose.model("EnterpriseAuditLog", auditLogSchema);
export default AuditLog;
