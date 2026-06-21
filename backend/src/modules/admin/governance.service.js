import SystemEmergencyState from "./system_emergency_state.model.js";
import { logAdminAudit, logAdminAction } from "./admin.service.js";
import { createNotification } from "../notification/notification.service.js";
import mongoose from "mongoose";

export const getEmergencyState = async () => {
  let state = await SystemEmergencyState.findOne({ singletonKey: "global" });
  if (!state) {
    state = await SystemEmergencyState.create({
      singletonKey: "global",
      pauseBookings: false,
      readonly: false,
      maintenance: false
    });
  }
  return state;
};

export const updateEmergencyState = async (adminUserId, field, active, reason, requestId = "") => {
  const allowedFields = ["pauseBookings", "readonly", "maintenance"];
  if (!allowedFields.includes(field)) {
    throw Object.assign(new Error("Invalid emergency field"), { status: 400 });
  }

  const beforeState = await getEmergencyState();
  const beforeObj = beforeState.toObject();

  beforeState[field] = active;
  beforeState.activatedBy = adminUserId;
  beforeState.reason = reason;
  beforeState.activatedAt = active ? new Date() : null;

  const afterState = await beforeState.save();

  const correlationId = new mongoose.Types.ObjectId().toString();

  // Log command ledger (Correction 3)
  await logAdminAction(adminUserId, `SET_EMERGENCY_${field.toUpperCase()}`, { active, reason }, correlationId);

  // Log Audit (Lock 3)
  await logAdminAudit(
    adminUserId,
    `UPDATE_EMERGENCY_STATE_${field.toUpperCase()}`,
    "SystemEmergencyState",
    beforeState._id,
    beforeObj,
    afterState.toObject(),
    reason,
    requestId
  );

  // Enqueue notification outbox (Correction 7)
  await createNotification(
    adminUserId,
    `Emergency Setting Modified: ${field}`,
    `Emergency setting '${field}' is now ${active ? "ENABLED" : "DISABLED"} due to: ${reason || "N/A"}`,
    "update",
    {
      category: "SYSTEM_ALERT",
      eventType: "emergency_control_modified",
      aggregateType: "SystemEmergencyState",
      aggregateId: beforeState._id
    }
  );

  return afterState;
};
