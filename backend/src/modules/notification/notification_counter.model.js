import mongoose from "mongoose";

const notificationCounterSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  unreadCount: {
    type: Number,
    default: 0,
    min: 0
  }
}, { timestamps: true });

const NotificationCounter = mongoose.model("NotificationCounter", notificationCounterSchema);
export default NotificationCounter;
