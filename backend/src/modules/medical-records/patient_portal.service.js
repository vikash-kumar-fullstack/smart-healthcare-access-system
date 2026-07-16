import PatientHealthProfile from "./patient_health_profile.model.js";
import Prescription from "./prescription.model.js";
import Report from "./report.model.js";
import FamilyMember from "./family_member.model.js";
import FollowUp from "./follow_up.model.js";
import MedicationReminder from "./medication_reminder.model.js";
import VisitSummary from "./visit_summary.model.js";
import User from "../auth/auth.model.js";
import { getPatientFeed } from "./timeline.service.js";
import { checkAccessConsent } from "./consent.service.js";

/**
 * Fetch patient health portal data summary
 */
export const getPatientPortalSummary = async (patientId, accessorId = null) => {
  // Authorization Consent Check
  if (accessorId && accessorId.toString() !== patientId.toString()) {
    const allowed = await checkAccessConsent(patientId, accessorId, "view_records");
    if (!allowed) throw new Error("Access denied: Insufficient patient consent.");
  }

  const [profile, timeline, upcomingFollowUps, reminders, prescriptions, reports] = await Promise.all([
    PatientHealthProfile.findOne({ patientId }),
    getPatientFeed(patientId),
    FollowUp.find({ patientId, status: "scheduled" }).populate("assignedDoctorId", "name"),
    MedicationReminder.find({ patientId, isActive: true }),
    Prescription.find({ patientId, status: "SIGNED" }).sort({ createdAt: -1 }),
    Report.find({ patientId, status: "active" }).sort({ createdAt: -1 })
  ]);

  return {
    profile,
    timeline,
    upcomingFollowUps,
    reminders,
    recentPrescription: prescriptions[0] || null,
    recentReport: reports[0] || null
  };
};

/**
 * Family profiles linking
 */
export const addFamilyLink = async (primaryUserId, phone, relationship) => {
  const member = await User.findOne({ phone });
  if (!member) throw new Error("No registered patient found matching phone number.");

  if (member._id.toString() === primaryUserId.toString()) {
    throw new Error("Cannot link yourself as a family member.");
  }

  return await FamilyMember.findOneAndUpdate(
    { primaryUserId, memberUserId: member._id },
    { relationship },
    { upsert: true, new: true }
  );
};

/**
 * Get all linked family members profiles
 */
export const getFamilyMembers = async (primaryUserId) => {
  return await FamilyMember.find({ primaryUserId })
    .populate("memberUserId", "name email phone");
};

/**
 * Get Visit Summary details
 */
export const getVisitSummaryPdf = async (visitId, accessorId) => {
  const summary = await VisitSummary.findOne({ visitId }).populate("prescriptionId").populate("clinicalNoteId");
  if (!summary) throw new Error("Visit summary details not finalized.");

  // Access check
  if (accessorId.toString() !== summary.patientId.toString()) {
    const allowed = await checkAccessConsent(summary.patientId, accessorId, "view_records");
    if (!allowed) throw new Error("Access denied: No record viewing consent granted.");
  }

  return summary;
};
