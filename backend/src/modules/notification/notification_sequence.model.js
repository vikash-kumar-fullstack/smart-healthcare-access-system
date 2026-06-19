import mongoose from "mongoose";

const notificationSequenceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  current: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model("NotificationSequence", notificationSequenceSchema);
