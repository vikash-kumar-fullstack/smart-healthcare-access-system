import NotificationOutbox from "./notification_outbox.model.js";
import Notification from "./notification.model.js";
import NotificationPreferences from "./notification_preferences.model.js";
import NotificationCounter from "./notification_counter.model.js";
import NotificationDeadLetter from "./notification_dead_letter.model.js";
import NotificationSequence from "./notification_sequence.model.js";
import { getDriver } from "./notification_channel.js";
import { incrementUnread, decrementUnread, applyQueueReplaceRules } from "./notification_counter.service.js";
import { incrementSystemMetric } from "../doctor/system_monitoring.model.js";

const WORKER_ID = `worker_${Math.random().toString(36).substring(2, 11)}`;

let isDispatcherRunning = false;
let isRetryWorkerRunning = false;
let isCleanupWorkerRunning = false;

export const calculateExpiry = (category) => {
  const now = new Date();
  const ttls = {
    queue: 7 * 24 * 60 * 60 * 1000,
    session: 30 * 24 * 60 * 60 * 1000,
    system: 90 * 24 * 60 * 60 * 1000,
    marketing: 30 * 24 * 60 * 60 * 1000
  };
  const delay = ttls[category] || 30 * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + delay);
};

// ─── Worker Claim & Dispatcher (Lock I, Lock A, Lock B, Lock K, Lock C) ────────
export const notificationDispatcher = async () => {
  if (isDispatcherRunning) return;
  isDispatcherRunning = true;
  try {
    // 1. Recover stuck workers (Lock I)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await NotificationOutbox.updateMany(
      { status: "processing", lockedAt: { $lt: fiveMinutesAgo } },
      { $set: { status: "pending", processingBy: null, lockedAt: null } }
    );

    // 2. Fetch and claim pending outbox items atomically
    const pending = await NotificationOutbox.find({
      status: "pending",
      nextRetryAt: { $lte: new Date() }
    }).sort({ createdAt: 1 });

    for (const item of pending) {
      const outbox = await NotificationOutbox.findOneAndUpdate(
        { _id: item._id, status: "pending" },
        { status: "processing", processingBy: WORKER_ID, lockedAt: new Date() },
        { returnDocument: "after" }
      );

      if (!outbox) continue; // Claimed by another worker

      await processOutboxItem(outbox);
    }
  } catch (err) {
    console.error("Error in notification dispatcher worker:", err);
  } finally {
    isDispatcherRunning = false;
  }
};

