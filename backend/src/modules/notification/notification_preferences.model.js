import mongoose from "mongoose";

const notificationPreferencesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  categories: {
    queue: {
      in_app: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    session: {
      in_app: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    doctor: {
      in_app: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    system: {
      in_app: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    marketing: {
      in_app: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    }
  },
  quietHours: {
    enabled: { type: Boolean, default: false },
    start: { type: String, default: "22:00" },
    end: { type: String, default: "08:00" },
    timezone: { type: String, default: "Asia/Kolkata" }
  },
  emergencyBypass: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

const NotificationPreferences = mongoose.model("NotificationPreferences", notificationPreferencesSchema);
export default NotificationPreferences;
