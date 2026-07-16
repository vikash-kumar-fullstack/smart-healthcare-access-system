import mongoose from "mongoose";

const reminderQueueSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AppointmentBooking",
    required: true
  },
  sendAt: {
    type: Date,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ["24h", "1h", "30m", "10m"],
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "sent", "failed", "dlq"],
    default: "pending",
    index: true
  },
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  channels: {
    type: [String],
    enum: ["in-app", "email", "sms", "whatsapp"],
    default: ["in-app"]
  },
  error: {
    type: String,
    default: null
  }
}, { timestamps: true });

const ReminderQueue = mongoose.model("ReminderQueue", reminderQueueSchema);
export default ReminderQueue;
