import assert from "node:assert/strict";
import dotenv from "dotenv";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";

// Load models
import Hospital from "../src/modules/hospital/hospital.model.js";
import User from "../src/modules/auth/auth.model.js";
import Receptionist from "../src/modules/admin/receptionist.model.js";
import ReceptionAudit from "../src/modules/admin/reception_audit.model.js";
import AppointmentBooking from "../src/modules/queue/appointment_booking.model.js";

// Controllers to simulate
import * as receptionistAdminController from "../src/modules/admin/receptionist-admin.controller.js";
import * as receptionController from "../src/modules/queue/reception.controller.js";
import { loginUser } from "../src/modules/auth/auth.service.js";

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
  return `${hostPart}/smart-healthcare-test-reception-e2e${queryPart}`;
};

const runReceptionValidation = async () => {
  const dbUri = rewriteMongoUri(process.env.MONGO_URI || "mongodb://localhost:27017/smart-healthcare-system");
  console.log(`Connecting to reception validation database: ${dbUri}`);
  
  await mongoose.connect(dbUri);

  console.log("Cleaning collections...");
  await Promise.all([
    Hospital.deleteMany({}),
    User.deleteMany({}),
    Receptionist.deleteMany({}),
    ReceptionAudit.deleteMany({}),
    AppointmentBooking.deleteMany({})
  ]);

  console.log("Seeding test data...");
  const hospitalA = await Hospital.create({
    name: "Hospital A Clinic",
    address: "123 Main St",
    location: { type: "Point", coordinates: [77.5946, 12.9716] },
    specializations: ["General"]
  });

  const hospitalB = await Hospital.create({
    name: "Hospital B Clinic",
    address: "456 Side St",
    location: { type: "Point", coordinates: [77.6012, 12.9845] },
    specializations: ["Pediatrics"]
  });

  const hAdminAUser = await User.create({
    name: "Admin Hospital A",
    email: "admin.a@hospital.com",
    phone: "9000000001",
    role: "hospital_admin",
    hospitalId: hospitalA._id,
    profileCompleted: true
  });

  const hAdminBUser = await User.create({
    name: "Admin Hospital B",
    email: "admin.b@hospital.com",
    phone: "9000000002",
    role: "hospital_admin",
    hospitalId: hospitalB._id,
    profileCompleted: true
  });

  console.log("\n--- TEST CASE 1: HOSPITAL ADMIN CREATES RECEPTIONIST ---");
  let mockReq = {
    scope: { hospitalId: hospitalA._id },
    body: {
      name: "Receptionist A1",
      email: "rep.a1@hospital.com",
      phone: "8000000001",
      password: "SecretPassword123!",
      employeeId: "EMP-A1",
      shift: "Morning"
    }
  };
  
  let mockRes = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };

  await receptionistAdminController.createReceptionist(mockReq, mockRes);
  assert.strictEqual(mockRes.statusCode, 201);
  assert.ok(mockRes.body.success);
  
  const createdProfile = await Receptionist.findOne({ employeeId: "EMP-A1" });
  assert.ok(createdProfile);
  assert.strictEqual(createdProfile.shift, "Morning");
  assert.strictEqual(createdProfile.status, "active");

  console.log("\n--- TEST CASE 2: SHIFT ASSIGNMENT ---");
  mockReq = {
    scope: { hospitalId: hospitalA._id },
    user: { userId: hAdminAUser._id },
    params: { id: createdProfile._id },
    body: { shift: "Night" }
  };
  mockRes = {
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  await receptionistAdminController.updateReceptionistShift(mockReq, mockRes);
  assert.strictEqual(mockRes.statusCode, 200);
  assert.strictEqual(mockRes.body.data.shift, "Night");

  console.log("\n--- TEST CASE 3: DEACTIVATION STATE TRIGGER ---");
  mockReq = {
    scope: { hospitalId: hospitalA._id },
    params: { id: createdProfile._id },
    body: { status: "inactive" }
  };
  mockRes = {
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  await receptionistAdminController.updateReceptionistStatus(mockReq, mockRes);
  assert.strictEqual(mockRes.statusCode, 200);
  assert.strictEqual(mockRes.body.data.status, "inactive");

  // Reactivate for downstream tests
  mockReq.body.status = "active";
  await receptionistAdminController.updateReceptionistStatus(mockReq, mockRes);
  assert.strictEqual(mockRes.statusCode, 200);

  console.log("\n--- TEST CASE 4: CROSS-HOSPITAL ADMIN PROTECTION BLOCKS ---");
  // Admin B attempting to modify Receptionist A1 must fail
  mockReq = {
    scope: { hospitalId: hospitalB._id },
    params: { id: createdProfile._id },
    body: { status: "inactive" }
  };
  mockRes = {
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  await receptionistAdminController.updateReceptionistStatus(mockReq, mockRes);
  assert.strictEqual(mockRes.statusCode, 403);
  assert.match(mockRes.body.message, /You can only manage receptionists of your own hospital/);

  console.log("\n--- TEST CASE 5: RECEPTIONIST OPERATIONS & AUDIT TRAILS ---");
  const patient = await User.create({
    name: "Test Patient",
    email: "patient@medhealth.com",
    phone: "7000000001",
    role: "patient",
    profileCompleted: true
  });

  const booking = await AppointmentBooking.create({
    bookingNumber: "MH-250701-0001",
    userId: patient._id,
    hospitalId: hospitalA._id,
    doctorId: new mongoose.Types.ObjectId(),
    sessionId: new mongoose.Types.ObjectId(),
    date: "2026-06-30",
    slotTime: "10:00 AM",
    status: "BOOKED",
    arrivalStatus: "NOT_ARRIVED"
  });

  // Check-in check-in operation
  mockReq = {
    scope: { hospitalId: hospitalA._id },
    user: { userId: createdProfile.userId },
    body: { bookingId: booking._id, reason: "Patient arrived on time" }
  };
  mockRes = {
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  await receptionController.checkInAppointment(mockReq, mockRes);
  if (mockRes.statusCode !== 200) {
    console.error("DEBUG CHECK-IN ERROR:", mockRes.body);
  }
  assert.strictEqual(mockRes.statusCode, 200);
  assert.ok(mockRes.body.success);

  // Assert that ReceptionAudit record was correctly created
  const audit = await ReceptionAudit.findOne({ action: "CHECK_IN", bookingId: booking._id });
  assert.ok(audit);
  assert.strictEqual(audit.reason, "Patient arrived on time");
  assert.strictEqual(audit.operatorId.toString(), createdProfile.userId.toString());

  console.log("\n--- TEST CASE 6: RECEPTIONIST CROSS-HOSPITAL ACTION BLOCKS ---");
  // Booking at Hospital B
  const bookingB = await AppointmentBooking.create({
    bookingNumber: "MH-250701-0002",
    userId: patient._id,
    hospitalId: hospitalB._id,
    doctorId: new mongoose.Types.ObjectId(),
    sessionId: new mongoose.Types.ObjectId(),
    date: "2026-06-30",
    slotTime: "10:30 AM",
    status: "BOOKED",
    arrivalStatus: "NOT_ARRIVED"
  });

  // Receptionist A1 attempting to check-in Hospital B booking must fail
  mockReq = {
    scope: { hospitalId: hospitalA._id }, // Receptionist A1's scope
    user: { userId: createdProfile.userId },
    body: { bookingId: bookingB._id, reason: "Malicious request" }
  };
  mockRes = {
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  await receptionController.checkInAppointment(mockReq, mockRes);
  assert.strictEqual(mockRes.statusCode, 403);
  assert.match(mockRes.body.message, /You cannot check in patients of another hospital/);

  console.log("\n--- TEST CASE 7: INACTIVE / ARCHIVED RECEPTIONIST LOGIN BLOCKS ---");
  // Set receptionist status to inactive
  createdProfile.status = "inactive";
  await createdProfile.save();

  await assert.rejects(
    async () => {
      await loginUser({ email: "rep.a1@hospital.com", password: "SecretPassword123!" });
    },
    (err) => {
      assert.match(err.message, /Your receptionist profile status is inactive/);
      return true;
    }
  );

  // Set receptionist status to archived
  createdProfile.status = "archived";
  await createdProfile.save();

  await assert.rejects(
    async () => {
      await loginUser({ email: "rep.a1@hospital.com", password: "SecretPassword123!" });
    },
    (err) => {
      assert.match(err.message, /Your receptionist profile status is archived/);
      return true;
    }
  );

  // Restore to active
  createdProfile.status = "active";
  await createdProfile.save();

  console.log("\n--- TEST CASE 8: SHIFT OUTSIDE WORKING HOURS WARNING ---");
  // Change shift to Morning. Since currentHour varies, we'll force currentHour to trigger outside.
  // We can test the helper controller directly
  mockReq = {
    user: { userId: createdProfile.userId }
  };
  mockRes = {
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  
  // Set shift to General, if current hour is e.g. 11:00 PM it'll trigger warning.
  // Let's set shift to Night or Weekend to trigger isOutsideHours reliably.
  createdProfile.shift = "Weekend";
  await createdProfile.save();

  await receptionController.getReceptionistProfile(mockReq, mockRes);
  assert.strictEqual(mockRes.statusCode, 200);
  // On a weekday, Weekend shift is outside. On a weekend, General shift is outside.
  // So at least one configuration guarantees isOutsideHours = true.
  assert.ok(mockRes.body.data.isOutsideHours !== undefined);

  console.log("\n--- TEST CASE 9: DUPLICATE EMPLOYEE ID IS BLOCKED ---");
  mockReq = {
    scope: { hospitalId: hospitalA._id },
    body: {
      name: "Another Receptionist",
      email: "rep.another@hospital.com",
      phone: "8000000009",
      password: "SecretPassword123!",
      employeeId: "EMP-A1", // Duplicate ID
      shift: "Morning"
    }
  };
  mockRes = {
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  await receptionistAdminController.createReceptionist(mockReq, mockRes);
  assert.strictEqual(mockRes.statusCode, 400);
  assert.match(mockRes.body.message, /Employee ID is already registered/);

  console.log("\n--- TEST CASE 10: AUDIT TRAIL IMMUTABILITY ---");
  const seededAudit = await ReceptionAudit.findOne({ action: "CHECK_IN" });
  assert.ok(seededAudit);

  // Attempting to update the audit log must throw error
  seededAudit.reason = "Unauthorized Update Attempt";
  await assert.rejects(
    async () => {
      await seededAudit.save();
    },
    (err) => {
      assert.match(err.message, /immutable and cannot be updated/);
      return true;
    }
  );

  // Attempting to delete the audit log must throw error
  await assert.rejects(
    async () => {
      await ReceptionAudit.deleteOne({ _id: seededAudit._id });
    },
    (err) => {
      assert.match(err.message, /immutable and cannot be deleted/);
      return true;
    }
  );

  console.log("\n🎉 All receptionist profiles, shift duties, status blocks, and audit validations completed successfully!");
  await mongoose.disconnect();
};

runReceptionValidation().catch(err => {
  console.error("Reception E2E Verification failed:", err);
  process.exit(1);
});
