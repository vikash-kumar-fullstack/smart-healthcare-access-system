import * as doctorService from "./doctor_workspace.service.js";
import * as patientService from "./patient_portal.service.js";
import * as consentService from "./consent.service.js";
import { successResponse, errorResponse } from "../../utils/apiResponse.js";
import asyncHandler from "../../utils/asyncHandler.js";
import Doctor from "../doctor/doctor.model.js";

// Utility to get current doctor profile from user request
const getDoctorProfileId = async (req) => {
  const doc = await Doctor.findOne({ userId: req.user.userId || req.user.id });
  if (!doc) throw new Error("Doctor profile not found.");
  return doc._id;
};

// ─── DOCTOR WORKSPACE CONTROLLERS ───────────────────────────────────────────

export const postVitals = asyncHandler(async (req, res) => {
  try {
    const doctorId = await getDoctorProfileId(req);
    const { visitId, bp, pulse, height, weight, bmi, temperature, respRate, spo2 } = req.body;
    if (!visitId) return errorResponse(res, "Visit ID is required", 400);

    const vitals = await doctorService.recordVitals(doctorId, visitId, {
      bp, pulse, height, weight, bmi, temperature, respRate, spo2
    });
    return successResponse(res, vitals, "Vitals signs recorded successfully");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const saveClinicalNote = asyncHandler(async (req, res) => {
  try {
    const doctorId = await getDoctorProfileId(req);
    const { visitId, chiefComplaint, presentIllness, pastHistory, familyHistory, examination, diagnosis, clinicalNotes, advice } = req.body;
    if (!visitId || !chiefComplaint || !diagnosis) {
      return errorResponse(res, "Chief complaint and diagnosis are required.", 400);
    }

    const note = await doctorService.saveClinicalNoteDraft(doctorId, visitId, {
      chiefComplaint, presentIllness, pastHistory, familyHistory, examination, diagnosis, clinicalNotes, advice
    });
    return successResponse(res, note, "Clinical Note draft saved successfully");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const signNote = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const note = await doctorService.signClinicalNote(id);
    return successResponse(res, note, "Clinical Note signed and locked");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const addPrescription = asyncHandler(async (req, res) => {
  try {
    const doctorId = await getDoctorProfileId(req);
    const { visitId, clinicalNoteId, medicines } = req.body;
    if (!visitId || !clinicalNoteId || !medicines) {
      return errorResponse(res, "Visit, Clinical Note, and Medicines list are required.", 400);
    }

    const presc = await doctorService.savePrescription(doctorId, visitId, clinicalNoteId, medicines);
    return successResponse(res, presc, "Prescription saved successfully");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const signPresc = asyncHandler(async (req, res) => {
  try {
    const doctorId = await getDoctorProfileId(req);
    const { id } = req.params;
    const presc = await doctorService.signPrescription(id, doctorId);
    return successResponse(res, presc, "Prescription signed and locked");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const postLabOrder = asyncHandler(async (req, res) => {
  try {
    const doctorId = await getDoctorProfileId(req);
    const { visitId, tests, priority, sampleType, instructions } = req.body;
    if (!visitId || !tests) {
      return errorResponse(res, "Visit ID and tests list are required.", 400);
    }

    const lab = await doctorService.orderLabs(doctorId, visitId, tests, priority, sampleType, instructions);
    return successResponse(res, lab, "Lab Investigation ordered successfully");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const postFollowUp = asyncHandler(async (req, res) => {
  try {
    const doctorId = await getDoctorProfileId(req);
    const { visitId, nextVisit, reason, priority } = req.body;
    if (!visitId || !nextVisit || !reason) {
      return errorResponse(res, "Visit ID, date, and reason are required.", 400);
    }

    const follow = await doctorService.createFollowUp(doctorId, visitId, nextVisit, reason, priority);
    return successResponse(res, follow, "Follow-up scheduled successfully");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const closeConsultation = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params; // visit ID
    const summary = await doctorService.finalizeConsultation(id);
    return successResponse(res, summary, "Consultation closed and summary generated.");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

// ─── PATIENT PORTAL CONTROLLERS ─────────────────────────────────────────────

export const getPortalSummary = asyncHandler(async (req, res) => {
  try {
    const patientId = req.query.patientId || req.user.userId || req.user.id;
    const summary = await patientService.getPatientPortalSummary(patientId, req.user.userId || req.user.id);
    return successResponse(res, summary, "Longitudinal Patient Health Portal details retrieved");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const createFamilyLink = asyncHandler(async (req, res) => {
  try {
    const primaryUserId = req.user.userId || req.user.id;
    const { phone, relationship } = req.body;
    if (!phone || !relationship) {
      return errorResponse(res, "Phone number and relationship type are required.", 400);
    }

    const link = await patientService.addFamilyLink(primaryUserId, phone, relationship);
    return successResponse(res, link, "Family member profile linked successfully");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const listFamilyLinks = asyncHandler(async (req, res) => {
  try {
    const primaryUserId = req.user.userId || req.user.id;
    const list = await patientService.getFamilyMembers(primaryUserId);
    return successResponse(res, list, "Family member list retrieved");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const getVisitSummaryPdf = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params; // visit ID
    const summary = await patientService.getVisitSummaryPdf(id, req.user.userId || req.user.id);
    return successResponse(res, summary, "Visit summary pdf details retrieved");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const postConsentGrant = asyncHandler(async (req, res) => {
  try {
    const patientId = req.user.userId || req.user.id;
    const { granteeId, granteeType, scope, durationDays } = req.body;
    if (!granteeId || !granteeType || !scope || !durationDays) {
      return errorResponse(res, "Grantee details, scope, and duration are required.", 400);
    }

    const consent = await consentService.grantConsent(patientId, granteeId, granteeType, scope, durationDays);
    return successResponse(res, consent, "Access consent granted successfully");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const postConsentRevoke = asyncHandler(async (req, res) => {
  try {
    const patientId = req.user.userId || req.user.id;
    const { granteeId } = req.body;
    if (!granteeId) return errorResponse(res, "Grantee ID is required", 400);

    const consent = await consentService.revokeConsent(patientId, granteeId);
    return successResponse(res, consent, "Consent revoked successfully");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});
