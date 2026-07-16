import asyncHandler from "../../utils/asyncHandler.js";
import fs from "fs";
import { successResponse, errorResponse } from "../../utils/apiResponse.js";
import User from "../auth/auth.model.js";
import * as adminService from "./admin.service.js";
import * as hospitalAdmin from "./hospital-admin.service.js";
import * as doctorAdmin from "./doctor-admin.service.js";
import * as queueAdmin from "./queue-admin.service.js";
import * as reportsAdmin from "./reports-admin.service.js";
import * as governance from "./governance.service.js";
import SystemHealth from "./system_health.model.js";
import Session from "../auth/session.model.js";
import LoginAttempt from "../auth/login_attempt.model.js";
import SecurityIncident from "./security_incident.model.js";
import AuditLog from "./audit_log.model.js";
import { paginate } from "../../utils/pagination.js";

// Tracing request ID middleware helper
const getReqId = (req) => req.requestId || "";

// Dashboard
export const dashboard = asyncHandler(async (req, res) => {
  if (req.user.role === "hospital_admin") {
    const data = await adminService.getHospitalDashboardAnalytics(req.user.userId);
    return successResponse(res, data, "Hospital dashboard analytics fetched");
  }
  const data = await adminService.getDashboardAnalytics();
  return successResponse(res, data, "Dashboard analytics fetched");
});

export const refreshDashboard = asyncHandler(async (req, res) => {
  if (req.user.role === "hospital_admin") {
    const data = await adminService.getHospitalDashboardAnalytics(req.user.userId);
    return successResponse(res, data, "Hospital dashboard analytics fetched");
  }
  const data = await adminService.forceRefreshDashboardCache();
  return successResponse(res, data, "Dashboard analytics cache refreshed");
});

// Hospitals Governance
export const getHospitals = asyncHandler(async (req, res) => {
  const data = await hospitalAdmin.getHospitals(req.query);
  return successResponse(res, data, "Hospitals list retrieved");
});

export const getHospitalById = asyncHandler(async (req, res) => {
  const data = await hospitalAdmin.getHospitalById(req.params.id);
  return successResponse(res, data, "Hospital details retrieved");
});

export const updateHospital = asyncHandler(async (req, res) => {
  const { reason, ...updateData } = req.body;
  const data = await hospitalAdmin.updateHospital(req.user.userId, req.params.id, updateData, reason, getReqId(req));
  return successResponse(res, data, "Hospital updated successfully");
});

export const suspendHospital = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const data = await hospitalAdmin.suspendHospital(req.user.userId, req.params.id, reason, getReqId(req));
  return successResponse(res, data, "Hospital suspended successfully");
});

export const reopenHospital = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const data = await hospitalAdmin.reopenHospital(req.user.userId, req.params.id, reason, getReqId(req));
  return successResponse(res, data, "Hospital reopened successfully");
});

export const archiveHospital = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const data = await hospitalAdmin.archiveHospital(req.user.userId, req.params.id, reason, getReqId(req));
  return successResponse(res, data, "Hospital archived successfully");
});

// Doctors Governance
export const getDoctors = asyncHandler(async (req, res) => {
  let hospitalId = null;
  if (req.user.role === "hospital_admin") {
    const user = await User.findById(req.user.userId);
    hospitalId = user?.hospitalId;
    if (!hospitalId) {
      return successResponse(res, [], "No hospital associated with this admin.");
    }
  }
  const data = await doctorAdmin.getDoctors(hospitalId, req.query);
  return successResponse(res, data, "Doctors list retrieved");
});

export const approveDoctor = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  try {
    const data = await doctorAdmin.approveDoctor(req.user.userId, req.params.id, reason, getReqId(req));
    return successResponse(res, data, "Doctor approved successfully");
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});

export const verifyDoctor = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  try {
    const data = await doctorAdmin.verifyDoctor(req.user.userId, req.params.id, reason, getReqId(req));
    return successResponse(res, data, "Doctor verified successfully");
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});

export const suspendDoctor = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  try {
    const data = await doctorAdmin.suspendDoctor(req.user.userId, req.params.id, reason, getReqId(req));
    return successResponse(res, data, "Doctor suspended successfully");
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});

export const resetDoctor = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  try {
    const data = await doctorAdmin.resetDoctor(req.user.userId, req.params.id, reason, getReqId(req));
    return successResponse(res, data, "Doctor profile reset successfully");
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ success: false, message: err.message });
  }
});

// Queue Command Overrides
export const getQueues = asyncHandler(async (req, res) => {
  let hospitalId = null;
  if (req.user.role === "hospital_admin") {
    const user = await User.findById(req.user.userId);
    hospitalId = user?.hospitalId;
    if (!hospitalId) {
      return successResponse(res, [], "No hospital associated with this admin.");
    }
  }
  const data = await queueAdmin.getQueues(hospitalId);
  return successResponse(res, data, "Queue sessions retrieved");
});

export const forceCloseQueue = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const data = await queueAdmin.forceCloseSession(req.user.userId, req.params.id, reason, getReqId(req));
  return successResponse(res, data, "Queue session force closed");
});

export const forceReopenQueue = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const data = await queueAdmin.forceReopenSession(req.user.userId, req.params.id, reason, getReqId(req));
  return successResponse(res, data, "Queue session force reopened");
});

