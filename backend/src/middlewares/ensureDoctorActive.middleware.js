import Doctor from "../modules/doctor/doctor.model.js";

export const ensureDoctorActive = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user.userId });
    if (!doctor) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Doctor profile not found."
      });
    }

    if (!doctor.profileCompleted) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Please complete your profile first."
      });
    }

    if (doctor.status === "pending_activation") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Your profile is pending administrator approval."
      });
    }

    if (doctor.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Doctor account is suspended or inactive."
      });
    }

    // Attach doctor info to request for downstream usage
    req.doctor = doctor;
    next();
  } catch (err) {
    next(err);
  }
};
