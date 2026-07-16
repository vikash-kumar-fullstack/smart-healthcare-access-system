import User from "../auth/auth.model.js";
import Receptionist from "./receptionist.model.js";
import ReceptionShiftHistory from "./reception_shift_history.model.js";
import bcrypt from "bcrypt";

export const listReceptionists = async (req, res) => {
  try {
    const hospitalId = req.scope?.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Hospital scope is required." });
    }

    const list = await Receptionist.find({ hospitalId })
      .populate("userId", "name email phone role isActive")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: list });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const createReceptionist = async (req, res) => {
  try {
    const hospitalId = req.scope?.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Hospital scope is required." });
    }

    const { name, email, phone, password, employeeId, shift, permissions } = req.body;
    if (!name || !email || !phone || !password || !employeeId) {
      return res.status(400).json({ success: false, message: "Required fields: name, email, phone, password, employeeId" });
    }

    // Check duplicate email
    const duplicateEmail = await User.findOne({ email: email.toLowerCase() });
    if (duplicateEmail) {
      return res.status(400).json({ success: false, message: "Email is already in use." });
    }

    // Check duplicate phone
    const duplicatePhone = await User.findOne({ phone });
    if (duplicatePhone) {
      return res.status(400).json({ success: false, message: "Phone number is already in use." });
    }

    // Check duplicate employee ID
    const duplicateEmp = await Receptionist.findOne({ employeeId });
    if (duplicateEmp) {
      return res.status(400).json({ success: false, message: "Employee ID is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User record
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      role: "receptionist",
      hospitalId,
      profileCompleted: true
    });

    // Create Receptionist Profile
    const profile = await Receptionist.create({
      userId: user._id,
      hospitalId,
      employeeId,
      shift: shift || "General",
      permissions: permissions || ["checkin", "walkin", "transfers"],
      status: "active"
    });

    return res.status(201).json({
      success: true,
      data: {
        id: profile._id,
        user: { name: user.name, email: user.email, phone: user.phone },
        employeeId: profile.employeeId,
        shift: profile.shift,
        status: profile.status
      },
      message: "Receptionist account created successfully."
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const updateReceptionistStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["active", "inactive", "archived"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value. Allowed: active, inactive, archived" });
    }

    const profile = await Receptionist.findById(id);
    if (!profile) {
      return res.status(404).json({ success: false, message: "Receptionist not found." });
    }

    // Validate hospital scope match
    if (profile.hospitalId.toString() !== req.scope.hospitalId.toString()) {
      return res.status(403).json({ success: false, message: "Access denied. You can only manage receptionists of your own hospital." });
    }

    profile.status = status;
    await profile.save();

    // Toggle corresponding User active state
    await User.findByIdAndUpdate(profile.userId, { isActive: status === "active" });

    return res.status(200).json({ success: true, data: profile, message: `Receptionist status updated to ${status}.` });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const updateReceptionistShift = async (req, res) => {
  try {
    const { id } = req.params;
    const { shift } = req.body;

    if (!["Morning", "Evening", "Night", "General", "Weekend"].includes(shift)) {
      return res.status(400).json({ success: false, message: "Invalid shift value." });
    }

    const profile = await Receptionist.findById(id);
    if (!profile) {
      return res.status(404).json({ success: false, message: "Receptionist not found." });
    }

    if (profile.hospitalId.toString() !== req.scope.hospitalId.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const previousShift = profile.shift;
    profile.shift = shift;
    await profile.save();

    await ReceptionShiftHistory.create({
      receptionistId: profile._id,
      previousShift,
      newShift: shift,
      assignedBy: req.user.userId || req.user.id
    });

    return res.status(200).json({ success: true, data: profile, message: `Shift assigned: ${shift}` });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const forcePasswordReset = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ success: false, message: "New password is required for force reset." });
    }

    const profile = await Receptionist.findById(id);
    if (!profile) {
      return res.status(404).json({ success: false, message: "Receptionist not found." });
    }

    if (profile.hospitalId.toString() !== req.scope.hospitalId.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(profile.userId, { password: hashedPassword });

    return res.status(200).json({ success: true, message: "Password reset completed successfully. Force-reset flag set." });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
