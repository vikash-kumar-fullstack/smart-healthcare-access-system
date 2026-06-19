import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse } from "../../utils/apiResponse.js";
import Notification from "./notification.model.js";
import NotificationCounter from "./notification_counter.model.js";
import NotificationPreferences from "./notification_preferences.model.js";
import NotificationOutbox from "./notification_outbox.model.js";
import { decrementUnread } from "./notification_counter.service.js";

// GET /api/v1/notifications?view=unread|archived|today|earlier
export const getAll = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { view } = req.query;

  let query = { recipientUserId: userId, status: { $ne: "expired" } };

  if (view === "unread") {
    query.status = "delivered";
    query.archivedAt = { $exists: false };
  } else if (view === "archived") {
    query.archivedAt = { $exists: true };
  } else if (view === "all") {
    // Return all notifications including archived ones
  } else if (view === "today") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    query.createdAt = { $gte: todayStart };
    query.archivedAt = { $exists: false };
  } else if (view === "earlier") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    query.createdAt = { $lt: todayStart };
    query.archivedAt = { $exists: false };
  } else {
    // Default: not archived
    query.archivedAt = { $exists: false };
  }

  const data = await Notification.find(query).sort({ sequenceNumber: 1 });
  return successResponse(res, data, "Notifications fetched");
});

// GET /api/v1/notifications/unread
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const counter = await NotificationCounter.findOne({ userId });
  return successResponse(
    res,
    { unreadCount: counter ? counter.unreadCount : 0 },
    "Unread count fetched"
  );
});

// PATCH /api/v1/notifications/:id/read
export const read = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const notification = await Notification.findOne({ _id: id, recipientUserId: userId });
  if (!notification) {
    throw Object.assign(new Error("Notification not found"), { status: 404 });
  }

  const wasDelivered = notification.status === "delivered";
  notification.status = "read";
  notification.readAt = new Date();
  await notification.save();

  if (wasDelivered) {
    await decrementUnread(userId);
  }

  return successResponse(res, notification, "Notification marked as read");
});

// PATCH /api/v1/notifications/read-all
export const readAll = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { beforeTimestamp } = req.body;

  const before = beforeTimestamp ? new Date(beforeTimestamp) : new Date();

  const toUpdate = await Notification.find({
    recipientUserId: userId,
    status: "delivered",
    createdAt: { $lte: before }
  });

  const count = toUpdate.length;
  if (count > 0) {
    for (const n of toUpdate) {
      n.status = "read";
      n.readAt = new Date();
      await n.save();
    }
    await NotificationCounter.findOneAndUpdate(
      { userId },
      { $inc: { unreadCount: -count } },
      { upsert: true }
    );
  }

  return successResponse(res, { count }, `Marked ${count} notifications as read`);
});

// PATCH /api/v1/notifications/:id/archive
export const archive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  const notification = await Notification.findOne({ _id: id, recipientUserId: userId });
  if (!notification) {
    throw Object.assign(new Error("Notification not found"), { status: 404 });
  }

  const wasDelivered = notification.status === "delivered";
  notification.status = "archived";
  notification.archivedAt = new Date();
  await notification.save();

  if (wasDelivered) {
    await decrementUnread(userId);
  }

  return successResponse(res, notification, "Notification archived");
});

// GET /api/v1/notifications/sync?afterSequence=123
export const syncNotifications = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const afterSequence = parseInt(req.query.afterSequence || "0", 10);

  const data = await Notification.find({
    recipientUserId: userId,
    sequenceNumber: { $gt: afterSequence },
    status: { $ne: "expired" }
  }).sort({ sequenceNumber: 1 });

  return successResponse(res, data, "Notifications synced successfully");
});

// PATCH /api/v1/notifications/preferences
export const updatePreferences = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { categories, quietHours, emergencyBypass } = req.body;

  const update = {};
  if (categories) update.categories = categories;
  if (quietHours) update.quietHours = quietHours;
  if (emergencyBypass !== undefined) update.emergencyBypass = emergencyBypass;

  const prefs = await NotificationPreferences.findOneAndUpdate(
    { userId },
    { $set: update },
    { upsert: true, returnDocument: "after" }
  );

  return successResponse(res, prefs, "Notification preferences updated");
});

// POST /api/v1/admin/notifications/retry
export const adminRetry = asyncHandler(async (req, res) => {
  const { outboxId } = req.body;
  const query = { status: "failed" };
  if (outboxId) query._id = outboxId;

  const result = await NotificationOutbox.updateMany(
    query,
    { $set: { status: "pending", nextRetryAt: new Date(), attempts: 0 } }
  );

  return successResponse(res, { modifiedCount: result.modifiedCount }, "Retry enqueued for failed notifications");
});