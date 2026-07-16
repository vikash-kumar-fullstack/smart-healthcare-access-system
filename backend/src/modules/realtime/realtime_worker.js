import RealtimeEvent from "./realtime_event.model.js";
import ConnectionRegistry from "./connection_registry.model.js";
import { getIo } from "./realtime.service.js";

let isRetryLoopRunning = false;
let isCleanupLoopRunning = false;

// Retry intervals: 30s, 60s, 180s
const RETRY_DELAYS = [30000, 60000, 180000];

export const retryUnackedEvents = async () => {
  if (isRetryLoopRunning) return;
  isRetryLoopRunning = true;

  try {
    const io = getIo();
    const now = new Date();

    // Query events that were sent but not acked, and are due for a retry
    const unackedEvents = await RealtimeEvent.find({
      status: { $in: ["sent", "pending"] },
      retryCount: { $lt: 3 }
    });

    for (const event of unackedEvents) {
      // Use lastSentAt or createdAt if it hasn't been sent yet
      const baseTime = event.lastSentAt || event.createdAt;
      const delay = RETRY_DELAYS[event.retryCount] || 180000;

      if (now.getTime() - new Date(baseTime).getTime() >= delay) {
        const userIdStr = event.userId.toString();
        
        // Re-emit the event
        io.to(userIdStr).emit("realtime_event", {
          eventId: event.eventId,
          sequenceNumber: event.sequenceNumber,
          type: event.type,
          payload: event.payload,
          eventVersion: event.eventVersion,
          idempotencyKey: event.idempotencyKey
        });

        // Update retry counts and timestamps
        event.retryCount += 1;
        event.lastSentAt = new Date();
        event.status = "sent";
        await event.save();
        console.log(`[REALTIME WORKER] Retried event ${event.eventId} to user ${userIdStr} (Attempt ${event.retryCount})`);
      }
    }

    // DLQ transition for events failing after 3 attempts
    const exhaustedEvents = await RealtimeEvent.find({
      status: { $in: ["sent", "pending"] },
      retryCount: { $gte: 3 }
    });

    for (const event of exhaustedEvents) {
      event.status = "dlq";
      await event.save();
      console.log(`[REALTIME WORKER] Event ${event.eventId} moved to DLQ (failed all retry attempts)`);
    }

  } catch (err) {
    // If socket io isn't initialized yet, catch silently
    if (err.message !== "Socket.io is not initialized!") {
      console.error("Error in realtime worker retry loop:", err);
    }
  } finally {
    isRetryLoopRunning = false;
  }
};

export const cleanupStaleConnections = async () => {
  if (isCleanupLoopRunning) return;
  isCleanupLoopRunning = true;

  try {
    const now = Date.now();
    const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);

    // Find connections that have not checked in (heartbeat) for 5 minutes
    const staleConns = await ConnectionRegistry.find({
      status: "connected",
      lastSeenAt: { $lt: fiveMinutesAgo }
    });

    for (const conn of staleConns) {
      conn.status = "stale";
      await conn.save();
      console.log(`[REALTIME WORKER] Connection socket ${conn.socketId} marked as stale`);
    }

  } catch (err) {
    console.error("Error in realtime worker cleanup loop:", err);
  } finally {
    isCleanupLoopRunning = false;
  }
};

let workerIntervals = [];

export const initRealtimeWorkers = (intervalMs = 2000) => {
  workerIntervals.forEach(clearInterval);
  workerIntervals = [];

  workerIntervals.push(setInterval(retryUnackedEvents, intervalMs));
  workerIntervals.push(setInterval(cleanupStaleConnections, intervalMs * 10));
};

export const stopRealtimeWorkers = () => {
  workerIntervals.forEach(clearInterval);
  workerIntervals = [];
};
