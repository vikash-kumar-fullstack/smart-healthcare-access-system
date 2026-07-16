import crypto from "crypto";
import RealtimeEvent from "./realtime_event.model.js";
import RealtimeSequence from "./realtime_sequence.model.js";
import Doctor from "../doctor/doctor.model.js";
import User from "../auth/auth.model.js";
import { getIo } from "./realtime.service.js";

// Helper to generate a sequence number for a user atomically
const getNextSequence = async (userId) => {
  const seq = await RealtimeSequence.findOneAndUpdate(
    { userId },
    { $inc: { current: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return seq.current;
};

export const dispatchToUser = async (userId, type, payload) => {
  try {
    const userIdStr = userId.toString();
    const sequenceNumber = await getNextSequence(userId);
    const eventId = crypto.randomUUID();
    const idempotencyKey = `${type}_${userIdStr}_${sequenceNumber}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours TTL

    // Create the persistent RealtimeEvent document
    const eventDoc = await RealtimeEvent.create({
      eventId,
      sequenceNumber,
      userId,
      type,
      payload,
      status: "pending",
      eventVersion: 1,
      idempotencyKey,
      expiresAt
    });

    // Try to emit to the socket room of this user
    let io;
    try {
      io = getIo();
    } catch (e) {
      // Socket not initialized yet (e.g. during seeding or background tasks)
      return eventDoc;
    }

    if (io) {
      io.to(userIdStr).emit("realtime_event", {
        eventId,
        sequenceNumber,
        type,
        payload,
        eventVersion: 1,
        idempotencyKey
      });

      // Update event status to sent and set lastSentAt
      eventDoc.status = "sent";
      eventDoc.lastSentAt = new Date();
      await eventDoc.save();
    }

    return eventDoc;
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate idempotencyKey, return existing event
      console.log(`[DEBUG DISPATCH] Duplicate event detected for key: ${type}_${userId}`);
      return await RealtimeEvent.findOne({ userId, type });
    }
    console.error(`Failed to dispatch event to user ${userId}:`, err);
    throw err;
  }
};

export const dispatchToDoctor = async (doctorId, type, payload) => {
  try {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      console.error(`Doctor not found with ID ${doctorId}`);
      return null;
    }
    return await dispatchToUser(doctor.userId, type, payload);
  } catch (err) {
    console.error(`Failed to dispatch event to doctor ${doctorId}:`, err);
    throw err;
  }
};

export const dispatchToHospital = async (hospitalId, type, payload) => {
  try {
    // Find all active doctors registered in this hospital
    const doctors = await Doctor.find({ hospitalId, status: "active" });
    const promises = doctors.map(doc => dispatchToDoctor(doc._id, type, payload));
    return await Promise.all(promises);
  } catch (err) {
    console.error(`Failed to dispatch event to hospital ${hospitalId}:`, err);
    throw err;
  }
};

export const dispatchToAdmins = async (type, payload) => {
  try {
    // Find all administrative roles
    const admins = await User.find({
      role: { $in: ["admin", "super_admin", "district_admin", "hospital_admin"] },
      isActive: true
    });
    const promises = admins.map(adm => dispatchToUser(adm._id, type, payload));
    return await Promise.all(promises);
  } catch (err) {
    console.error(`Failed to dispatch event to admins:`, err);
    throw err;
  }
};
