import crypto from "crypto";
import ClinicalNote from "./clinical_note.model.js";
import VitalSign from "./vital_sign.model.js";
import Prescription from "./prescription.model.js";
import LabOrder from "./lab_order.model.js";
import FollowUp from "./follow_up.model.js";
import VisitSummary from "./visit_summary.model.js";
import Visit from "../visit/visit.model.js";
import Doctor from "../doctor/doctor.model.js";
import PatientHealthProfile from "./patient_health_profile.model.js";
import MedicationReminder from "./medication_reminder.model.js";
import { logTimelineEvent } from "./timeline.service.js";
import { generatePdf } from "./pdf.service.js";

/**
 * Record Patient Vitals
 */
export const recordVitals = async (doctorId, visitId, vitalsData) => {
  const visit = await Visit.findById(visitId);
  if (!visit) throw new Error("Visit not found.");

  const vitals = await VitalSign.findOneAndUpdate(
    { visitId },
    {
      patientId: visit.patientId,
      doctorId,
      bp: vitalsData.bp,
      pulse: vitalsData.pulse,
      height: vitalsData.height,
      weight: vitalsData.weight,
      bmi: vitalsData.bmi || (vitalsData.weight / Math.pow(vitalsData.height / 100, 2)),
      temperature: vitalsData.temperature,
      respRate: vitalsData.respRate,
      spo2: vitalsData.spo2
    },
    { upsert: true, new: true }
  );

  await logTimelineEvent(
    visit.patientId,
    visit.patientId,
    "system",
    "system_worker",
    "CHECKED_IN",
    "Visit",
    visitId,
    { message: "Vitals recorded for visit." }
  );

  return vitals;
};

/**
 * Create or Edit Clinical Note Draft
 */
export const saveClinicalNoteDraft = async (doctorId, visitId, noteData) => {
  const visit = await Visit.findById(visitId);
  if (!visit) throw new Error("Visit not found.");

  const existing = await ClinicalNote.findOne({ visitId });
  if (existing && existing.status === "SIGNED") {
    throw new Error("Clinical Note is signed and immutable.");
  }

  return await ClinicalNote.findOneAndUpdate(
    { visitId },
    {
      patientId: visit.patientId,
      doctorId,
      chiefComplaint: noteData.chiefComplaint,
      presentIllness: noteData.presentIllness || "",
      pastHistory: noteData.pastHistory || "",
      familyHistory: noteData.familyHistory || "",
      examination: noteData.examination || "",
      diagnosis: noteData.diagnosis,
      clinicalNotes: noteData.clinicalNotes || "",
      advice: noteData.advice || "",
      status: "DRAFT"
    },
    { upsert: true, new: true }
  );
};

/**
 * Sign Clinical Note
 */
export const signClinicalNote = async (clinicalNoteId) => {
  const note = await ClinicalNote.findById(clinicalNoteId);
  if (!note) throw new Error("Clinical Note not found.");
  if (note.status === "SIGNED") return note;

  note.status = "SIGNED";
  await note.save();

  // Audit timeline log
  await logTimelineEvent(
    note.patientId,
    note.doctorId,
    "doctor",
    "web_portal",
    "VISIT_COMPLETED",
    "Visit",
    note.visitId,
    { message: "Clinical Note Signed and finalized." }
  );

  return note;
};

/**
 * Save or Update Prescription
 */
export const savePrescription = async (doctorId, visitId, clinicalNoteId, medicines) => {
  const visit = await Visit.findById(visitId);
  if (!visit) throw new Error("Visit not found.");

  const note = await ClinicalNote.findById(clinicalNoteId);
  if (!note || note.status !== "SIGNED") {
    throw new Error("Must sign Clinical Note before saving prescription.");
  }

  const existing = await Prescription.findOne({ visitId });
  if (existing) {
    if (existing.status === "SIGNED") {
      // Create version-controlled secondary copy
      const nextVersion = existing.version + 1;
      const signaturePayload = `${doctorId}-${JSON.stringify(medicines)}-${Date.now()}`;
      const digitalSignature = crypto.createHash("sha256").update(signaturePayload).digest("hex");

      const newPresc = await Prescription.create({
        patientId: visit.patientId,
        doctorId,
        visitId,
        clinicalNoteId,
        medicines,
        status: "SIGNED",
        digitalSignature,
        version: nextVersion,
        parentPrescriptionId: existing._id
      });

      await logTimelineEvent(
        visit.patientId,
        doctorId,
        "doctor",
        "web_portal",
        "PRESCRIPTION_CREATED",
        "Prescription",
        newPresc._id,
        { version: nextVersion, message: "New prescription version signed." }
      );

      return newPresc;
    } else {
      existing.medicines = medicines;
      await existing.save();
      return existing;
    }
  }

  return await Prescription.create({
    patientId: visit.patientId,
    doctorId,
    visitId,
    clinicalNoteId,
    medicines,
    status: "DRAFT"
  });
};

