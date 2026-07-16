import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse } from "../../utils/apiResponse.js";
import Notification from "./notification.model.js";
import NotificationCounter from "./notification_counter.model.js";
import NotificationPreferences from "./notification_preferences.model.js";
import NotificationOutbox from "./notification_outbox.model.js";
import { decrementUnread } from "./notification_counter.service.js";
import { paginate } from "../../utils/pagination.js";

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

  if (req.query.page !== undefined) {
    const result = await paginate(Notification, req.query, query);
    return successResponse(res, result, "Notifications fetched");
  }

  const data = await Notification.find(query).sort({ sequenceNumber: 1 }).maxTimeMS(5000).lean();
  return successResponse(res, data, "Notifications fetched");
});

// GET /api/v1/notifications/unread
export const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const count = await Notification.countDocuments({
    recipientUserId: userId,
    status: { $nin: ["read", "archived", "expired", "purged"] }
  });
  return successResponse(
    res,
    { unreadCount: count },
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

  const wasDelivered = !["read", "archived", "expired", "purged"].includes(notification.status);
  notification.status = "read";
  notification.readAt = new Date();
  await notification.save();

  const remainingCount = await Notification.countDocuments({
    recipientUserId: userId,
    status: { $nin: ["read", "archived", "expired", "purged"] }
  });
  await NotificationCounter.findOneAndUpdate(
    { userId },
    { unreadCount: remainingCount },
    { upsert: true }
  );

  return successResponse(res, notification, "Notification marked as read");
});

// PATCH /api/v1/notifications/read-all
export const readAll = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { beforeTimestamp } = req.body;

  const before = beforeTimestamp ? new Date(beforeTimestamp) : new Date();

  const toUpdate = await Notification.find({
    recipientUserId: userId,
    status: { $nin: ["read", "archived", "expired", "purged"] },
    createdAt: { $lte: before }
  });

  const count = toUpdate.length;
  if (count > 0) {
    for (const n of toUpdate) {
      n.status = "read";
      n.readAt = new Date();
      await n.save();
    }
    const remainingCount = await Notification.countDocuments({
      recipientUserId: userId,
      status: { $nin: ["read", "archived", "expired", "purged"] }
    });
    await NotificationCounter.findOneAndUpdate(
      { userId },
      { unreadCount: remainingCount },
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

// GET /api/v1/notifications/preferences
export const getPreferences = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  let prefs = await NotificationPreferences.findOne({ userId });
  if (!prefs) {
    prefs = await NotificationPreferences.create({
      userId,
      categories: {
        queue: { in_app: true, push: true },
        session: { in_app: true, push: true },
        doctor: { in_app: true, push: true },
        system: { in_app: true, push: true },
        marketing: { in_app: true, push: true }
      },
      quietHours: { enabled: false },
      emergencyBypass: true
    });
  }
  return successResponse(res, prefs, "Notification preferences fetched");
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