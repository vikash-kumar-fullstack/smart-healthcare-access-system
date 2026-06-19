import mongoose from "mongoose";

const notificationOutboxSchema = new mongoose.Schema({
  eventKey: {
    type: String,
    required: true,
    unique: true
  },
  eventType: {
    type: String,
    required: true
  },
  aggregateType: {
    type: String,
    required: true
  },
  aggregateId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  payload: {
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    type: {
      type: String,
      enum: ["transactional", "operational", "informational", "marketing"],
      required: true
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
      entityId: String,
      doctorId: String,
      queueId: String
    },
    channels: [{
      type: String,
      enum: ["in_app", "push"]
    }],
    dedupeKey: String,
    preferencesSnapshot: {
      category: String,
      channels: [String],
      quietHours: {
        enabled: Boolean,
        start: String,
        end: String,
        timezone: String
      },
      emergencyBypass: Boolean
    }
  },
  status: {
    type: String,
    enum: ["pending", "processing", "processed", "failed"],
    default: "pending"
  },
  processingBy: {
    type: String
  },
  lockedAt: {
    type: Date
  },
  attempts: {
    type: Number,
    default: 0
  },
  nextRetryAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  }
}, { timestamps: true });

notificationOutboxSchema.index({ status: 1, nextRetryAt: 1 });

const NotificationOutbox = mongoose.model("NotificationOutbox", notificationOutboxSchema);
export default NotificationOutbox;
