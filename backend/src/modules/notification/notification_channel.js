import { emitToUser } from "../../utils/socket.js";

class InAppDriver {
  async send(recipientUserId, title, body, metadata = {}, notificationId) {
    try {
      const isOnline = emitToUser(recipientUserId, "notification", {
        id: notificationId,
        title,
        body,
        metadata
      });
      return {
        success: true,
        status: isOnline ? "processing" : "queued"
      };
    } catch (err) {
      return {
        success: false,
        status: "failed",
        error: err.message
      };
    }
  }
}

class PushDriver {
  async send(recipientUserId, title, body, metadata = {}) {
    // Stub implementation as postponed per Lock requirement
    console.log(`[PUSH DRIVER STUB] Sending to User: ${recipientUserId}, Title: ${title}, Body: ${body}`);
    return {
      success: true,
      status: "delivered"
    };
  }
}

const inAppDriver = new InAppDriver();
const pushDriver = new PushDriver();

export const getDriver = (channel) => {
  if (channel === "in_app") return inAppDriver;
  if (channel === "push") return pushDriver;
  throw new Error(`Unsupported channel: ${channel}`);
};
