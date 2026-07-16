import ConnectionRegistry from "./connection_registry.model.js";

export const registerConnection = async (userId, socketId, role, deviceId = null, sessionId = null) => {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
    
    // Mark previous connections on the same session as disconnected
    if (sessionId) {
      await ConnectionRegistry.updateMany(
        { userId, sessionId, socketId: { $ne: socketId }, status: "connected" },
        { status: "disconnected", lastSeenAt: new Date() }
      );
    }
    
    // Perform an upsert/update or create
    const conn = await ConnectionRegistry.findOneAndUpdate(
      { socketId },
      {
        userId,
        role,
        socketId,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        deviceId,
        sessionId,
        status: "connected",
        expiresAt
      },
      { upsert: true, returnDocument: 'after' }
    );
    return conn;
  } catch (err) {
    console.error(`Failed to register connection for socket ${socketId}:`, err);
    throw err;
  }
};

export const deregisterConnection = async (socketId) => {
  try {
    const conn = await ConnectionRegistry.findOneAndUpdate(
      { socketId },
      {
        status: "disconnected",
        lastSeenAt: new Date()
      },
      { returnDocument: 'after' }
    );
    return conn;
  } catch (err) {
    console.error(`Failed to deregister connection for socket ${socketId}:`, err);
    throw err;
  }
};

export const heartbeatConnection = async (socketId) => {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const conn = await ConnectionRegistry.findOneAndUpdate(
      { socketId, status: "connected" },
      {
        lastSeenAt: new Date(),
        expiresAt
      },
      { returnDocument: 'after' }
    );
    return conn;
  } catch (err) {
    console.error(`Failed to record heartbeat for socket ${socketId}:`, err);
    return null;
  }
};
