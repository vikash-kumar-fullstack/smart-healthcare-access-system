import assert from "node:assert/strict";
import dotenv from "dotenv";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";

// Load models
import Hospital from "../src/modules/hospital/hospital.model.js";
import HospitalSchedulingPolicy from "../src/modules/hospital/hospital_scheduling_policy.model.js";
import Doctor from "../src/modules/doctor/doctor.model.js";
import User from "../src/modules/auth/auth.model.js";
import Visit from "../src/modules/visit/visit.model.js";
import Queue from "../src/modules/queue/queue.model.js";
import QueueSession from "../src/modules/queue/queueSession.model.js";

// Clinical modules
import ClinicalNote from "../src/modules/medical-records/clinical_note.model.js";
import VitalSign from "../src/modules/medical-records/vital_sign.model.js";
import Prescription from "../src/modules/medical-records/prescription.model.js";
import LabOrder from "../src/modules/medical-records/lab_order.model.js";
import Report from "../src/modules/medical-records/report.model.js";
import FollowUp from "../src/modules/medical-records/follow_up.model.js";
import FamilyMember from "../src/modules/medical-records/family_member.model.js";
import PatientConsent from "../src/modules/medical-records/patient_consent.model.js";
import PatientTimelineEvent from "../src/modules/medical-records/patient_timeline_event.model.js";
import VisitSummary from "../src/modules/medical-records/visit_summary.model.js";
import MedicationReminder from "../src/modules/medical-records/medication_reminder.model.js";

// Services
import * as doctorService from "../src/modules/medical-records/doctor_workspace.service.js";
import * as patientService from "../src/modules/medical-records/patient_portal.service.js";
import * as consentService from "../src/modules/medical-records/consent.service.js";
import * as authService from "../src/modules/auth/auth.service.js";
import { getTodayIST } from "../src/modules/search/utils.js";

dotenv.config();

const rewriteMongoUri = (uri) => {
  if (!uri) return uri;
  const parts = uri.split("?");
  let hostPart = parts[0];
  const queryPart = parts[1] ? `?${parts[1]}` : "";
  if (hostPart.endsWith("/")) {
    hostPart = hostPart.slice(0, -1);
  }
  const protocolEndIdx = hostPart.indexOf("://");
  const pathStartIdx = hostPart.indexOf("/", protocolEndIdx + 3);
  if (pathStartIdx !== -1) {
    hostPart = hostPart.substring(0, pathStartIdx);
  }
  return `${hostPart}/smart-healthcare-test-system-e2e${queryPart}`;
};

