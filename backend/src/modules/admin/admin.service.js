import mongoose from "mongoose";
import Hospital from "../hospital/hospital.model.js";
import Doctor from "../doctor/doctor.model.js";
import Queue from "../queue/queue.model.js";
import User from "../auth/auth.model.js";
import AdminDashboardCache from "./admin_dashboard_cache.model.js";
import AdminAudit from "./admin_audit.model.js";
import AdminAction from "./admin_action.model.js";
import AdminSession from "./admin_session.model.js";
import { computeFreshDashboardAnalytics } from "./analytics-admin.service.js";

const EXPECTED_DASHBOARD_VERSION = 3;

export const logAdminAudit = async (adminId, action, targetType, targetId, before, after, reason, requestId = "") => {
  await AdminAudit.create({
    adminId,
    action,
    targetType,
    targetId,
    before: before ? JSON.parse(JSON.stringify(before)) : null,
    after: after ? JSON.parse(JSON.stringify(after)) : null,
    reason: reason || "",
    requestId
  });
};

export const logAdminAction = async (adminId, command, payload, correlationId = "") => {
  await AdminAction.create({
    adminId,
    command,
    payload,
    correlationId: correlationId || new mongoose.Types.ObjectId().toString(),
    executedAt: new Date()
  });
};

export const getDashboardAnalytics = async () => {
  let cache = await AdminDashboardCache.findOne().sort({ createdAt: -1 });

  // Cache Version Validation (Correction 4 & Test 16)
  if (!cache || cache.dashboardVersion !== EXPECTED_DASHBOARD_VERSION) {
    const freshData = await computeFreshDashboardAnalytics();
    cache = await AdminDashboardCache.create({
      dashboardVersion: EXPECTED_DASHBOARD_VERSION,
      generatedAt: new Date(),
      ...freshData
    });
  }

  return cache;
};

export const forceRefreshDashboardCache = async () => {
  const freshData = await computeFreshDashboardAnalytics();
  return await AdminDashboardCache.create({
    dashboardVersion: EXPECTED_DASHBOARD_VERSION,
    generatedAt: new Date(),
    ...freshData
  });
};

export const getAdminSessions = async (adminId) => {
  return await AdminSession.find({ adminId }).sort({ createdAt: -1 });
};

export const revokeAllSessions = async (adminId) => {
  await AdminSession.deleteMany({ adminId });
};

export const getAdminAudits = async () => {
  return await AdminAudit.find({}).populate("adminId", "name email").sort({ createdAt: -1 });
};