import * as appointmentService from "./appointment.service.js";
import * as queueService from "./queue.service.js";
import AppointmentBooking from "./appointment_booking.model.js";
import Doctor from "../doctor/doctor.model.js";
import User from "../auth/auth.model.js";
import Receptionist from "../admin/receptionist.model.js";
import ReceptionSession from "../admin/reception_session.model.js";
import ReceptionAudit from "../admin/reception_audit.model.js";
import { getTodayIST } from "../search/utils.js";
import { paginate } from "../../utils/pagination.js";

/**
 * Get Reception Dashboard (Scoped to hospital)
 */
export const getReceptionDashboard = async (req, res) => {
  try {
    const hospitalId = req.scope?.hospitalId;
    const { search } = req.query;

    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Hospital context is required." });
    }

    const todayStr = getTodayIST();
    let query = { 
      hospitalId, 
      status: { $in: ["CONFIRMED", "BOOKED", "REMINDER_SENT", "READY", "IN_CONSULTATION"] } 
    };

    if (search) {
      const matchUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } }
        ]
      }).select("_id");
      const userIds = matchUsers.map(u => u._id);

      query = {
        ...query,
        $or: [
          { bookingNumber: { $regex: search, $options: "i" } },
          { userId: { $in: userIds } }
        ]
      };
    }

    if (req.query.page) {
      const populated = [
        { path: "userId", select: "name phone" },
        { path: "doctorId", select: "name specialization" }
      ];
      const result = await paginate(AppointmentBooking, req.query, query, populated);
      return res.status(200).json({ success: true, ...result });
    }

    const list = await AppointmentBooking.find(query)
      .populate("userId", "name phone")
      .populate("doctorId", "name specialization")
      .sort({ slotTime: 1 })
      .maxTimeMS(5000)
      .lean();

    return res.status(200).json({ success: true, data: list });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get Doctors Scoped to Hospital
 */
