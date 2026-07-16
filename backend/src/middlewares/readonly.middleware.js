import { getEmergencyState } from "../modules/admin/governance.service.js";

export const checkEmergencyReadonly = async (req, res, next) => {
  try {
    const state = await getEmergencyState();

    // If readonly state is active
    if (state && state.readonly) {
      // 1. Allow all GET requests
      if (req.method === "GET") {
        return next();
      }

      // 2. Normalize and check path exemptions
      const path = req.path || "";
      const cleanPath = path.replace(/\/$/, "");

      const isExempt =
        cleanPath === "/api/v1/auth/login" ||
        cleanPath === "/api/v1/auth/logout" ||
        cleanPath === "/api/v1/admin/emergency/readonly" ||
        cleanPath === "/api/v1/admin/health" ||
        cleanPath.startsWith("/api/v1/notifications") ||
        cleanPath === "/api/v1/search/analytics/action";

      if (!isExempt) {
        return res.status(403).json({
          success: false,
          message: "System is currently in emergency read-only mode. Write actions are temporarily blocked."
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default checkEmergencyReadonly;
