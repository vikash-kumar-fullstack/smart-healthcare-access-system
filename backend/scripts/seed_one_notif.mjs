import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import Notification from "../src/modules/notification/notification.model.js";
import NotificationSequence from "../src/modules/notification/notification_sequence.model.js";
import User from "../src/modules/auth/auth.model.js";

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: "patient.browser@health.local" });
  if (!user) throw new Error("User not found");

  // Mark all previous notifications as read
  await Notification.updateMany({ recipientUserId: user._id }, { $set: { status: "read", readAt: new Date() } });

  // Create 1 fresh unread notification
  const seq = await NotificationSequence.findOneAndUpdate(
    { userId: user._id },
    { $inc: { current: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  await Notification.create({
    recipientUserId: user._id,
    sequenceNumber: seq.current,
    type: "operational",
    category: "queue",
    title: "Clinic Door Access Code",
    body: "Your entry pass for tomorrow morning has been activated.",
    channels: ["in_app"],
    status: "delivered",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });

  const count = await Notification.countDocuments({
    recipientUserId: user._id,
    status: { $nin: ["read", "archived", "expired", "purged"] }
  });
  console.log("Sarah Jenkins unread count is now:", count);

  await mongoose.disconnect();
}

seed().catch(console.error);
