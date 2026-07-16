import * as appointmentService from "./appointment.service.js";
import * as queueService from "./queue.service.js";
import AppointmentBooking from "./appointment_booking.model.js";
import AppointmentTimeline from "./appointment_timeline.model.js";
import HospitalSchedulingPolicy from "../hospital/hospital_scheduling_policy.model.js";
import Doctor from "../doctor/doctor.model.js";
import User from "../auth/auth.model.js";
import QueueKPI from "./queue_kpi.model.js";
import { getTodayIST } from "../search/utils.js";
import { paginate } from "../../utils/pagination.js";

/**
 * Patient booking handler
 */
export const book = async (req, res, next) => {
  try {
    const { doctorId, date, slotTime } = req.body;
    const defaultDate = date || getTodayIST();
    let defaultSlot = slotTime;
    if (!defaultSlot) {
      const count = await AppointmentBooking.countDocuments({ doctorId, date: defaultDate });
      const minutes = 10 * count;
      const startHour = 10;
      const totalMinutes = startHour * 60 + minutes;
      const hr = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
      const min = String(totalMinutes % 60).padStart(2, "0");
      defaultSlot = `${hr}:${min}`;
    }
    const booking = await appointmentService.bookAppointment(req.user.userId || req.user.id, doctorId, defaultDate, defaultSlot);
    res.status(201).json({ success: true, data: booking, message: "Appointment booked successfully." });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Smart Check-in handler
 */
export const checkIn = async (req, res, next) => {
  try {
    const { bookingSearch, hospitalId, method } = req.body;
    const booking = await appointmentService.checkInAppointment(
      bookingSearch,
      hospitalId,
      method || "app",
      req.user?.userId || req.user?.id
    );
    res.status(200).json({ success: true, data: booking, message: "Check-in completed successfully." });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Receptionist operational overrides
 */
export const receptionOverride = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason, newDoctorId, rebookDate, rebookSlot } = req.body;
    const operatorId = req.user?.userId || req.user?.id;

    // Enforce mandatory override parameters
    if (!reason || !operatorId) {
      return res.status(400).json({
        success: false,
        message: "Reason and Operator ID are mandatory for reception overrides."
      });
    }

    const booking = await AppointmentBooking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    if (action === "checkin") {
      // Manual checkin override bypassing check-in window limits
      const updated = await appointmentService.checkInAppointment(booking.bookingNumber, booking.hospitalId, "reception", operatorId, reason);
      return res.status(200).json({ success: true, data: updated, message: "Manual check-in override completed." });
    }

    if (action === "transfer") {
      if (!newDoctorId) {
        return res.status(400).json({ success: false, message: "Missing target doctor ID for transfer." });
      }
      const newBooking = await appointmentService.transferAppointment(booking._id, newDoctorId, reason, operatorId);
      return res.status(200).json({ success: true, data: newBooking, message: "Appointment transferred successfully." });
    }

    if (action === "cancel") {
      booking.status = "CANCELLED";
      await booking.save();
      await appointmentService.logTimeline(booking._id, "receptionist", operatorId, "CANCELLED", "reception_desk", { reason });
      // Update KPIs
      await queueService.incrementKPI(booking.hospitalId, booking.date, { totalNoShows: 0 }); // seed metric doc if needed
      return res.status(200).json({ success: true, data: booking, message: "Appointment cancelled." });
    }

    if (action === "noshow") {
      booking.arrivalStatus = "NO_SHOW";
      booking.status = "CANCELLED";
      await booking.save();
      await appointmentService.logTimeline(booking._id, "receptionist", operatorId, "NO_SHOW", "reception_desk", { reason });
      // Update KPIs
      await queueService.incrementKPI(booking.hospitalId, booking.date, { totalNoShows: 1 });
      return res.status(200).json({ success: true, data: booking, message: "Marked as No Show." });
    }

    if (action === "rebook") {
      if (!rebookDate || !rebookSlot) {
        return res.status(400).json({ success: false, message: "Missing date and slot details for rebooking." });
      }
      // Rebook: cancel previous and create new
      booking.status = "CANCELLED";
      await booking.save();
      await appointmentService.logTimeline(booking._id, "receptionist", operatorId, "REBOOKED_CANCEL", "reception_desk", { reason });

      const newBooking = await appointmentService.bookAppointment(booking.userId, booking.doctorId, rebookDate, rebookSlot);
      return res.status(200).json({ success: true, data: newBooking, message: "Rebooking completed successfully." });
    }

    res.status(400).json({ success: false, message: "Invalid receptionist override action." });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Emergency Walk-in Handler
 */
export const registerWalkIn = async (req, res, next) => {
  try {
    const { hospitalId, doctorId, patientName, patientPhone, isPriority } = req.body;
    const operatorId = req.user?.userId || req.user?.id;

    if (!operatorId) {
      return res.status(400).json({
        success: false,
        message: "Operator ID is mandatory for walk-in registrations."
      });
    }

    // Find or create mock User for walk-in patient by phone
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

    res.status(201).json({ success: true, data: booking, message: "Emergency walk-in registered." });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Receptionist Dashboard Data Loader
 */
export const getReceptionDashboard = async (req, res, next) => {
  try {
    const { hospitalId, search } = req.query;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Hospital ID is required." });
    }

    const todayStr = getTodayIST();
    let query = { hospitalId, date: todayStr };

    // Search filter parsing
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

    res.status(200).json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
};

/**
 * Doctor Dashboard Timeline Loader
 */
export const getDoctorTimeline = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user.userId || req.user.id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found." });
    }

    const todayStr = getTodayIST();
    const timeline = await AppointmentBooking.find({
      doctorId: doctor._id,
      date: todayStr
    })
      .populate("userId", "name phone")
      .sort({ slotTime: 1 });

    res.status(200).json({ success: true, data: timeline });
  } catch (err) {
    next(err);
  }
};

/**
 * Call Next Patient
 */
export const callNext = async (req, res, next) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user.userId || req.user.id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found." });
    }

    const todayStr = getTodayIST();
    const nextPatient = await queueService.callNextPatient(doctor._id, todayStr, req.user.userId || req.user.id);
    res.status(200).json({ success: true, data: nextPatient, message: "Called next patient successfully." });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Skip Patient
 */
export const skip = async (req, res, next) => {
  try {
    const { id } = req.body; // booking ID
    const updated = await queueService.completeConsultation(id, req.user.userId || req.user.id);
    res.status(200).json({ success: true, data: updated, message: "Consultation marked completed/closed." });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * Retrieve Appointment Timeline logs
 */
export const getTimelineLogs = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const logs = await AppointmentTimeline.find({ bookingId }).sort({ timestamp: 1 });
    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieve patient's active booking
 */
export const myQueue = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const active = await AppointmentBooking.findOne({
      userId,
      status: { $in: ["BOOKED", "CONFIRMED", "REMINDER_SENT", "READY", "IN_CONSULTATION"] }
    })
      .populate("doctorId", "name specialization")
      .populate("hospitalId", "name");

    return res.status(200).json({ success: true, data: active });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieve patient's booking history
 */
export const history = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;
    const list = await AppointmentBooking.find({
      userId,
      status: { $in: ["COMPLETED", "CANCELLED", "TRANSFERRED", "EXPIRED"] }
    })
      .populate("doctorId", "name specialization")
      .populate("hospitalId", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: list });
  } catch (err) {
    next(err);
  }
};

