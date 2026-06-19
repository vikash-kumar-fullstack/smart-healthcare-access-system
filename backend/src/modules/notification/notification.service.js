import NotificationOutbox from "./notification_outbox.model.js";
import Notification from "./notification.model.js";
import NotificationPreferences from "./notification_preferences.model.js";
import NotificationCounter from "./notification_counter.model.js";
import { decrementUnread } from "./notification_counter.service.js";

// Helper to resolve type/category/eventType from legacy parameters
export const createNotification = async (recipientUserId, title, body, type = "update", options = {}) => {
  const dbSession = options.session || null;

  let mappedType = "informational";
  let category = "system";
  let eventType = options.eventType || "generic_notification";

  if (type === "booking") {
    mappedType = "transactional";
    category = "queue";
    eventType = options.eventType || "booking_confirmed";
  } else if (type === "alert") {
    mappedType = "operational";
    category = "queue";
    eventType = options.eventType || "queue_alert";
  } else if (type === "update") {
    mappedType = "operational";
    category = "queue";
    eventType = options.eventType || "queue_update";
  }

  if (options.category) category = options.category;
  if (options.type) mappedType = options.type;

  const aggregateType = options.aggregateType || "User";
  const aggregateId = options.aggregateId || recipientUserId;
  const eventKey = `${aggregateType}_${aggregateId}_${eventType}_${recipientUserId}`;

  const metadata = options.metadata || {};
  const channels = options.channels || ["in_app", "push"];
  const dedupeKey = options.dedupeKey || null;

  // Snapshot user preferences
  let prefs = await NotificationPreferences.findOne({ userId: recipientUserId }).session(dbSession);
  if (!prefs) {
    prefs = {
      categories: {
        queue: { in_app: true, push: true },
        session: { in_app: true, push: true },
        doctor: { in_app: true, push: true },
        system: { in_app: true, push: true },
        marketing: { in_app: true, push: true }
      },
      quietHours: { enabled: false },
      emergencyBypass: true
    };
  }

  const categorySettings = prefs.categories[category] || { in_app: true, push: true };
  const snapshotChannels = Object.keys(categorySettings).filter(k => categorySettings[k]);

  const preferencesSnapshot = {
    category,
    channels: snapshotChannels,
    quietHours: prefs.quietHours,
    emergencyBypass: prefs.emergencyBypass
  };

  // ── Deduplication check at outbox insertion time (Lock 6 & Correction) ──
  if (dedupeKey) {
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    // 1. Check if there is an existing pending/processing outbox with same dedupeKey within 30s
    const existingOutbox = await NotificationOutbox.findOne({
      "payload.dedupeKey": dedupeKey,
      createdAt: { $gte: thirtySecondsAgo }
    }).session(dbSession);

    if (existingOutbox) {
      console.log(`Deduplication: returning existing outbox document for dedupeKey ${dedupeKey}`);
      return existingOutbox;
    }

    // 2. Check if a notification has already been created/delivered with same dedupeKey within 30s
    const existingNotification = await Notification.findOne({
      dedupeKey,
      createdAt: { $gte: thirtySecondsAgo }
    }).session(dbSession);

    if (existingNotification) {
      console.log(`Deduplication: notification already exists for dedupeKey ${dedupeKey}, returning pre-processed outbox`);
      const outboxObj = {
        eventKey: `${eventKey}_dup_${Date.now()}`,
        eventType,
        aggregateType,
        aggregateId,
        payload: {
          recipientUserId,
          type: mappedType,
          category,
          title,
          body,
          metadata,
          channels,
          dedupeKey,
          preferencesSnapshot
        },
        status: "processed",
        processedAt: new Date()
      };
      const opts = dbSession ? { session: dbSession } : {};
      const result = await NotificationOutbox.create([outboxObj], opts);
      return result[0];
    }
  }

  const outboxObj = {
    eventKey,
    eventType,
    aggregateType,
    aggregateId,
    payload: {
      recipientUserId,
      type: mappedType,
      category,
      title,
      body,
      metadata,
      channels,
      dedupeKey,
      preferencesSnapshot
    },
    status: "pending"
  };

  try {
    const opts = dbSession ? { session: dbSession } : {};
    const result = await NotificationOutbox.create([outboxObj], opts);
    return result[0];
  } catch (err) {
    if (err.code === 11000) {
      console.log(`Duplicate eventKey ignored for outbox idempotency: ${eventKey}`);
      return null;
    }
    throw err;
  }
};

export const getNotifications = async (recipientUserId) => {
  return await Notification.find({ recipientUserId })
    .sort({ sequenceNumber: 1 });
};

export const markAsRead = async (id, recipientUserId) => {
  const notification = await Notification.findOne({ _id: id, recipientUserId });
  if (!notification) {
    const err = new Error("Notification not found");
    err.status = 404;
    throw err;
  }

  const wasDelivered = notification.status === "delivered";
  notification.status = "read";
  notification.readAt = new Date();
  await notification.save();

  if (wasDelivered) {
    await decrementUnread(recipientUserId);
  }

  return notification;
};
