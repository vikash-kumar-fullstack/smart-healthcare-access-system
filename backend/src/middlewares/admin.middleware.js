import AdminSession from "../modules/admin/admin_session.model.js";

export const adminMiddleware = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Access denied. Not authenticated."
    });
  }

  const adminRoles = ["admin", "super_admin", "district_admin", "hospital_admin"];
  if (!adminRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only."
    });
  }

  // Session Isolation check (Correction 8)
  if (req.user.adminSessionId) {
    const session = await AdminSession.findOne({ adminSessionId: req.user.adminSessionId });
    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Session revoked or expired. Please log in again."
      });
    }
    session.lastActivity = new Date();
    await session.save();
  }

  next();
};

export const requirePermission = (permission) => {
  return async (req, res, next) => {
    // Run admin check first
    await adminMiddleware(req, res, (err) => {
      if (err) return next(err);
      if (res.headersSent) return;

      const role = req.user.role;
      const rolePermissions = {
        super_admin: ["full"],
        admin: ["full"],
        district_admin: ["hospitals", "doctors", "reports", "approvals"],
        hospital_admin: ["local queues", "approvals", "doctors", "reports"]
      };

      const userPerms = rolePermissions[role] || [];
      if (userPerms.includes("full") || userPerms.includes(permission)) {
        return next();
      }

      return res.status(403).json({
        success: false,
        message: `Access denied. Insufficient permissions for: ${permission}.`
      });
    });
  };
};

export default adminMiddleware;