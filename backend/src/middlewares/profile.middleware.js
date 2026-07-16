import User from "../modules/auth/auth.model.js";

/**
 * Middleware to verify that Patient profiles are complete before booking or managing queues
 */
export const ensureProfileCompleted = async (req, res, next) => {
  try {
    // Admins and Doctors bypass profile completion
    if (req.user.role !== "patient") {
      return next();
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: "User account not found." });
    }

    if (!user.profileCompleted) {
      return res.status(403).json({
        success: false,
        code: "PROFILE_INCOMPLETE",
        message: "Please complete your profile details (phone, gender, date of birth) first."
      });
    }

    next();
  } catch (err) {
    return res.status(500).json({ success: false, message: "Error validating profile completion status." });
  }
};
export default ensureProfileCompleted;
