import mongoose from "mongoose";
import NotificationCounter from "./notification_counter.model.js";

export const incrementUnread = async (userId) => {
  console.log(`[COUNTER SERVICE] incrementUnread called for user: ${userId}`);
  const res = await NotificationCounter.findOneAndUpdate(
    { userId },
    { $inc: { unreadCount: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  console.log(`[COUNTER SERVICE] incrementUnread completed. New unreadCount: ${res?.unreadCount}`);
  return res;
};

export const decrementUnread = async (userId) => {
  console.log(`[COUNTER SERVICE] decrementUnread called for user: ${userId}`);
  const res = await NotificationCounter.findOneAndUpdate(
    { userId },
    { $inc: { unreadCount: -1 } },
    { upsert: true, returnDocument: "after" }
  );
  console.log(`[COUNTER SERVICE] decrementUnread completed. New unreadCount: ${res?.unreadCount}`);
  return res;
};

export const applyQueueReplaceRules = async (notification) => {
  console.log(`[COUNTER SERVICE] applyQueueReplaceRules triggered for notification ${notification._id}, recipient: ${notification.recipientUserId}`);
  try {
    const NotificationModel = mongoose.model("Notification");
    const prevActive = await NotificationModel.find({
      recipientUserId: notification.recipientUserId,
      category: "queue",
      _id: { $ne: notification._id },
      status: { $in: ["delivered", "read"] }
    });
    console.log(`[COUNTER SERVICE] Found ${prevActive.length} active queue notifications to archive`);

    let decrements = 0;
    for (const p of prevActive) {
      const wasDelivered = p.status === "delivered";
      console.log(`[COUNTER SERVICE] Archiving notification ${p._id}, wasDelivered: ${wasDelivered}`);
      if (p.status === "delivered") {
        p.status = "read";
        p.readAt = new Date();
      }
      p.status = "archived";
      p.archivedAt = new Date();
      await p.save();
      if (wasDelivered) {
        decrements++;
      }
    }
    if (decrements > 0) {
      console.log(`[COUNTER SERVICE] Decrementing unreadCount by ${decrements} for user ${notification.recipientUserId}`);
      const res = await NotificationCounter.findOneAndUpdate(
        { userId: notification.recipientUserId },
        { $inc: { unreadCount: -decrements } },
        { upsert: true, returnDocument: "after" }
      );
      console.log(`[COUNTER SERVICE] Decrement completed. New unreadCount: ${res?.unreadCount}`);
    }
  } catch (err) {
    console.error("Error in applyQueueReplaceRules:", err);
    throw err;
  }
};