/**
 * Sign Prescription (Immutability Seal)
 */
export const signPrescription = async (prescriptionId, doctorId) => {
  const presc = await Prescription.findById(prescriptionId);
  if (!presc) throw new Error("Prescription not found.");
  if (presc.status === "SIGNED") return presc;

  const signaturePayload = `${doctorId}-${JSON.stringify(presc.medicines)}-${Date.now()}`;
  const digitalSignature = crypto.createHash("sha256").update(signaturePayload).digest("hex");

  presc.status = "SIGNED";
  presc.digitalSignature = digitalSignature;
  await presc.save();

  // Create medication reminder hooks automatically
  for (const med of presc.medicines) {
    const end = new Date();
    // Default duration parsing
    const durationDays = parseInt(med.duration) || 5;
    end.setDate(end.getDate() + durationDays);

    await MedicationReminder.create({
      patientId: presc.patientId,
      visitId: presc.visitId,
      medicineName: med.genericName,
      dosage: med.dosage,
      timings: ["morning", "night"],
      startDate: new Date(),
      endDate: end
    });
  }

  await logTimelineEvent(
    presc.patientId,
    doctorId,
    "doctor",
    "web_portal",
    "PRESCRIPTION_CREATED",
    "Prescription",
    presc._id,
    { signature: digitalSignature }
  );

  return presc;
};

/**
 * Create Lab Order
 */
export const orderLabs = async (doctorId, visitId, tests, priority = "routine", sampleType = "blood", instructions = "") => {
  const visit = await Visit.findById(visitId);
  if (!visit) throw new Error("Visit not found.");

  const lab = await LabOrder.create({
    patientId: visit.patientId,
    doctorId,
    visitId,
    tests,
    priority,
    sampleType,
    instructions,
    status: "ORDERED"
  });

  await logTimelineEvent(
    visit.patientId,
    doctorId,
    "doctor",
    "web_portal",
    "LAB_ORDERED",
    "LabOrder",
    lab._id,
    { tests }
  );

  return lab;
};

/**
 * Create Follow-up schedule
 */
export const createFollowUp = async (doctorId, visitId, nextVisitDate, reason, priority = "low") => {
  const visit = await Visit.findById(visitId);
  if (!visit) throw new Error("Visit not found.");

  const follow = await FollowUp.create({
    patientId: visit.patientId,
    doctorId,
    visitId,
    nextVisit: nextVisitDate,
    reason,
    assignedDoctorId: doctorId,
    priority,
    status: "scheduled",
    statusHistory: [{ status: "scheduled", operatorId: visit.patientId }]
  });

  await logTimelineEvent(
    visit.patientId,
    doctorId,
    "doctor",
    "web_portal",
    "FOLLOW_UP",
    "FollowUp",
    follow._id,
    { nextVisitDate }
  );

  return follow;
};

/**
 * Finalize Visit & Compile Visit Summary
 */
export const finalizeConsultation = async (visitId) => {
  const visit = await Visit.findById(visitId);
  if (!visit) throw new Error("Visit not found.");

  const [vitals, note, prescription, labs, followUp] = await Promise.all([
    VitalSign.findOne({ visitId }),
    ClinicalNote.findOne({ visitId }),
    Prescription.findOne({ visitId, status: "SIGNED" }),
    LabOrder.find({ visitId }),
    FollowUp.findOne({ visitId })
  ]);

  if (!note || note.status !== "SIGNED") {
    throw new Error("Must complete and sign clinical notes before finalization.");
  }
  if (!prescription) {
    throw new Error("Must complete and sign prescription before finalization.");
  }

  // Generate mock PDF
  const pdfRes = await generatePdf("visit_summary", {
    patientId: visit.patientId,
    chiefComplaint: note.chiefComplaint,
    diagnosis: note.diagnosis,
    vitals,
    medicines: prescription.medicines
  });

  // Create lightweight VisitSummary document
  const summary = await VisitSummary.findOneAndUpdate(
    { visitId },
    {
      patientId: visit.patientId,
      doctorId: visit.doctorId,
      clinicalNoteId: note._id,
      prescriptionId: prescription._id,
      labOrderIds: labs.map(l => l._id),
      followUpId: followUp ? followUp._id : null,
      pdfUrl: pdfRes.fileUrl
    },
    { upsert: true, new: true }
  );

  // Close visit status
  visit.status = "completed";
  visit.visitOutcome = "consulted";
  await visit.save();

  // Populate patient health profile primary logs
  await PatientHealthProfile.findOneAndUpdate(
    { patientId: visit.patientId },
    {
      lastVisitId: visit._id,
      primaryDoctorId: visit.doctorId,
      primaryHospitalId: visit.hospitalId
    },
    { upsert: true }
  );

  return summary;
};
