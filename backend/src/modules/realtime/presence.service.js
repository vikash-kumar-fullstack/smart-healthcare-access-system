import ConnectionRegistry from "./connection_registry.model.js";
import Doctor from "../doctor/doctor.model.js";

// Heartbeat or active event updates lastSeenAt
export const trackActivity = async (userId, status = "connected") => {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await ConnectionRegistry.updateMany(
      { userId, status: "connected" },
      {
        lastSeenAt: new Date(),
        expiresAt
      }
    );
  } catch (err) {
    console.error("Failed to track activity for presence:", err);
  }
};

export const handlePresenceDisconnect = async (userId, socketId) => {
  try {
    await ConnectionRegistry.findOneAndUpdate(
      { socketId },
      {
        status: "disconnected",
        lastSeenAt: new Date()
      }
    );
  } catch (err) {
    console.error("Failed to handle disconnect for presence:", err);
  }
};

// Calculate presence dynamically based on status and timestamp
export const getPresenceStatus = async (userId) => {
  const conn = await ConnectionRegistry.findOne({ userId }).sort({ lastSeenAt: -1 });
  if (!conn) return "offline";

  const now = Date.now();
  const lastSeen = new Date(conn.lastSeenAt).getTime();

  if (conn.status === "connected") {
    // Idle threshold > 10 minutes -> away
    if (now - lastSeen > 10 * 60 * 1000) {
      return "away";
    }
    return "online";
  } else {
    // Disconnect threshold > 2 minutes -> offline
    if (now - lastSeen > 2 * 60 * 1000) {
      return "offline";
    }
    return "away"; // In-flight disconnect grace period
  }
};

export const getOnlineDoctors = async () => {
  try {
    const doctors = await Doctor.find({ status: "active" });
    const presenceList = [];

    for (const doc of doctors) {
      const state = await getPresenceStatus(doc.userId);
      presenceList.push({
        doctorId: doc._id,
        name: doc.name,
        specialization: doc.specialization,
        presenceState: state,
        lastSeenAt: doc.updatedAt
      });
    }

    return presenceList;
  } catch (err) {
    console.error("Failed to query doctor presence lists:", err);
    throw err;
  }
};