const runE2EValidation = async () => {
  const testMongoUri = rewriteMongoUri(process.env.MONGO_URI);
  console.log("Connecting to system validation database...");
  await mongoose.connect(testMongoUri);

  console.log("Purging legacy telemetry collections...");
  await Promise.all(
    mongoose.modelNames().map(modelName => mongoose.model(modelName).deleteMany({}))
  );

  console.log("--- START SYSTEM LIFE CYCLE SEEDING ---");

  // Seeding 5 Hospitals
  const hospitals = [];
  for (let i = 1; i <= 5; i++) {
    const hosp = await Hospital.create({
      name: `City Hospital Center ${i}`,
      address: `Patna Sector ${i}`,
      location: { type: "Point", coordinates: [85.1 + i * 0.01, 25.5 + i * 0.01] },
      specializations: ["Cardiology", "Pediatrics"]
    });
    hospitals.push(hosp);
    // Policy
    await HospitalSchedulingPolicy.create({
      hospitalId: hosp._id,
      bookingWindowDays: 14,
      allowEmergencyWalkIn: true,
      walkInCapacity: 10
    });
  }

  // Seeding Super Admin & 10 Admins
  await User.create({
    name: "Super Admin",
    email: "superadmin@medhospi.com",
    phone: "1111111111",
    role: "admin",
    password: "Password123!"
  });

  const admins = [];
  for (let i = 1; i <= 10; i++) {
    const adm = await User.create({
      name: `Hospital Admin ${i}`,
      email: `admin${i}@medhospi.com`,
      phone: `990000000${i}`,
      role: "admin",
      password: "Password123!"
    });
    admins.push(adm);
  }

  // Seeding 50 Doctors
  const doctors = [];
  for (let i = 1; i <= 50; i++) {
    const doc = await Doctor.create({
      userId: new mongoose.Types.ObjectId(),
      name: `Dr. Practitioner ${i}`,
      specialization: i % 2 === 0 ? "Cardiology" : "Pediatrics",
      hospitalId: hospitals[i % 5]._id,
      status: "verified",
      defaultQueueLimit: 30,
      avgConsultationTime: 12
    });
    doctors.push(doc);
  }

  // Seeding 500 Patients
  const patients = [];
  for (let i = 1; i <= 500; i++) {
    const pat = await User.create({
      name: `Citizen Patient ${i}`,
      email: `patient${i}@medhealth.com`,
      phone: `9800000${String(i).padStart(3, "0")}`,
      role: "patient",
      password: "Password123!"
    });
    patients.push(pat);
  }

  console.log(`Seeding complete: ${hospitals.length} hospitals, ${doctors.length} doctors, ${patients.length} patients created.`);

  console.log("\n--- TEST CASE 1: CLINICAL WORKFLOW CYCLE ---");
  {
    const targetDoctor = doctors[0];
    const targetPatient = patients[0];
    const todayStr = getTodayIST();

    // Create a mock visit & session
    const session = await QueueSession.create({
      doctorId: targetDoctor._id,
      date: todayStr,
      sessionState: "ACTIVE",
      scheduleSnapshot: {
        startTime: "09:00",
        endTime: "13:00",
        queueLimit: 30,
        doctorName: targetDoctor.name,
        hospitalName: "City Hospital Center 1",
        averageConsultationTime: 12,
        scheduleVersion: 1
      }
    });

    const queue = await Queue.create({
      userId: targetPatient._id,
      doctorId: targetDoctor._id,
      sessionId: session._id,
      queueNumber: 1,
      status: "waiting",
      isActive: true
    });

    const visit = await Visit.create({
      publicId: `VST-${Date.now()}-0001`,
      patientId: targetPatient._id,
      doctorId: targetDoctor._id,
      hospitalId: targetDoctor.hospitalId,
      queueId: queue._id,
      sessionId: session._id,
      bookingDate: todayStr,
      status: "in_progress",
      doctorSnapshot: { name: targetDoctor.name, specialization: targetDoctor.specialization, hospitalName: "City Hospital Center 1" },
      patientSnapshot: { name: targetPatient.name, phone: targetPatient.phone }
    });

    // 1. Record Vitals
    const bpData = { systolic: 120, diastolic: 80 };
    const vitals = await doctorService.recordVitals(targetDoctor._id, visit._id, {
      bp: bpData,
      pulse: 72,
      height: 175,
      weight: 70,
      temperature: 98.6,
      respRate: 16,
      spo2: 99
    });
    assert.strictEqual(vitals.pulse, 72);

    // 2. Save Clinical Note Draft
    const note = await doctorService.saveClinicalNoteDraft(targetDoctor._id, visit._id, {
      chiefComplaint: "Fever and headaches for 3 days",
      presentIllness: "Acute onset",
      diagnosis: "Mild influenza infection",
      advice: "Take rest and keep hydrated"
    });
    assert.strictEqual(note.status, "DRAFT");

    // 3. Sign Clinical Note (Locks it)
    const signedNote = await doctorService.signClinicalNote(note._id);
    assert.strictEqual(signedNote.status, "SIGNED");

    // Attempting to modify signed notes must fail
    await assert.rejects(
      doctorService.saveClinicalNoteDraft(targetDoctor._id, visit._id, { chiefComplaint: "Change", diagnosis: "Diff" }),
      /Clinical Note is signed and immutable/
    );

    // 4. Save Prescription
    const medicines = [
      {
        genericName: "Paracetamol",
        brandName: "Calpol",
        dosage: "650mg",
        frequency: "1-0-1",
        duration: "5 days",
        foodTiming: "after_food",
        quantity: 10,
        instructions: "Dissolve in warm water"
      }
    ];
    const presc = await doctorService.savePrescription(targetDoctor._id, visit._id, signedNote._id, medicines);
    assert.strictEqual(presc.status, "DRAFT");

    // 5. Sign Prescription (Marks Signed + generates reminders)
    const signedPresc = await doctorService.signPrescription(presc._id, targetDoctor._id);
    assert.strictEqual(signedPresc.status, "SIGNED");
    assert.ok(signedPresc.digitalSignature);

    // Check Medication Reminder was created automatically
    const reminder = await MedicationReminder.findOne({ patientId: targetPatient._id });
    assert.ok(reminder);
    assert.strictEqual(reminder.medicineName, "Paracetamol");

    // 6. Order Investigation Labs
    const lab = await doctorService.orderLabs(targetDoctor._id, visit._id, ["CBC", "Blood Sugar"], "urgent", "blood");
    assert.strictEqual(lab.status, "ORDERED");
    assert.strictEqual(lab.priority, "urgent");

    // 7. Schedule Follow-up
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const follow = await doctorService.createFollowUp(targetDoctor._id, visit._id, nextWeek, "Review fever details");
    assert.strictEqual(follow.status, "scheduled");

    // 8. Finalize consultation (compiles summary and completes visit)
    const summary = await doctorService.finalizeConsultation(visit._id);
    assert.ok(summary);
    assert.strictEqual(summary.pdfUrl.substring(0, 24), "/uploads/documents/visit");

    const closedVisit = await Visit.findById(visit._id);
    assert.strictEqual(closedVisit.status, "completed");

    // Verify chronological timelines update log
    const events = await PatientTimelineEvent.find({ patientId: targetPatient._id }).sort({ timestamp: 1 });
    assert.ok(events.length > 0);
  }

  console.log("\n--- TEST CASE 2: FAMILY PROFILE MANAGEMENT & ACCESS WORKFLOW ---");
  {
    const primary = patients[0];
    const dependent = patients[1];

    // Link dependent child
    const link = await patientService.addFamilyLink(primary._id, dependent.phone, "child");
    assert.strictEqual(link.relationship, "child");

    const members = await patientService.getFamilyMembers(primary._id);
    assert.strictEqual(members.length, 1);
    assert.strictEqual(members[0].memberUserId.name, dependent.name);
  }

  console.log("\n--- TEST CASE 3: PATIENT CONSENT GRANT & ACCESS RULES ---");
  {
    const patient = patients[1];
    const outsiderDoc = doctors[2];

    // Access summary before consent -> must throw error
    await assert.rejects(
      patientService.getPatientPortalSummary(patient._id, outsiderDoc._id),
      /Access denied/
    );

    // Grant access consent to outsiderDoc
    const grant = await consentService.grantConsent(patient._id, outsiderDoc._id, "doctor", ["view_records"], 2);
    assert.strictEqual(grant.status, "granted");

    // Access summary after consent -> succeeds
    const summary = await patientService.getPatientPortalSummary(patient._id, outsiderDoc._id);
    assert.ok(summary);

    // Revoke consent
    await consentService.revokeConsent(patient._id, outsiderDoc._id);

    // Access again after revoking -> blocked
    await assert.rejects(
      patientService.getPatientPortalSummary(patient._id, outsiderDoc._id),
      /Access denied/
    );
  }

  console.log("\n--- TEST CASE 4: SOCIAL OAUTH SIGNUP, LOGIN, LINKING & COMPLETION ---");
  {
    const targetEmail = "nonexistent.doctor@gmail.com";

    // 1. Doctor social login without pre-provisioned account must fail
    await assert.rejects(
      authService.socialLoginUser({
        email: targetEmail,
        name: "Dr. Mock",
        provider: "google",
        providerId: "google_12345",
        registerIfNew: false
      }),
      /Account does not exist. Please contact your hospital administrator./
    );

    // 2. Patient social signup creates patient account on the fly
    const res = await authService.socialLoginUser({
      email: "new.patient@gmail.com",
      name: "Patient New",
      provider: "google",
      providerId: "google_p_54321",
      registerIfNew: true
    });
    assert.strictEqual(res.role, "patient");
    assert.strictEqual(res.profileCompleted, false);

    // 3. Complete profile updates details and sets completed true
    const completedUser = await authService.completeUserProfile(res.user._id, {
      phone: "9123456789",
      gender: "female",
      dob: "1998-05-15"
    });
    assert.strictEqual(completedUser.profileCompleted, true);
    assert.strictEqual(completedUser.gender, "female");

    // 4. Provider Linking & Unlinking checks
    const linkedUser = await authService.linkSocialProvider(res.user._id, {
      provider: "linkedin",
      providerId: "linkedin_p_67890"
    });
    assert.strictEqual(linkedUser.providers.length, 2);

    const unlinkedUser = await authService.unlinkSocialProvider(res.user._id, "google");
    assert.strictEqual(unlinkedUser.providers.length, 1);
    assert.strictEqual(unlinkedUser.providers[0].type, "linkedin");

    // Unlinking last active provider must fail
    await assert.rejects(
      authService.unlinkSocialProvider(res.user._id, "linkedin"),
      /at least one authentication method must remain active/
    );
  }

  console.log("\n🎉 All longitudinal EMR, family linking, signature locks, consent, and social OAuth validations completed successfully!");
  await mongoose.disconnect();
};

runE2EValidation().catch(err => {
  console.error("System E2E Verification failed:", err);
  process.exit(1);
});