/**
 * Calculate KPI analytics based on continuous aggregated metrics
 */
export const getOperationalAnalytics = async (req, res, next) => {
  try {
    const { hospitalId } = req.query;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Hospital ID is required." });
    }

    const todayStr = getTodayIST();
    const kpi = await QueueKPI.findOne({ hospitalId, date: todayStr });

    if (!kpi) {
      // Fallback response with zero values
      return res.status(200).json({
        success: true,
        data: {
          totalBookings: 0,
          checkInRate: 0,
          noShowRate: 0,
          transferRate: 0,
          completionRate: 0,
          averageWaitMinutes: 0,
          averageCheckInDelayMinutes: 0
        }
      });
    }

    const checkInRate = kpi.totalBookings > 0 ? Math.round((kpi.totalCheckIns / kpi.totalBookings) * 100) : 0;
    const noShowRate = kpi.totalBookings > 0 ? Math.round((kpi.totalNoShows / kpi.totalBookings) * 100) : 0;
    const transferRate = kpi.totalBookings > 0 ? Math.round((kpi.totalTransfers / kpi.totalBookings) * 100) : 0;
    const completionRate = kpi.totalBookings > 0 ? Math.round((kpi.totalCompletions / kpi.totalBookings) * 100) : 0;
    const averageWaitMinutes = kpi.totalCompletions > 0 ? Math.round((kpi.totalWaitTimeMs / kpi.totalCompletions) / 60000) : 0;
    const averageCheckInDelayMinutes = kpi.totalCheckIns > 0 ? Math.round((kpi.totalCheckInDelayMs / kpi.totalCheckIns) / 60000) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalBookings: kpi.totalBookings,
        checkInRate,
        noShowRate,
        transferRate,
        completionRate,
        averageWaitMinutes,
        averageCheckInDelayMinutes
      }
    });
  } catch (err) {
    next(err);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Try Queue model first (primary booking flow)
    const Queue = (await import("../queue/queue.model.js")).default;
    const queue = await Queue.findById(id)
      .populate({
        path: "doctorId",
        select: "name specialization avgConsultationTime userId",
        populate: { path: "hospitalId", select: "name address" }
      })
      .populate("userId", "name phone email")
      .populate("sessionId", "date sessionStatus");

    if (queue) {
      const doctor = queue.doctorId;
      const hospital = doctor?.hospitalId;
      const session = queue.sessionId;

      // Build a normalized booking object for the frontend
      const booking = {
        _id: queue._id,
        bookingNumber: `MH-${String(queue.queueNumber).padStart(4, "0")}`,
        userId: queue.userId,
        doctorId: {
          _id: doctor?._id,
          name: doctor?.name,
          specialization: doctor?.specialization,
          avgConsultationTime: doctor?.avgConsultationTime
        },
        hospitalId: {
          _id: hospital?._id,
          name: hospital?.name,
          address: hospital?.address
        },
        bookingDate: session?.date || queue.createdAt?.toLocaleDateString("en-CA"),
        slotTime: queue.slotTime || "—",
        status: queue.status,
        queueNumber: queue.queueNumber,
        isPriority: queue.isPriority,
        createdAt: queue.createdAt
      };
      return res.status(200).json({ success: true, data: booking });
    }

    // Fallback: try AppointmentBooking model
    const booking = await AppointmentBooking.findById(id)
      .populate("userId", "name phone email")
      .populate("doctorId", "name specialization avgConsultationTime")
      .populate("hospitalId", "name address location");
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }
    return res.status(200).json({ success: true, data: booking });
  } catch (err) {
    next(err);
  }
};
