import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import Notification from "../src/modules/notification/notification.model.js";
import NotificationOutbox from "../src/modules/notification/notification_outbox.model.js";
import NotificationCounter from "../src/modules/notification/notification_counter.model.js";
import User from "../src/modules/auth/auth.model.js";

async function audit() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  const users = await User.find({ email: /patient\.browser/ });
  console.log(`Found ${users.length} patient.browser user(s):`);

  for (const u of users) {
    console.log(`\nUser: ${u._id} | ${u.email} | ${u.name}`);
    const notifs = await Notification.find({ recipientUserId: u._id });
    console.log(`Total notifications in Notification collection: ${notifs.length}`);
    for (const n of notifs) {
      console.log(`  - [${n.status}] ID: ${n._id} | Seq: ${n.sequenceNumber} | Title: "${n.title}" | ReadAt: ${n.readAt} | CreatedAt: ${n.createdAt}`);
    }

    const unreadCount = await Notification.countDocuments({
      recipientUserId: u._id,
      status: { $nin: ["read", "archived", "expired", "purged"] }
    });
    console.log(`Calculated unreadCount (via countDocuments): ${unreadCount}`);

    const counter = await NotificationCounter.findOne({ userId: u._id });
    console.log(`NotificationCounter document unreadCount: ${counter ? counter.unreadCount : "NONE"}`);

    const outboxItems = await NotificationOutbox.find({ "payload.recipientUserId": u._id });
    console.log(`Outbox items: ${outboxItems.length}`);
    for (const o of outboxItems) {
      console.log(`  - Outbox ID: ${o._id} | Status: ${o.status} | Title: "${o.payload?.title}" | CreatedAt: ${o.createdAt}`);
    }
  }

  await mongoose.disconnect();
}

audit().catch(console.error);
