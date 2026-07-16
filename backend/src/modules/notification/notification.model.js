import mongoose from "mongoose";

const validTransitions = {
  created: ["queued", "read"],
  queued: ["processing", "delivered", "failed", "expired", "purged", "read"],
  processing: ["delivered", "failed", "expired", "purged", "read"],
  delivered: ["read", "archived", "expired", "purged"],
  read: ["archived", "purged"],
  archived: ["purged"],
  failed: ["queued", "processing", "purged", "read"],
  expired: ["purged"],
  purged: []
};

const notificationSchema = new mongoose.Schema({
  recipientUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  sequenceNumber: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ["transactional", "operational", "informational", "marketing"],
    default: "informational"
  },
  category: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  metadata: {
    route: String,
    entityId: String
  },
  channels: [{
    type: String,
    enum: ["in_app", "push"]
  }],
  status: {
    type: String,
    enum: ["created", "queued", "processing", "delivered", "read", "failed", "expired", "archived", "purged"],
    default: "created"
  },
  dedupeKey: {
    type: String
  },
  payloadVersion: {
    type: Number,
    default: 1
  },
  deliveredChannels: [{
    type: String
  }],
  clickedAt: Date,
  readAt: Date,
  expiresAt: Date,
  archivedAt: Date,
  purgedAt: Date,
  ackDeadlineAt: Date
}, { timestamps: true });

notificationSchema.index({ recipientUserId: 1, archivedAt: 1, createdAt: -1 });
notificationSchema.index({ recipientUserId: 1, sequenceNumber: 1 }, { unique: true });
notificationSchema.index({ dedupeKey: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ recipientUserId: 1, createdAt: 1 });
notificationSchema.index({ status: 1 });

notificationSchema.pre("save", async function () {
  if (this.isModified("status")) {
    const oldStatus = this.isNew ? null : (this._originalStatus || this.get("status", null, { getters: false }));
    const newStatus = this.status;

    if (!this.isNew && oldStatus && oldStatus !== newStatus) {
      const allowed = validTransitions[oldStatus] || [];
      if (!allowed.includes(newStatus)) {
        throw new Error(`Invalid notification status transition from ${oldStatus} to ${newStatus}`);
      }
    }
  }
});

notificationSchema.post("init", function (doc) {
  doc._originalStatus = doc.status;
});

notificationSchema.post("save", function (doc) {
  doc._originalStatus = doc.status;
});

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;