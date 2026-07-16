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
import { paginate } from "../../utils/pagination.js";

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

export const logAdminAction = async (adminId, command, payload, correlationId = "", commandKey = null, responseBody = null) => {
  const insertData = {
    adminId,
    command,
    payload,
    correlationId: correlationId || new mongoose.Types.ObjectId().toString(),
    responseBody,
    executedAt: new Date()
  };
  if (commandKey) {
    insertData.commandKey = commandKey;
  }
  return await AdminAction.create(insertData);
};

export const getAdminActionByKey = async (commandKey) => {
  if (!commandKey) return null;
  return await AdminAction.findOne({ commandKey });
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

export const getAdminAudits = async (queryOptions = {}) => {
  return await paginate(AdminAudit, queryOptions, {}, [{ path: "adminId", select: "name email" }]);
};

export const getHospitalDashboardAnalytics = async (adminUserId) => {
  const adminUser = await User.findById(adminUserId);
  if (!adminUser || !adminUser.hospitalId) {
    return {
      isHospitalAdmin: true,
      hospitalName: "Partnered Hospital",
      activeDoctors: 0,
      activePatients: 0,
      bookings: 0,
      completionRate: 0,
      noShowRate: 0,
      systemHealth: "healthy"
    };
  }

  const hospitalId = adminUser.hospitalId;
  const hospital = await Hospital.findById(hospitalId);

  const docCount = await Doctor.countDocuments({ hospitalId, status: { $in: ["active", "approved", "verified"] } });

  const doctorsInHospital = await Doctor.distinct("_id", { hospitalId });
  const patientIds = await Queue.distinct("userId", { doctorId: { $in: doctorsInHospital } });
  const patientCount = patientIds.length;

  const today = new Date().toISOString().split("T")[0];
  const start = new Date(today);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);

  const todayBookings = await Queue.find({
    doctorId: { $in: doctorsInHospital },
    createdAt: { $gte: start, $lt: end }
  });

  const bookingsCount = todayBookings.length;
  const completedCount = todayBookings.filter(q => q.status === "completed").length;
  const noShowCount = todayBookings.filter(q => q.status === "no_show").length;

  const completionRate = bookingsCount ? (completedCount / bookingsCount) * 100 : 0;
  const noShowRate = bookingsCount ? (noShowCount / bookingsCount) * 100 : 0;

  return {
    isHospitalAdmin: true,
    hospitalName: hospital ? hospital.name : "Partnered Hospital",
    activeDoctors: docCount,
    activePatients: patientCount,
    bookings: bookingsCount,
    completionRate: Math.round(completionRate),
    noShowRate: Math.round(noShowRate),
    systemHealth: "healthy"
  };
};