import mongoose from "mongoose";

const connectionRegistrySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  role: {
    type: String,
    required: true
  },
  socketId: {
    type: String,
    required: true,
    unique: true
  },
  connectedAt: {
    type: Date,
    default: Date.now
  },
  lastSeenAt: {
    type: Date,
    default: Date.now
  },
  deviceId: {
    type: String
  },
  sessionId: {
    type: String
  },
  status: {
    type: String,
    enum: ["connected", "disconnected", "stale"],
    default: "connected"
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, { timestamps: true });

connectionRegistrySchema.index({ socketId: 1 }, { unique: true });
connectionRegistrySchema.index({ userId: 1 });
connectionRegistrySchema.index({ lastSeenAt: 1 });
connectionRegistrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const ConnectionRegistry = mongoose.model("ConnectionRegistry", connectionRegistrySchema);
export default ConnectionRegistry;
