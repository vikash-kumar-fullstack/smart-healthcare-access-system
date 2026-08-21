import mongoose from "mongoose";
import dotenv from "dotenv";

process.env.NODE_ENV = "test";
dotenv.config();

// Load models
import User from "../src/modules/auth/auth.model.js";
import Doctor from "../src/modules/doctor/doctor.model.js";
import Hospital from "../src/modules/hospital/hospital.model.js";
import QueueSession from "../src/modules/queue/queueSession.model.js";
import Visit from "../src/modules/visit/visit.model.js";
import AppointmentBooking from "../src/modules/queue/appointment_booking.model.js";
import Prescription from "../src/modules/medical-records/prescription.model.js";
import LabOrder from "../src/modules/medical-records/lab_order.model.js";
import Report from "../src/modules/medical-records/report.model.js";
import Receptionist from "../src/modules/admin/receptionist.model.js";
import FamilyRelationship from "../src/modules/user/family_relationship.model.js";
import SecurityIncident from "../src/modules/admin/security_incident.model.js";
import FollowUp from "../src/modules/medical-records/follow_up.model.js";

const verify = async () => {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log("Connected to Database for Demo Certification checks.");

  const hospitalsCount = await Hospital.countDocuments();
  const doctorsCount = await Doctor.countDocuments();
  const receptionistsCount = await Receptionist.countDocuments();
  const patientsCount = await User.countDocuments({ role: "patient" });
  
  const bookingsCount = await AppointmentBooking.countDocuments();
  const completedVisitsCount = await Visit.countDocuments({ status: "completed" });
  const prescriptionsCount = await Prescription.countDocuments();
  const labOrdersCount = await LabOrder.countDocuments();
  const reportsCount = await Report.countDocuments();
  const familyCount = await FamilyRelationship.countDocuments();
  const followUpsCount = await FollowUp.countDocuments();
  
  const activeSessionsCount = await QueueSession.countDocuments({ sessionStatus: "active" });
  const pausedSessionsCount = await QueueSession.countDocuments({ sessionStatus: "paused" });
  const incidentsCount = await SecurityIncident.countDocuments();

  console.log("\n==========================================");
  console.log("📊 DEMO DATA CERTIFICATION AUDIT REPORT");
  console.log("==========================================");
  console.log(`- Hospitals: ${hospitalsCount} / 10`);
  console.log(`- Doctors: ${doctorsCount} / 50`);
  console.log(`- Receptionists: ${receptionistsCount} / 20`);
  console.log(`- Patients: ${patientsCount} / 500`);
  console.log(`- Bookings: ${bookingsCount} / 5000`);
  console.log(`- Completed Visits: ${completedVisitsCount} / 1000`);
  console.log(`- Prescriptions: ${prescriptionsCount} / 1500`);
  console.log(`- Lab Orders: ${labOrdersCount} / 600`);
  console.log(`- Reports: ${reportsCount} / 400`);
  console.log(`- Family Relationships: ${familyCount} / 150`);
  console.log(`- Follow-ups: ${followUpsCount} / 300`);
  console.log(`- Active Queue Sessions: ${activeSessionsCount} (Target: >= 40)`);
  console.log(`- Paused Sessions: ${pausedSessionsCount} (Target: 5)`);
  console.log(`- Security Incidents: ${incidentsCount} / 3`);
  console.log("==========================================\n");

  let failed = false;

  const assertCount = (label, actual, expected) => {
    if (actual !== expected) {
      console.error(`❌ Mismatch in ${label}: Got ${actual}, expected ${expected}`);
      failed = true;
    } else {
      console.log(`✓ ${label} count verified: ${actual}`);
    }
  };

  assertCount("Hospitals", hospitalsCount, 10);
  assertCount("Doctors", doctorsCount, 50);
  assertCount("Receptionists", receptionistsCount, 20);
  assertCount("Patients", patientsCount, 500);
  assertCount("Bookings", bookingsCount, 5000);
  assertCount("Completed Visits", completedVisitsCount, 1000);
  assertCount("Prescriptions", prescriptionsCount, 1500);
  assertCount("Lab Orders", labOrdersCount, 600);
  assertCount("Reports", reportsCount, 400);
  assertCount("Family Relationships", familyCount, 150);
  assertCount("Follow-ups", followUpsCount, 300);
  assertCount("Security Incidents", incidentsCount, 3);

  if (activeSessionsCount < 40) {
    console.error(`❌ Active Queue Sessions count too low: Got ${activeSessionsCount}, expected >= 40`);
    failed = true;
  } else {
    console.log(`✓ Active Queue Sessions count verified: ${activeSessionsCount}`);
  }

  if (pausedSessionsCount < 5) {
    console.error(`❌ Paused Queue Sessions count too low: Got ${pausedSessionsCount}, expected >= 5`);
    failed = true;
  } else {
    console.log(`✓ Paused Queue Sessions count verified: ${pausedSessionsCount}`);
  }

  await mongoose.disconnect();

  if (failed) {
    console.error("\n❌ DEMO DATA CERTIFICATION AUDIT FAILED!");
    process.exit(1);
  } else {
    console.log("\n🎉 DEMO DATA CERTIFICATION AUDIT PASSED!");
    process.exit(0);
  }
};

verify().catch(async err => {
  console.error("❌ E2E Certification check failed with error:", err);
  await mongoose.disconnect();
  process.exit(1);
});