export const emergencyPauseQueue = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const data = await queueAdmin.emergencyPauseSession(req.user.userId, req.params.id, reason, getReqId(req));
  return successResponse(res, data, "Queue session emergency paused");
});

export const reassignPatient = asyncHandler(async (req, res) => {
  const { queueEntryId, targetDoctorId, reason } = req.body;
  if (!queueEntryId || !targetDoctorId || !reason) {
    return errorResponse(res, "Missing queueEntryId, targetDoctorId, or reason", 400);
  }
  try {
    const data = await queueAdmin.reassignPatient(req.user.userId, queueEntryId, targetDoctorId, reason, getReqId(req));
    return successResponse(res, data, "Patient reassigned successfully");
  } catch (err) {
    const status = err.status || 400;
    return res.status(status).json({ success: false, message: err.message });
  }
});

export const revertIntervention = asyncHandler(async (req, res) => {
  try {
    const data = await queueAdmin.revertIntervention(req.user.userId, req.params.id, getReqId(req));
    return successResponse(res, data, "Intervention reverted successfully");
  } catch (err) {
    const status = err.status || 400;
    return res.status(status).json({ success: false, message: err.message });
  }
});

// Async Reports
export const triggerReport = asyncHandler(async (req, res) => {
  const { reportType } = req.body;
  if (!reportType) {
    return errorResponse(res, "reportType is required", 400);
  }
  const data = await reportsAdmin.triggerReport(req.user.userId, reportType);
  return successResponse(res, data, "Report generation triggered asynchronously");
});

export const getReports = asyncHandler(async (req, res) => {
  const data = await reportsAdmin.getReports(req.query);
  return successResponse(res, data, "Reports list retrieved");
});

export const getReportById = asyncHandler(async (req, res) => {
  const data = await reportsAdmin.getReportById(req.params.id);
  return successResponse(res, data, "Report details retrieved");
});

// Telemetry & Audits
export const getSystemHealth = asyncHandler(async (req, res) => {
  const health = await SystemHealth.findOne().sort({ createdAt: -1 });
  return successResponse(res, health || {}, "System health metrics retrieved");
});

export const getAdminAudits = asyncHandler(async (req, res) => {
  const audits = await adminService.getAdminAudits(req.query);
  return successResponse(res, audits, "Audit logs retrieved");
});

// Emergency Switches
export const getEmergencyState = asyncHandler(async (req, res) => {
  const state = await governance.getEmergencyState();
  return successResponse(res, state, "Emergency settings retrieved");
});

export const updateEmergencyStateField = (field) => {
  return asyncHandler(async (req, res) => {
    const { active, reason } = req.body;
    if (active === undefined) {
      return errorResponse(res, "active boolean is required", 400);
    }
    const state = await governance.updateEmergencyState(req.user.userId, field, active, reason, getReqId(req));
    return successResponse(res, state, `Emergency setting '${field}' updated`);
  });
};

// Sessions & Isolation (Correction 8)
export const getSessions = asyncHandler(async (req, res) => {
  const sessions = await adminService.getAdminSessions(req.user.userId);
  return successResponse(res, sessions, "Active admin sessions retrieved");
});

export const logoutAll = asyncHandler(async (req, res) => {
  await adminService.revokeAllSessions(req.user.userId);
  return successResponse(res, null, "All admin sessions revoked successfully");
});

export const getSecurityStats = asyncHandler(async (req, res) => {
  const activeSessions = await Session.countDocuments({ isRevoked: false }).maxTimeMS(2000);
  const failedAttempts = await LoginAttempt.countDocuments().maxTimeMS(2000);
  const rateLimitTriggers = await SecurityIncident.countDocuments({ category: "RATE_LIMIT_TRIGGER" }).maxTimeMS(2000);
  const securityIncidents = await SecurityIncident.countDocuments({ status: "open" }).maxTimeMS(2000);
  const auditVolume = await AuditLog.countDocuments().maxTimeMS(2000);
  const apiAbuseAttempts = await SecurityIncident.countDocuments({ category: "API_ABUSE_ATTEMPT" }).maxTimeMS(2000);

  let backupFilesCount = 0;
  try {
    const backupDir = "./backups/daily";
    if (fs.existsSync(backupDir)) {
      backupFilesCount = fs.readdirSync(backupDir).filter(f => f.endsWith(".json")).length;
    }
  } catch (err) {
    // Ignore folder read error
  }
  
  const incidents = await SecurityIncident.find({}).sort({ detectedAt: -1 }).limit(10).maxTimeMS(5000).lean();
  const recentAudits = await AuditLog.find({}).sort({ timestamp: -1 }).limit(10).maxTimeMS(5000).lean();

  return successResponse(res, {
    activeSessions,
    failedAttempts,
    rateLimitTriggers,
    securityIncidents,
    backupHealth: backupFilesCount > 0 ? "Excellent" : "Warning (No Backups Created)",
    backupFilesCount,
    auditVolume,
    apiAbuseAttempts,
    incidents,
    recentAudits
  }, "Security dashboard telemetry compiled");
});

export const getSecurityIncidents = asyncHandler(async (req, res) => {
  const result = await paginate(SecurityIncident, req.query, {});
  return successResponse(res, result, "Security incidents list retrieved");
});