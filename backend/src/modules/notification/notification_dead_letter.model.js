import mongoose from "mongoose";

const notificationDeadLetterSchema = new mongoose.Schema({
  outboxId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "NotificationOutbox"
  },
  payload: {
    type: Object,
    required: true
  },
  error: {
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    required: true
  }
}, { timestamps: true });

const NotificationDeadLetter = mongoose.model("NotificationDeadLetter", notificationDeadLetterSchema);
export default NotificationDeadLetter;
