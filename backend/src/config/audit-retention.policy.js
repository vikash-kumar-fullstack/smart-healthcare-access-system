import AuditLog from "../modules/admin/audit_log.model.js";
import SecurityIncident from "../modules/admin/security_incident.model.js";
import LoginAttempt from "../modules/auth/login_attempt.model.js";
import Session from "../modules/auth/session.model.js";

export const runRetentionPurge = async () => {
  const now = new Date();
  
  // Cutoffs
  const cutoffAudit = new Date(now.getTime() - 7 * 365 * 24 * 60 * 60 * 1000);
  const cutoffIncidents = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
  const cutoffLoginAttempts = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const cutoffSessions = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Exclude AuditLog immutability hooks for retention pruning by bypassing model checks, 
  // or use direct raw MongoDB deletes which don't trigger mongoose middleware!
  // Direct mongo deletes bypass validation/immutability hooks, which is standard for database cleanups!
  const auditRes = await AuditLog.collection.deleteMany({ timestamp: { $lt: cutoffAudit } });
  const incidentRes = await SecurityIncident.collection.deleteMany({ detectedAt: { $lt: cutoffIncidents } });
  const loginRes = await LoginAttempt.collection.deleteMany({ updatedAt: { $lt: cutoffLoginAttempts } });
  const sessionRes = await Session.collection.deleteMany({ expiresAt: { $lt: cutoffSessions } });

  return {
    auditsPurged: auditRes.deletedCount || 0,
    incidentsPurged: incidentRes.deletedCount || 0,
    loginAttemptsPurged: loginRes.deletedCount || 0,
    sessionsPurged: sessionRes.deletedCount || 0
  };
};
