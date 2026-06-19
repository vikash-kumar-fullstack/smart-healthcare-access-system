import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse } from "../../utils/apiResponse.js";
import { getDoctors,createDoctorService,updateDoctorService,toggleDoctorService,getDoctorProfileService,completeDoctorProfileService, updateSettingsService, getDoctorAnalyticsService, rebuildDoctorAnalyticsService } from "./doctor.service.js";

export const listDoctors = asyncHandler(async (req, res) => {

  const doctors = await getDoctors(req.query);

  return successResponse(res, doctors, "Doctors fetched");
});


export const createDoctor = asyncHandler(async (req, res) => {

  const doctor = await createDoctorService(req.body);

  return successResponse(res, doctor, "Doctor created");
});

export const updateDoctor = asyncHandler(async (req, res) => {

  const { id } = req.params;

  const doctor = await updateDoctorService(id, req.body);

  return successResponse(res, doctor, "Doctor updated");
});

export const toggleDoctor = asyncHandler(async (req, res) => {

  const { id } = req.params;

  const doctor = await toggleDoctorService(id);

  return successResponse(res, doctor, "Doctor availability updated");
});


export const getProfile = asyncHandler(async (req, res) => {
  const doctor = await getDoctorProfileService(req.user.userId);
  if (!doctor) {
    return res.status(404).json({
      success: false,
      message: "Doctor profile stub not found. Please contact administration."
    });
  }

  return successResponse(res, {
    profileCompleted: doctor.profileCompleted,
    doctor
  }, "Doctor profile fetched successfully");
});


export const completeProfile = asyncHandler(async (req, res) => {
  const { avgConsultationTime, experienceYears } = req.body;

  if (!avgConsultationTime || avgConsultationTime <= 0) {
    return res.status(400).json({
      success: false,
      message: "Average consultation time must be a positive number"
    });
  }

  const doctor = await completeDoctorProfileService(req.user.userId, {
    avgConsultationTime: parseInt(avgConsultationTime),
    experienceYears: parseInt(experienceYears) || 0
  });

  return successResponse(res, doctor, "Doctor profile completed successfully. Pending approval.");
});

export const updateSettings = asyncHandler(async (req, res) => {
  try {
    const result = await updateSettingsService(req.user.userId, req.body);
    return res.status(200).json({
      success: true,
      availabilityState: result.availabilityState,
      scheduleUpdated: result.scheduleUpdated,
      version: result.version
    });
  } catch (err) {
    if (err.status === 409 || err.status === 400) {
      return res.status(err.status).json({
        success: false,
        canUpdate: err.canUpdate ?? false,
        retry: err.retry ?? false,
        message: err.message
      });
    }
    throw err;
  }
});

export const getAnalytics = asyncHandler(async (req, res) => {
  const { range, download } = req.query;
  const result = await getDoctorAnalyticsService(req.user.userId, range || "7days", download);

  if (download === "true" || download === true) {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="analytics-report.csv"');
    return res.status(200).json(result);
  }

  return successResponse(res, result, "Doctor analytics fetched successfully");
});

export const rebuildAnalytics = asyncHandler(async (req, res) => {
  const { doctorId, startDate, endDate } = req.body;
  if (!doctorId || !startDate || !endDate) {
    return res.status(400).json({ success: false, message: "doctorId, startDate, and endDate are required." });
  }
  const result = await rebuildDoctorAnalyticsService(doctorId, startDate, endDate, req.user.userId);
  return successResponse(res, result, "Analytics rebuilt successfully");
});