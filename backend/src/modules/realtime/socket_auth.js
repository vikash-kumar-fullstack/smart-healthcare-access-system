import jwt from "jsonwebtoken";
import User from "../auth/auth.model.js";
import { getEmergencyState } from "../admin/governance.service.js";

export const authenticateSocket = async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) {
    return next(new Error("Authentication error: No token provided"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.userId) {
      return next(new Error("Authentication error: Invalid token structure"));
    }

    // Retrieve user and check status
    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new Error("Authentication error: User not found"));
    }

    if (user.isActive === false) {
      return next(new Error("Authentication error: User account is inactive"));
    }

    // Role validation
    if (user.role !== decoded.role) {
      return next(new Error("Authentication error: Role mismatch"));
    }

    // Check emergency readonly state
    let readonly = false;
    try {
      const emergency = await getEmergencyState();
      if (emergency && emergency.readonly) {
        readonly = true;
      }
    } catch (err) {
      console.error("Failed to query emergency state in socket auth:", err);
    }

    // Attach decoded details and readonly info to socket
    socket.user = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
      deviceId: socket.handshake.auth?.deviceId || socket.handshake.query?.deviceId || "default_device",
      sessionId: socket.handshake.auth?.sessionId || socket.handshake.query?.sessionId || "default_session"
    };
    socket.readonly = readonly;

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new Error("Authentication error: Token expired"));
    }
    return next(new Error("Authentication error: Invalid token"));
  }
};
