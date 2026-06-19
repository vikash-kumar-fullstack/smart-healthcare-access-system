import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import Notification from "../modules/notification/notification.model.js";
import NotificationCounter from "../modules/notification/notification_counter.model.js";
import { incrementUnread, applyQueueReplaceRules } from "../modules/notification/notification_counter.service.js";

let io = null;
const userSockets = new Map(); // userId string -> Set of socketIds

export const initSocket = (server) => {
  io = new Server(server, {
    pingTimeout: 120000,
    pingInterval: 30000,
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"]
    }
  });

  // JWT authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error("Authentication error: No token provided"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { userId, role }
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.userId;
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);

    // Join room of their userId for convenience
    socket.join(userId);

    socket.on("notification_delivered_ack", async ({ notificationId }) => {
      try {
        const notif = await Notification.findOneAndUpdate(
          {
            _id: notificationId,
            status: { $nin: ["delivered", "read", "archived", "expired", "purged"] }
          },
          {
            $set: { status: "delivered" },
            $inc: { __v: 1 }
          },
          { new: false } // Return original doc to check previous status and details
        );

        if (notif) {
          const oldStatus = notif.status;
          if (oldStatus !== "delivered") {
            await incrementUnread(notif.recipientUserId);
            if (notif.category === "queue") {
              const updatedNotif = notif.toObject();
              updatedNotif.status = "delivered";
              await applyQueueReplaceRules(updatedNotif);
            }
          }
        }
      } catch (err) {
        console.error("Error in notification_delivered_ack:", err);
      }
    });

    socket.on("disconnect", () => {
      const socketSet = userSockets.get(userId);
      if (socketSet) {
        socketSet.delete(socket.id);
        if (socketSet.size === 0) {
          userSockets.delete(userId);
        }
      }
    });
  });
};

export const getIo = () => {
  if (!io) {
    throw new Error("Socket.io is not initialized!");
  }
  return io;
};

export const emitToUser = (userId, event, data) => {
  if (!io) return false;
  const userIdStr = userId.toString();
  
  // We can emit to room "userId" directly (which is cleaner and handles multiple tabs automatically!)
  io.to(userIdStr).emit(event, data);
  
  // Also check if any sockets are connected
  const socketSet = userSockets.get(userIdStr);
  return !!(socketSet && socketSet.size > 0);
};
