import * as scheduleService from "./schedule.service.js";
import Doctor from "./doctor.model.js";
import QueueSession from "../queue/queueSession.model.js";
import { getTodayIST } from "../search/utils.js";
import User from "../auth/auth.model.js";

/**
 * Save schedule drafts
 */
export const saveScheduleDraft = async (req, res, next) => {
  try {
    const { shifts } = req.body;
    const doctor = await Doctor.findOne({ userId: req.user.id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found." });
    }

    const result = await scheduleService.saveWeeklyScheduleDraft(doctor._id, shifts);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Publish Schedule Draft
 */
export const publishSchedule = async (req, res, next) => {
  try {
    const { version } = req.body;
    const doctor = await Doctor.findOne({ userId: req.user.id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found." });
    }

    const result = await scheduleService.publishWeeklySchedule(doctor._id, version);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Create Break
 */
export const createBreak = async (req, res, next) => {
  try {
    const { date, startTime, endTime, breakType, reason, isEmergencyOverride } = req.body;
    const doctor = await Doctor.findOne({ userId: req.user.id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found." });
    }

    const result = await scheduleService.createBreak(
      doctor._id,
      date,
      startTime,
      endTime,
      breakType,
      reason,
      isEmergencyOverride,
      req.user.id
    );

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Request Leave
 */
export const requestLeave = async (req, res, next) => {
  try {
    const { leaveType, startDate, endDate, startTime, endTime, reason, isRecurring, recurrence } = req.body;
    const doctor = await Doctor.findOne({ userId: req.user.id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found." });
    }

    const result = await scheduleService.requestLeave(
      doctor._id,
      leaveType,
      startDate,
      endDate,
      startTime,
      endTime,
      reason,
      isRecurring,
      recurrence
    );

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Leaves for Admin / Hospital Admin
 */
export const getLeaves = async (req, res, next) => {
  try {
    let hospitalId = null;
    if (req.user.role === "hospital_admin") {
      const user = await User.findById(req.user.userId);
      hospitalId = user?.hospitalId;
      if (!hospitalId) {
        return res.status(200).json({ success: true, data: [] });
      }
    }
    const result = await scheduleService.getLeaves(hospitalId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Reject Leave
 */
export const rejectLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reasonOverride } = req.body;
    const result = await scheduleService.rejectLeave(id, req.user.id, reasonOverride);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Approve Leave
 */
export const approveLeave = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reasonOverride } = req.body;

    const result = await scheduleService.approveLeave(id, req.user.id, reasonOverride);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Get visual calendar data for admin
 */
export const getCalendarData = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "startDate and endDate queries are required." });
    }

    const result = await scheduleService.getCalendarData(startDate, endDate);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Get generated slots
 */
export const getDoctorSlots = async (req, res, next) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({ success: false, message: "doctorId and date queries are required." });
    }

    const result = await scheduleService.generateDoctorSlots(doctorId, date);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Doctor availability rollups
 */
export const getDoctorAvailability = async (req, res, next) => {
  try {
    const { doctorId, date } = req.query;
    if (!doctorId || !date) {
      return res.status(400).json({ success: false, message: "doctorId and date queries are required." });
    }

    const result = await scheduleService.getDoctorAvailabilityState(doctorId, date);
    res.status(200).json({ success: true, data: { status: result } });
  } catch (err) {
    next(err);
  }
};

/**
 * Start session (session lifecycle: READY/ACTIVE status)
 */
export const startSession = async (req, res, next) => {
  try {
    const { doctorId, date, startTime, endTime } = req.body;
    const docId = doctorId || (await Doctor.findOne({ userId: req.user.id }))?._id;

    if (!docId) {
      return res.status(404).json({ success: false, message: "Doctor profile not found." });
    }

    const doctor = await Doctor.findById(docId).populate("hospitalId");

    let session = await QueueSession.findOne({
      doctorId: docId,
      date,
      "scheduleSnapshot.startTime": startTime
    });

    if (!session) {
      session = await QueueSession.create({
        doctorId: docId,
        date,
        sessionState: "READY",
        sessionStatus: "inactive",
        scheduleSnapshot: {
          startTime,
          endTime,
          queueLimit: doctor.defaultQueueLimit || 50,
          doctorName: doctor.name,
          hospitalName: doctor.hospitalId?.name || "Partnered Hospital",
          averageConsultationTime: doctor.avgConsultationTime || 10,
          scheduleVersion: 1
        }
      });
    }

    session.sessionState = "ACTIVE";
    session.sessionStatus = "active";
    session.startedAt = new Date();
    session.lastActiveSegmentStartedAt = new Date();
    await session.save();

    // Invalidate slot cache for slot generation accuracy
    scheduleService.invalidateSlotCache(docId, date);

    // Emit Realtime event via dispatchers
    try {
      const { dispatchToDoctor } = await import("../realtime/event_dispatcher.js");
      await dispatchToDoctor(docId, "SESSION_STARTED", { sessionId: session._id, date });
    } catch (wsErr) {
      console.error("WS dispatch failure in startSession:", wsErr);
    }

    res.status(200).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
};

/**
 * End session (session lifecycle: COMPLETED status)
 */
export const endSession = async (req, res, next) => {
  try {
    const { doctorId, date } = req.body;
    const docId = doctorId || (await Doctor.findOne({ userId: req.user.id }))?._id;

    if (!docId) {
      return res.status(404).json({ success: false, message: "Doctor profile not found." });
    }

    const session = await QueueSession.findOne({
      doctorId: docId,
      date,
      sessionState: { $in: ["ACTIVE", "PAUSED"] }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: "No active session found for date." });
    }

    session.sessionState = "COMPLETED";
    session.sessionStatus = "closed";
    session.closedAt = new Date();
    await session.save();

    scheduleService.invalidateSlotCache(docId, date);

    // Emit Realtime event via dispatchers
    try {
      const { dispatchToDoctor } = await import("../realtime/event_dispatcher.js");
      await dispatchToDoctor(docId, "SESSION_COMPLETED", { sessionId: session._id, date });
    } catch (wsErr) {
      console.error("WS dispatch failure in endSession:", wsErr);
    }

    res.status(200).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
};