export const getReceptionDoctors = async (req, res) => {
  try {
    const hospitalId = req.scope?.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Hospital context is required." });
    }

    const list = await Doctor.find({ hospitalId, isActive: true });
    return res.status(200).json({ success: true, data: list });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Register Walk-in Scoped to Hospital
 */
export const registerWalkIn = async (req, res) => {
  try {
    const hospitalId = req.scope?.hospitalId;
    const operatorId = req.user.userId;
    const { doctorId, patientName, patientPhone, isPriority } = req.body;

    if (!hospitalId || !doctorId || !patientName || !patientPhone) {
      return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    // Find or create User
    let patient = await User.findOne({ phone: patientPhone });
    if (!patient) {
      patient = await User.create({
        name: patientName,
        phone: patientPhone,
        role: "patient",
        email: `${patientPhone}@smartwalkin.com`,
        password: "WalkinDefaultPassword123!"
      });
    }

    const booking = await queueService.registerWalkIn(
      hospitalId,
      doctorId,
      patient._id,
      isPriority || false,
      operatorId
    );

    // Audit Log
    await ReceptionAudit.create({
      hospitalId,
      operatorId,
      action: "WALK_IN",
      bookingId: booking._id,
      reason: "Walk-in registration",
      metadata: { patientPhone, isPriority }
    });

    return res.status(201).json({ success: true, data: booking, message: "Emergency walk-in registered." });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Check-in Scoped to Hospital
 */
export const checkInAppointment = async (req, res) => {
  try {
    const hospitalId = req.scope?.hospitalId;
    const operatorId = req.user.userId;
    const { bookingId, reason } = req.body;

    if (!bookingId || !reason) {
      return res.status(400).json({ success: false, message: "Booking ID and reason are required." });
    }

    const booking = await AppointmentBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    if (booking.hospitalId.toString() !== hospitalId.toString()) {
      return res.status(403).json({ success: false, message: "Access denied. You cannot check in patients of another hospital." });
    }

    const updated = await appointmentService.checkInAppointment(
      booking.bookingNumber,
      hospitalId,
      "reception",
      operatorId,
      reason
    );

    // Audit Log
    await ReceptionAudit.create({
      hospitalId,
      operatorId,
      action: "CHECK_IN",
      bookingId: booking._id,
      reason,
      metadata: { method: "reception" }
    });

    return res.status(200).json({ success: true, data: updated, message: "Check-in completed successfully." });
  } catch (err) {
    console.error("FULL CHECK-IN EXCEPTION DETAILS:", err);
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Transfer Scoped to Hospital
 */
export const transferAppointment = async (req, res) => {
  try {
    const hospitalId = req.scope?.hospitalId;
    const operatorId = req.user.userId;
    const { bookingId, newDoctorId, reason } = req.body;

    if (!bookingId || !newDoctorId || !reason) {
      return res.status(400).json({ success: false, message: "Booking ID, target Doctor, and reason are required." });
    }

    const booking = await AppointmentBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    if (booking.hospitalId.toString() !== hospitalId.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const updated = await appointmentService.transferAppointment(bookingId, newDoctorId, reason, operatorId);

    // Audit Log
    await ReceptionAudit.create({
      hospitalId,
      operatorId,
      action: "TRANSFER",
      bookingId: booking._id,
      reason,
      metadata: { newDoctorId }
    });

    return res.status(200).json({ success: true, data: updated, message: "Patient transferred successfully." });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Manual Override Scoped to Hospital (Cancel/No Show/Rebook)
 */
export const overrideAppointment = async (req, res) => {
  try {
    const hospitalId = req.scope?.hospitalId;
    const operatorId = req.user.userId;
    const { bookingId, action, reason, rebookDate, rebookSlot } = req.body;

    if (!bookingId || !action || !reason) {
      return res.status(400).json({ success: false, message: "Booking ID, action, and override reason are required." });
    }

    const booking = await AppointmentBooking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    if (booking.hospitalId.toString() !== hospitalId.toString()) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    let auditAction = "MANUAL_OVERRIDE";

    if (action === "cancel") {
      booking.status = "CANCELLED";
      await booking.save();
      await appointmentService.logTimeline(booking._id, "receptionist", operatorId, "CANCELLED", "reception_desk", { reason });
      await queueService.incrementKPI(booking.hospitalId, booking.date, { totalNoShows: 0 });
    } else if (action === "noshow") {
      booking.arrivalStatus = "NO_SHOW";
      booking.status = "CANCELLED";
      await booking.save();
      await appointmentService.logTimeline(booking._id, "receptionist", operatorId, "NO_SHOW", "reception_desk", { reason });
      await queueService.incrementKPI(booking.hospitalId, booking.date, { totalNoShows: 1 });
      auditAction = "NO_SHOW_OVERRIDE";
    } else if (action === "rebook") {
      if (!rebookDate || !rebookSlot) {
        return res.status(400).json({ success: false, message: "Rebooking requires date and slot time." });
      }
      booking.date = rebookDate;
      booking.slotTime = rebookSlot;
      booking.status = "BOOKED";
      booking.arrivalStatus = "NOT_ARRIVED";
      await booking.save();
      await appointmentService.logTimeline(booking._id, "receptionist", operatorId, "REBOOKED", "reception_desk", { reason, date: rebookDate, slot: rebookSlot });
    } else {
      return res.status(400).json({ success: false, message: "Invalid action." });
    }

    // Audit Log
    await ReceptionAudit.create({
      hospitalId,
      operatorId,
      action: auditAction,
      bookingId: booking._id,
      reason,
      metadata: { action, rebookDate, rebookSlot }
    });

    return res.status(200).json({ success: true, data: booking, message: `Operation ${action} completed successfully.` });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const getReceptionistProfile = async (req, res) => {
  try {
    const receptionist = await Receptionist.findOne({ userId: req.user.userId })
      .populate("hospitalId", "name address")
      .populate("userId", "name email");

    if (!receptionist) {
      return res.status(404).json({ success: false, message: "Receptionist profile not found." });
    }

    // Determine shift hours and check if outside
    const currentHour = new Date().getHours();
    let isOutsideHours = false;
    let shiftHoursText = "09:00 AM - 05:00 PM";

    switch (receptionist.shift) {
      case "Morning":
        isOutsideHours = currentHour < 8 || currentHour >= 14;
        shiftHoursText = "08:00 AM - 02:00 PM";
        break;
      case "Evening":
        isOutsideHours = currentHour < 14 || currentHour >= 20;
        shiftHoursText = "02:00 PM - 08:00 PM";
        break;
      case "Night":
        isOutsideHours = currentHour >= 8 && currentHour < 20;
        shiftHoursText = "08:00 PM - 08:00 AM";
        break;
      case "General":
        isOutsideHours = currentHour < 9 || currentHour >= 17;
        shiftHoursText = "09:00 AM - 05:00 PM";
        break;
      case "Weekend":
        const day = new Date().getDay();
        isOutsideHours = day !== 0 && day !== 6;
        shiftHoursText = "Saturdays & Sundays (09:00 AM - 05:00 PM)";
        break;
    }

    // Trace or start active session
    let activeSession = await ReceptionSession.findOne({ receptionistId: receptionist._id, status: "active" });
    if (!activeSession) {
      activeSession = await ReceptionSession.create({
        receptionistId: receptionist._id,
        loginTime: new Date(),
        counterNumber: "Counter 2",
        status: "active"
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        name: receptionist.userId.name,
        email: receptionist.userId.email,
        employeeId: receptionist.employeeId,
        shift: receptionist.shift,
        status: receptionist.status,
        hospitalName: receptionist.hospitalId.name,
        counterNumber: activeSession.counterNumber,
        shiftHoursText,
        isOutsideHours,
        warning: isOutsideHours ? "Shift outside scheduled working hours!" : null
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
