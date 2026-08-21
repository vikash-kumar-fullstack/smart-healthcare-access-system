import mongoose from "mongoose";
import dotenv from "dotenv";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
dotenv.config();

// Load models
import Hospital from "../src/modules/hospital/hospital.model.js";
import Doctor from "../src/modules/doctor/doctor.model.js";
import Receptionist from "../src/modules/admin/receptionist.model.js";
import User from "../src/modules/auth/auth.model.js";
import AppointmentBooking from "../src/modules/queue/appointment_booking.model.js";
import Visit from "../src/modules/visit/visit.model.js";
import Prescription from "../src/modules/medical-records/prescription.model.js"; // Wait, where is prescription located? Let's check imports in demo-seed
import LabOrder from "../src/modules/medical-records/lab_order.model.js";
import Report from "../src/modules/medical-records/report.model.js";

const verifyIntegrity = async () => {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log("Connected to Database for Integrity verification.");

  let failuresCount = 0;

  console.log("\n1. Verifying Doctors hospital relationships...");
  const doctors = await Doctor.find({});
  for (const doc of doctors) {
    if (!doc.hospitalId) {
      console.error(`- FAIL: Doctor ${doc.name} (${doc._id}) is not assigned to any hospital.`);
      failuresCount++;
    } else {
      const hosp = await Hospital.findById(doc.hospitalId);
      if (!hosp) {
        console.error(`- FAIL: Doctor ${doc.name} points to non-existent hospital ${doc.hospitalId}.`);
        failuresCount++;
      }
    }
  }

  console.log("\n2. Verifying Receptionist hospital relationships...");
  const receptionists = await Receptionist.find({});
  for (const rep of receptionists) {
    if (!rep.hospitalId) {
      console.error(`- FAIL: Receptionist ${rep.employeeId} is not assigned to any hospital.`);
      failuresCount++;
    } else {
      const hosp = await Hospital.findById(rep.hospitalId);
      if (!hosp) {
        console.error(`- FAIL: Receptionist ${rep.employeeId} points to non-existent hospital ${rep.hospitalId}.`);
        failuresCount++;
      }
    }
  }

  console.log("\n3. Verifying unique Employee IDs...");
  const employeeIds = receptionists.map(r => r.employeeId);
  const uniqueEmployeeIds = new Set(employeeIds);
  if (employeeIds.length !== uniqueEmployeeIds.size) {
    console.error(`- FAIL: Duplicate employee IDs detected: ${employeeIds}`);
    failuresCount++;
  }

  console.log("\n4. Verifying Appointment properties...");
  const bookings = await AppointmentBooking.find({});
  for (const booking of bookings) {
    if (!booking.userId || !booking.doctorId || !booking.sessionId) {
      console.error(`- FAIL: Booking ${booking.bookingNumber} is missing required fields.`);
      failuresCount++;
    }
  }

  console.log("\n5. Verifying duplicate booking numbers...");
  const bookingNums = bookings.map(b => b.bookingNumber);
  const uniqueBookingNums = new Set(bookingNums);
  if (bookingNums.length !== uniqueBookingNums.size) {
    console.error(`- FAIL: Duplicate booking numbers detected.`);
    failuresCount++;
  }

  console.log("\n6. Verifying E2E Clinical Aggregation bindings...");
  const visits = await Visit.find({});
  for (const visit of visits) {
    if (!visit.appointmentId) {
      console.error(`- FAIL: Visit ${visit.publicId} is missing Appointment ID.`);
      failuresCount++;
    }
  }

  console.log(`\nIntegrity Scan Completed. Total Failures: ${failuresCount}`);

  await mongoose.disconnect();

  if (failuresCount > 0) {
    process.exit(1);
  } else {
    console.log("🎉 DATABASE INTEGRITY AND RELATIONSHIPS ARE PERFECT!");
    process.exit(0);
  }
};

verifyIntegrity().catch(err => {
  console.error("Integrity Verification script crashed:", err);
  process.exit(1);
});
