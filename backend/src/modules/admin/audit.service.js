import AuditLog from "./audit_log.model.js";
import SecurityIncident from "./security_incident.model.js";

// Helper to determine role permissions at execution time
export const getPermissionsForRole = (role) => {
  const rolePermissions = {
    super_admin: ["full"],
    admin: ["full"],
    district_admin: ["hospitals", "doctors", "reports", "approvals"],
    hospital_admin: ["local queues", "approvals", "doctors", "reports"],
    receptionist: ["checkin", "walkin", "transfers", "queuemonitor", "emergency"],
    doctor: ["clinical_notes", "prescriptions", "lab_orders"],
    patient: ["book", "consent", "profile", "family"]
  };
  return rolePermissions[role] || [];
};

export const logEvent = async ({
  actorId,
  actorRole,
  action,
  resourceType,
  resourceId,
  req,
  success = true,
  failureReason = null,
  metadata = {}
}) => {
  try {
    let resolvedActorId = actorId;
    let resolvedActorRole = actorRole;

    if (req && req.user) {
      resolvedActorId = resolvedActorId || req.user.userId || req.user.id;
      resolvedActorRole = resolvedActorRole || req.user.role;
    }

    const role = resolvedActorRole || "guest";
    const perms = getPermissionsForRole(role);

    const logEntry = new AuditLog({
      actorId: resolvedActorId,
      actorRole: role,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      requestMethod: req ? req.method : "",
      requestPath: req ? req.originalUrl || req.path : "",
      ipAddress: req ? req.ip || req.headers["x-forwarded-for"] || "" : "",
      userAgent: req ? req.headers["user-agent"] || "" : "",
      success,
      failureReason,
      metadata,
      actorRoleSnapshot: role,
      permissionSnapshot: perms
    });

    await logEntry.save();
    return logEntry;
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
};

export const logFailure = async ({
  actorId,
  actorRole,
  action,
  req,
  reason,
  metadata = {}
}) => {
  return logEvent({
    actorId,
    actorRole,
    action,
    resourceType: "System",
    req,
    success: false,
    failureReason: reason,
    metadata
  });
};

export const logSecurityIncident = async ({
  category,
  description,
  req,
  affectedUserId,
  severity = "medium"
}) => {
  try {
    const incident = new SecurityIncident({
      severity,
      category,
      description,
      detectedAt: new Date(),
      status: "open",
      affectedUserId: affectedUserId || (req?.user ? (req.user.userId || req.user.id) : null)
    });
    await incident.save();

    // Log the audit event for this security alert
    await logEvent({
      action: "SECURITY_ALERT_TRIGGERED",
      resourceType: "SecurityIncident",
      resourceId: incident._id,
      req,
      success: true,
      metadata: { category, description, severity }
    });

    return incident;
  } catch (err) {
    console.error("Failed to log security incident:", err);
  }
};
