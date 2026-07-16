import User from "../modules/auth/auth.model.js";
import Receptionist from "../modules/admin/receptionist.model.js";

/**
 * Middleware to resolve the hospitalId scope of the current request context.
 * Attaches req.scope = { hospitalId } for downstream controllers.
 */
export const attachHospitalScope = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "User context not found." });
    }

    req.scope = {};

    if (req.user.role === "receptionist") {
      const receptionist = await Receptionist.findOne({ userId: req.user.userId });
      if (!receptionist) {
        return res.status(403).json({ success: false, message: "Receptionist profile not found." });
      }
      if (receptionist.status !== "active") {
        return res.status(403).json({ success: false, message: `Receptionist profile is ${receptionist.status}.` });
      }
      req.scope.hospitalId = receptionist.hospitalId;
      req.scope.receptionistId = receptionist._id;
    } else if (req.user.role === "hospital_admin") {
      const user = await User.findById(req.user.userId);
      if (!user || !user.hospitalId) {
        return res.status(403).json({ success: false, message: "Hospital Admin is not associated with any hospital." });
      }
      req.scope.hospitalId = user.hospitalId;
    } else if (["admin", "super_admin", "district_admin"].includes(req.user.role)) {
      // Admins are allowed to specify the hospital scope explicitly
      const requestedHospitalId = req.query.hospitalId || req.body.hospitalId;
      if (requestedHospitalId) {
        req.scope.hospitalId = requestedHospitalId;
      }
    }

    next();
  } catch (err) {
    console.error("Error attaching hospital scope:", err);
    return res.status(500).json({ success: false, message: "Error establishing hospital context scope." });
  }
};

export default attachHospitalScope;
