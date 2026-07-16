import { Server } from "socket.io";
import { authenticateSocket } from "./socket_auth.js";
import { registerConnection, deregisterConnection, heartbeatConnection } from "./socket_registry.js";
import { trackActivity, handlePresenceDisconnect } from "./presence.service.js";
import RealtimeEvent from "./realtime_event.model.js";
import RealtimeMonitoring from "./realtime_monitoring.model.js";
import ConnectionRegistry from "./connection_registry.model.js";

let io = null;

export const initRealtime = (server) => {
  io = new Server(server, {
    pingTimeout: 120000,
    pingInterval: 30000,
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"]
    }
  });

  // Attach auth middleware
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const { userId, role, deviceId, sessionId } = socket.user;
    const socketId = socket.id;

    // Register listeners synchronously first
    socket.on("heartbeat", async () => {
      try {
        await heartbeatConnection(socketId);
        await trackActivity(userId, "connected");
      } catch (err) {
        console.error("Error handling heartbeat on socket:", socketId, err);
      }
    });

    // Client delivery ACK
    socket.on("event_ack", async ({ eventId }) => {
      try {
        const event = await RealtimeEvent.findOne({ eventId, userId });
        if (event) {
          const emitTime = event.lastSentAt || event.createdAt;
          const ackLatencyMs = Date.now() - new Date(emitTime).getTime();

          event.status = "acked";
          event.ackLatencyMs = ackLatencyMs;
          await event.save();

          await updateMonitoringStats(ackLatencyMs);

          if (event.type === "NOTIFICATION") {
            const notificationId = event.payload?.id || event.payload?.notificationId;
            if (notificationId) {
              const Notification = (await import("../notification/notification.model.js")).default;
              const { incrementUnread, applyQueueReplaceRules } = await import("../notification/notification_counter.service.js");
              
              const notif = await Notification.findOneAndUpdate(
                {
                  _id: notificationId,
                  status: { $nin: ["delivered", "read", "archived", "expired", "purged"] }
                },
                {
                  $set: { status: "delivered" },
                  $inc: { __v: 1 }
                },
                { returnDocument: "before" }
              );

              if (notif && notif.status !== "delivered") {
                await incrementUnread(notif.recipientUserId);
                if (notif.category === "queue") {
                  const updatedNotif = notif.toObject();
                  updatedNotif.status = "delivered";
                  await applyQueueReplaceRules(updatedNotif);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error(`Failed to record ACK for event ${eventId}:`, err);
      }
    });

    // Disconnect handling
    socket.on("disconnect", async () => {
      try {
        await deregisterConnection(socketId);
        await handlePresenceDisconnect(userId, socketId);
      } catch (err) {
        console.error("Error during disconnect cleanups on socket:", socketId, err);
      }
    });

    // Run connection setups asynchronously
    (async () => {
      try {
        // Register inside MongoDB
        await registerConnection(userId, socketId, role, deviceId, sessionId);

        if (!socket.connected) {
          await deregisterConnection(socketId);
          await handlePresenceDisconnect(userId, socketId);
          return;
        }

        socket.join(userId);

        // Join administration room if applicable
        if (["admin", "super_admin", "district_admin", "hospital_admin"].includes(role)) {
          socket.join("admins");
        }

        // Track online status
        await trackActivity(userId, "connected");

        // Deduplicate: find all "connected" connections for this sessionId, sort by connectedAt descending (newest first).
        if (sessionId) {
          const conns = await ConnectionRegistry.find({
            userId,
            sessionId,
            status: "connected"
          }).sort({ connectedAt: -1, _id: -1 });

          if (conns.length > 1) {
            const newestConn = conns[0];
            const olderConns = conns.slice(1);
            
            for (const conn of olderConns) {
              await ConnectionRegistry.updateOne(
                { _id: conn._id },
                { $set: { status: "disconnected", lastSeenAt: new Date() } }
              );
              
              const oldSocket = io.sockets.sockets.get(conn.socketId);
              if (oldSocket) {
                console.log(`[REALTIME SERVICE] Disconnecting duplicate active socket ${conn.socketId} for session ${sessionId}`);
                oldSocket.disconnect(true);
              }
            }
          }
        }

        // Final safety check
        if (!socket.connected) {
          await deregisterConnection(socketId);
          await handlePresenceDisconnect(userId, socketId);
        }
      } catch (err) {
        console.error("Failed to execute connection setups for socket:", socketId, err);
      }
    })();
  });

  return io;
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io is not initialized!");
  }
  return io;
};

export const updateMonitoringStats = async (newLatencyMs) => {
  try {
    const events = await RealtimeEvent.find({ status: "acked", ackLatencyMs: { $exists: true } })
      .sort({ updatedAt: -1 })
      .limit(100)
      .select("ackLatencyMs");

    if (events.length === 0) return;

    const latencies = events.map(e => e.ackLatencyMs).sort((a, b) => a - b);
    const sum = latencies.reduce((a, b) => a + b, 0);
    const avgAckLatency = Math.round(sum / latencies.length);
    
    // P95 calculation
    const p95Idx = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));
    const p95AckLatency = latencies[p95Idx];

    const activeConnections = await ConnectionRegistry.countDocuments({ status: "connected" });
    
    await RealtimeMonitoring.findOneAndUpdate(
      {},
      {
        $set: {
          activeConnections,
          avgLatency: avgAckLatency,
          avgAckLatency,
          p95AckLatency
        }
      },
      { upsert: true, returnDocument: "after" }
    );
  } catch (err) {
    console.error("Failed to update monitoring stats:", err);
  }
};