const processOutboxItem = async (outbox) => {
  let notification = null;
  try {
    const { recipientUserId, title, body, metadata, dedupeKey, category, type } = outbox.payload;


    // ── 2. Read preferences with snapshot fallback (Lock B / Lock K) ──
    let categories;
    let quietHours;
    let emergencyBypass;

    if (outbox.payload.preferencesSnapshot && outbox.payload.preferencesSnapshot.category) {
      const snap = outbox.payload.preferencesSnapshot;
      categories = {
        [category]: {
          in_app: snap.channels?.includes("in_app"),
          push: snap.channels?.includes("push")
        }
      };
      quietHours = snap.quietHours;
      emergencyBypass = snap.emergencyBypass;
    } else {
      let prefs = await NotificationPreferences.findOne({ userId: recipientUserId });
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
      categories = prefs.categories;
      quietHours = prefs.quietHours;
      emergencyBypass = prefs.emergencyBypass;
    }

    // Determine targeted channels
    const categorySettings = categories[category] || { in_app: true, push: true };
    const channels = outbox.payload.channels.filter(ch => categorySettings[ch] === true);

    if (channels.length === 0) {
      outbox.status = "processed";
      outbox.processedAt = new Date();
      await outbox.save();
      return;
    }

    // ── 3. Quiet hours validation (Lock 4 / Lock 5) ──
    let inQuietHours = false;
    if (quietHours?.enabled) {
      const now = new Date();
      const timeZone = quietHours.timezone || "Asia/Kolkata";
      const timeStr = now.toLocaleTimeString("en-US", { hour12: false, timeZone });
      const [nowH, nowM] = timeStr.split(":").map(Number);
      const nowVal = nowH * 60 + nowM;

      const [startH, startM] = quietHours.start.split(":").map(Number);
      const [endH, endM] = quietHours.end.split(":").map(Number);
      const startVal = startH * 60 + startM;
      const endVal = endH * 60 + endM;

      if (startVal < endVal) {
        inQuietHours = nowVal >= startVal && nowVal <= endVal;
      } else {
        inQuietHours = nowVal >= startVal || nowVal <= endVal;
      }
    }

    // Bypass quiet hours if transactional or emergencyBypass is true
    if (inQuietHours && type !== "transactional" && !emergencyBypass) {
      // Release processing lock and postpone to 1 minute after quiet hours end
      const now = new Date();
      const [endH, endM] = quietHours.end.split(":").map(Number);
      let target = new Date(now);
      target.setHours(endH, endM + 1, 0, 0);
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }
      outbox.nextRetryAt = target;
      outbox.status = "pending";
      outbox.processingBy = undefined;
      outbox.lockedAt = undefined;
      await outbox.save();
      return;
    }

    // ── 4. Order sequencing calculation (Lock C & sequenceNumber Allocation Correction) ──
    const seqDoc = await NotificationSequence.findOneAndUpdate(
      { userId: recipientUserId },
      { $inc: { current: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    const nextSequence = seqDoc.current;

    // Create Notification and trigger state transitions (Lock M)
    notification = await Notification.create({
      recipientUserId,
      sequenceNumber: nextSequence,
      type,
      category,
      title,
      body,
      metadata,
      channels,
      status: "created",
      dedupeKey,
      expiresAt: calculateExpiry(category)
    });

    notification.status = "queued";
    await notification.save();

    // ── 5. Run channels & dispatchers ──
    const deliveredChannels = [];
    let overallStatus = "processing"; // Default for in-app / WebSocket, waiting for client delivery ACK
    let dispatchError = null;

    for (const channel of channels) {
      const res = await getDriver(channel).send(recipientUserId, title, body, metadata, notification._id);
      if (res.success) {
        deliveredChannels.push(channel);
        if (res.status === "delivered") {
          overallStatus = "delivered"; // Immediate delivery (e.g. push driver stub)
        } else if (res.status === "queued") {
          overallStatus = "queued"; // Offline
        }
      } else {
        overallStatus = "failed";
        dispatchError = res.error;
      }
    }

    notification.deliveredChannels = deliveredChannels;
    notification.status = overallStatus;
    if (overallStatus === "processing") {
      notification.ackDeadlineAt = new Date(Date.now() + 30 * 1000);
    }
    await notification.save();

    if (overallStatus === "delivered") {
      await incrementUnread(recipientUserId);
      if (category === "queue") {
        await applyQueueReplaceRules(notification);
      }
    }

    if (overallStatus === "delivered" || overallStatus === "processing" || overallStatus === "queued") {
      outbox.status = "processed";
      outbox.processedAt = new Date();
    } else {
      outbox.status = "failed";
      outbox.attempts += 1;
      // Triggers immediate retry scheduling via retryWorker
    }
    await outbox.save();
    } catch (err) {
      if (err.name === "VersionError" && typeof notification !== "undefined" && notification && notification._id) {
        const freshNotif = await Notification.findById(notification._id);
        if (freshNotif && ["delivered", "read", "archived", "expired", "purged"].includes(freshNotif.status)) {
          console.log(`VersionError ignored as notification ${notification._id} is already in final state: ${freshNotif.status}`);
          await incrementSystemMetric("notification_ack_race_count");
          outbox.status = "processed";
          outbox.processedAt = new Date();
          await outbox.save();
          return;
        }
      }
      console.error("Error processing outbox item:", err);
      outbox.status = "failed";
      outbox.attempts += 1;
      await outbox.save();
    }
};

// ─── Retry & DLQ Worker (Lock 13, Lock G, Lock 14) ───────────────────────────
export const retryWorker = async () => {
  if (isRetryWorkerRunning) return;
  isRetryWorkerRunning = true;
  try {
    // 1. Process failed ones with backoff jitter (Lock 13, Lock G)
    const failedItems = await NotificationOutbox.find({
      status: "failed",
      attempts: { $lt: 3 },
      nextRetryAt: { $lte: new Date() }
    });

    const delays = [60000, 300000, 900000]; // 1m, 5m, 15m
    for (const item of failedItems) {
      const baseDelay = delays[item.attempts - 1] || 900000;
      const jitter = (Math.random() * 0.4 - 0.2) * baseDelay; // +/- 20%
      const finalDelay = baseDelay + jitter;
      
      item.nextRetryAt = new Date(Date.now() + finalDelay);
      item.status = "pending"; // Release back to pending
      await item.save();
    }

    // 2. Route exhausted to DLQ (Lock 14)
    const dlqItems = await NotificationOutbox.find({
      status: "failed",
      attempts: { $gte: 3 }
    });

    for (const item of dlqItems) {
      await NotificationDeadLetter.create({
        outboxId: item._id,
        payload: item.payload,
        error: "Maximum attempts exhausted",
        attempts: item.attempts
      });
      item.status = "processed"; // Finalized
      await item.save();
    }
  } catch (err) {
    console.error("Error in retry worker loop:", err);
  } finally {
    isRetryWorkerRunning = false;
  }
};

// ─── TTL & Retention Cleanup Worker (Lock 11, Lock J) ───────────────────────
export const cleanupWorker = async () => {
  if (isCleanupWorkerRunning) return;
  isCleanupWorkerRunning = true;
  try {
    // 1. Handle ACK timeouts for processing notifications (ACK Timeout)
    const timedOut = await Notification.find({
      status: "processing",
      ackDeadlineAt: { $lt: new Date() }
    });

    for (const n of timedOut) {
      n.status = "delivered";
      if (!n.deliveredChannels.includes("in_app_unconfirmed")) {
        n.deliveredChannels.push("in_app_unconfirmed");
      }
      await n.save();
      await incrementUnread(n.recipientUserId);
    }

    // 2. Soft-expire notifications (Lock 11)
    const expired = await Notification.find({
      expiresAt: { $lt: new Date() },
      status: "delivered"
    });

    for (const n of expired) {
      n.status = "expired";
      await n.save();
      await decrementUnread(n.recipientUserId);
    }

    // 3. Soft-purge / retention policies (Lock J & soft-first correction)
    const purgeOlderThan = async (days, query = {}) => {
      const limitDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const toPurge = await Notification.find({
        createdAt: { $lt: limitDate },
        status: { $ne: "purged" },
        ...query
      });
      for (const n of toPurge) {
        const wasDelivered = n.status === "delivered";
        n.status = "purged";
        n.purgedAt = new Date();
        await n.save();
        if (wasDelivered) {
          await decrementUnread(n.recipientUserId);
        }
      }
    };

    await purgeOlderThan(90, { status: "delivered" });
    await purgeOlderThan(180, { status: "read" });
    await purgeOlderThan(365, { status: "archived" });

    const limitDeadLetter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await NotificationDeadLetter.deleteMany({ createdAt: { $lt: limitDeadLetter } });
  } catch (err) {
    console.error("Error in cleanup worker loop:", err);
  } finally {
    isCleanupWorkerRunning = false;
  }
};

// ─── Worker loop initializer ───
let workerIntervals = [];
export const initNotificationWorkers = (intervalMs = 500) => {
  // Clear any existing loops
  workerIntervals.forEach(clearInterval);
  workerIntervals = [];

  workerIntervals.push(setInterval(notificationDispatcher, intervalMs));
  workerIntervals.push(setInterval(retryWorker, intervalMs));
  workerIntervals.push(setInterval(cleanupWorker, intervalMs * 4)); // Cleanup runs slightly slower
};

export const stopNotificationWorkers = () => {
  workerIntervals.forEach(clearInterval);
  workerIntervals = [];
};
