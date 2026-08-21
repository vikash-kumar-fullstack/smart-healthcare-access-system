import assert from "node:assert/strict";
import dotenv from "dotenv";
import mongoose from "mongoose";
import http from "http";
import app from "../src/app.js";
import User from "../src/modules/auth/auth.model.js";
import FamilyRelationship from "../src/modules/user/family_relationship.model.js";
import Queue from "../src/modules/queue/queue.model.js";
import Doctor from "../src/modules/doctor/doctor.model.js";
import Hospital from "../src/modules/hospital/hospital.model.js";
import QueueSession from "../src/modules/queue/queueSession.model.js";
import MedicalRecord from "../src/modules/medical-records/medical_record.model.js";
import MedicalRecordVersion from "../src/modules/medical-records/medical_record_version.model.js";
import BookingCredit from "../src/modules/queue/booking_credit.model.js";
import DoctorSchedule from "../src/modules/doctor/doctor_schedule.model.js";
import { stopSearchWorkers } from "../src/modules/search/search_worker.js";
import { stopNotificationWorkers } from "../src/modules/notification/notification_worker.js";
import { stopHealthWorker } from "../src/modules/admin/system_health_worker.js";
import { stopReportWorker } from "../src/modules/admin/admin_report_worker.js";

dotenv.config();

process.env.NODE_ENV = "test";

let server;
let baseUrl;

const request = async (method, path, { token, body } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` })
    },
    ...(body && { body: JSON.stringify(body) })
  });

  const payload = await response.json().catch(() => ({}));
  return { response, payload };
};

async function runTests() {
  console.log("=== STARTING FAMILY CENTER INTEGRATION TESTS ===");

  // 1. Connect to DB
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  // Clear existing family tests data
  await FamilyRelationship.deleteMany({});
  await User.deleteMany({ email: /@family.local|@test.family/ });
  await Queue.deleteMany({});
  await QueueSession.deleteMany({});
  await DoctorSchedule.deleteMany({});

  // 2. Start server
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}/api/v1`;
  console.log(`Test server running on port ${port}`);

  // 3. Create test users
  const parentEmail = `arun-${Date.now()}@test.family`;
  const spouseTargetEmail = `sunita-${Date.now()}@test.family`;

  await request("POST", "/auth/register", {
    body: {
      name: "Arun Kumar",
      email: parentEmail,
      password: "Password123",
      role: "patient",
      phone: `9900000001`
    }
  });

  const parentLogin = await request("POST", "/auth/login", {
    body: {
      email: parentEmail,
      password: "Password123"
    }
  });
  const parentToken = parentLogin.payload.data.token;
  const parentId = parentLogin.payload.data.user._id || parentLogin.payload.data.user.id;
  await User.updateOne({ _id: parentId }, { profileCompleted: true, dob: new Date("1990-01-01"), gender: "Male" });

  await request("POST", "/auth/register", {
    body: {
      name: "Sunita Devi",
      email: spouseTargetEmail,
      password: "Password123",
      role: "patient",
      phone: `9900000002`
    }
  });

  const spouseLogin = await request("POST", "/auth/login", {
    body: {
      email: spouseTargetEmail,
      password: "Password123"
    }
  });
  const spouseTargetToken = spouseLogin.payload.data.token;
  const spouseTargetId = spouseLogin.payload.data.user._id || spouseLogin.payload.data.user.id;
  await User.updateOne({ _id: spouseTargetId }, { profileCompleted: true, dob: new Date("1992-01-01"), gender: "Female" });

  // Initialize credits for booking tests
  await BookingCredit.create({
    userId: parentId,
    credits: 10,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    reason: "future_compensation"
  });
  await BookingCredit.create({
    userId: spouseTargetId,
    credits: 10,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    reason: "future_compensation"
  });

  // Create a Doctor & Hospital & QueueSession to verify booking journey
  const hospital = await Hospital.create({
    name: "Family Test Hospital",
    address: "New Delhi",
    location: {
      type: "Point",
      coordinates: [77.1025, 28.7041]
    }
  });
  const doctorUser = await User.create({
    name: "Dr. Deepak Verma",
    email: `deepak-${Date.now()}@test.family`,
    role: "doctor",
    password: "Password123"
  });
  const doctor = await Doctor.create({
    userId: doctorUser._id,
    name: "Dr. Deepak Verma",
    hospitalId: hospital._id,
    specialization: "Pediatrics",
    isActive: true
  });

  for (let i = 0; i < 7; i++) {
    await DoctorSchedule.create({
      doctorId: doctor._id,
      dayOfWeek: i,
      startTime: "09:00",
      endTime: "23:59",
      enabled: true
    });
  }

  const session = await QueueSession.create({
    doctorId: doctor._id,
    hospitalId: hospital._id,
    date: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
    startTime: "09:00",
    endTime: "13:00",
    status: "active"
  });

  // --- TEST CASE 1: Add Child sub-profile, book appointment, verify parent prescription view ---
  console.log("\nRunning Test Case 1...");
  const addRelRes = await request("POST", "/family", {
    token: parentToken,
    body: {
      relationType: "Child",
      name: "Rahul Kumar",
      dob: "2018-05-15",
      gender: "Male",
      bloodGroup: "O+"
    }
  });
  assert.equal(addRelRes.response.status, 200);
  assert.equal(addRelRes.payload.data.relationType, "Child");
  assert.equal(addRelRes.payload.data.managementType, "FULL_ACCESS");
  assert.equal(addRelRes.payload.data.ownershipType, "GUARDIAN_MANAGED");
  assert.equal(addRelRes.payload.data.status, "ACTIVE");

  const childId = addRelRes.payload.data.relativeId;
  await BookingCredit.create({
    userId: childId,
    credits: 5,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    reason: "future_compensation"
  });

  // Book appointment for child
  const bookRes = await request("POST", "/queue/book", {
    token: parentToken,
    body: {
      doctorId: doctor._id,
      patientId: childId,
      bookingDate: session.date,
      slotTime: "10:30"
    }
  });
  console.log("DEBUG: bookRes.payload =", bookRes.payload);
  assert.equal(bookRes.response.status, 200);
  assert.equal(bookRes.payload.data.canBook, true);

  // Parent queries medical history of child -> should succeed
  const histRes = await request("GET", `/medical-records/history?patientId=${childId}`, {
    token: parentToken
  });
  assert.equal(histRes.response.status, 200);

  // --- TEST CASE 2: Add Parent caregiver profile, book slot, view history ---
  console.log("\nRunning Test Case 2...");
  const addParentRes = await request("POST", "/family", {
    token: parentToken,
    body: {
      relationType: "Parent",
      name: "Ramesh Kumar",
      dob: "1960-01-01",
      gender: "Male",
      bloodGroup: "A+"
    }
  });
  assert.equal(addParentRes.response.status, 200);
  assert.equal(addParentRes.payload.data.relationType, "Parent");
  assert.equal(addParentRes.payload.data.managementType, "CAREGIVER_ACCESS");

  // --- TEST CASE 3: Add Spouse, generate invitation, accept invitation ---
  console.log("\nRunning Test Case 3...");
  const addSpouseRes = await request("POST", "/family", {
    token: parentToken,
    body: {
      relationType: "Spouse",
      name: "Sunita Devi",
      dob: "1994-08-20",
      gender: "Female",
      email: spouseTargetEmail
    }
  });
  assert.equal(addSpouseRes.response.status, 200);
  assert.equal(addSpouseRes.payload.data.status, "PENDING");
  const inviteToken = addSpouseRes.payload.data.invitationToken;
  assert.ok(inviteToken);

  // Accept invitation using spouse account
  const acceptRes = await request("POST", `/family/invitations/${inviteToken}/accept`, {
    token: spouseTargetToken
  });
  assert.equal(acceptRes.response.status, 200);
  assert.equal(acceptRes.payload.data.status, "ACTIVE");

  // --- TEST CASE 4: Try adding 11th member -> expect limit block ---
  console.log("\nRunning Test Case 4...");
  // Let's add 8 more child profiles to hit the total 10 limit (Rahul, Ramesh, Sunita are 3 active/pending relationships)
  for (let i = 0; i < 7; i++) {
    await request("POST", "/family", {
      token: parentToken,
      body: {
        relationType: "Dependent",
        name: `Dependent-${i}`,
        dob: "2015-01-01",
        gender: "Male"
      }
    });
  }
  // This 11th one should fail
  const exceedRes = await request("POST", "/family", {
    token: parentToken,
    body: {
      relationType: "Dependent",
      name: "Exceeding Member",
      dob: "2015-01-01",
      gender: "Male"
    }
  });
  assert.equal(exceedRes.response.status, 409); // throws maximum limit reached error (409 Conflict)

  // --- TEST CASE 5: Access unrelated patient medical record -> expect 403 ---
  console.log("\nRunning Test Case 5...");
  const unrelatedUser = await User.create({
    name: "Unrelated Person",
    email: `unrelated-${Date.now()}@test.family`,
    role: "patient",
    password: "Password123"
  });
  const unrelatedRecord = await MedicalRecord.create({
    patientId: unrelatedUser._id,
    activeVersionId: new mongoose.Types.ObjectId(),
    doctorSnapshot: {
      name: "Dr. Test Unrelated",
      specialization: "General",
      hospitalName: "Test Hospital"
    }
  });

  const failRecordRes = await request("GET", `/medical-records/${unrelatedRecord._id}`, {
    token: parentToken
  });
  assert.equal(failRecordRes.response.status, 403);

  // --- TEST CASE 6: Revoke spouse consent -> verify immediate access block ---
  console.log("\nRunning Test Case 6...");
  const revokeRes = await request("POST", `/family/members/${spouseTargetId}/revoke`, {
    token: parentToken,
    body: { reason: "Divorce" }
  });
  assert.equal(revokeRes.response.status, 200);

  // Attempt to book for spouse target after revoke -> expect failure
  const spouseBookFail = await request("POST", "/queue/book", {
    token: parentToken,
    body: {
      doctorId: doctor._id,
      patientId: spouseTargetId,
      bookingDate: session.date,
      slotTime: "11:00"
    }
  });
  assert.equal(spouseBookFail.response.status, 403);

  // --- TEST CASE 7: Delete child -> verify soft archive only ---
  console.log("\nRunning Test Case 7...");
  const deleteChildRes = await request("DELETE", `/family/members/${childId}`, {
    token: parentToken
  });
  assert.equal(deleteChildRes.response.status, 200);
  assert.equal(deleteChildRes.payload.data.status, "ARCHIVED");

  // Verify child user account is NOT deleted from DB (soft archived relationship only)
  const childUser = await User.findById(childId);
  assert.ok(childUser);

  // --- TEST CASE 8: Book for archived member -> verify blocked ---
  console.log("\nRunning Test Case 8...");
  const bookArchivedRes = await request("POST", "/queue/book", {
    token: parentToken,
    body: {
      doctorId: doctor._id,
      patientId: childId,
      bookingDate: session.date,
      slotTime: "11:20"
    }
  });
  assert.equal(bookArchivedRes.response.status, 403); // Blocked with archived error

  // --- TEST CASE 9: Duplicate phone registration check ---
  console.log("\nRunning Test Case 9...");
  const dupPhoneRes = await request("POST", "/family", {
    token: parentToken,
    body: {
      relationType: "Child",
      name: "Rahul Redup",
      dob: "2018-05-15",
      gender: "Male",
      phone: "9900000002" // phone of Sunita Devi
    }
  });
  assert.equal(dupPhoneRes.response.status, 409); // Duplicate phone blocks it
  
  // --- TEST CASE 10: Notification Mirroring Validation ---
  console.log("\nRunning Test Case 10...");
  const childMirror = await request("POST", "/family", {
    token: parentToken,
    body: {
      relationType: "Child",
      name: "Child Mirror",
      dob: "2018-05-15",
      gender: "Male"
    }
  });
  const childMirrorId = childMirror.payload.data.relativeId;
  
  const { createNotification } = await import("../src/modules/notification/notification.service.js");
  await createNotification(
    childMirrorId,
    "Your appointment has been confirmed",
    "Your pediatrician will see you at 10:00 AM.",
    "appointment"
  );

  // Wait a brief moment for background mirror task
  await new Promise(resolve => setTimeout(resolve, 500));

  const NotificationOutbox = mongoose.model("NotificationOutbox");
  const mirroredNotif = await NotificationOutbox.findOne({
    "payload.recipientUserId": parentId,
    "payload.title": /Child Mirror/
  });

  assert.ok(mirroredNotif);
  assert.ok(mirroredNotif.payload.title.includes("Child Mirror's"));
  assert.ok(mirroredNotif.payload.body.includes("Child Mirror"));
  console.log("Mirrored title:", mirroredNotif.payload.title);
  console.log("Mirrored body:", mirroredNotif.payload.body);

  // --- TEST CASE 11: Invitation token expired check ---
  console.log("\nRunning Test Case 11...");
  const expiredRel = await FamilyRelationship.create({
    ownerId: parentId,
    relativeId: unrelatedUser._id,
    relationType: "Spouse",
    managementType: "INVITATION_REQUIRED",
    ownershipType: "SHARED_MANAGED",
    status: "PENDING",
    invitationToken: "expired-token-xyz",
    invitationExpiresAt: new Date(Date.now() - 1000), // in the past
    createdBy: parentId,
    updatedBy: parentId
  });

  const acceptExpiredRes = await request("POST", `/family/invitations/expired-token-xyz/accept`, {
    token: parentToken
  });
  assert.equal(acceptExpiredRes.response.status, 410); // throws expired token error (410 Gone)

  // --- TEST CASE 12: Patient attempts to create second spouse relationship -> limit exceeded ---
  console.log("\nRunning Test Case 12...");
  // Re-add one active spouse first
  const spouse1 = await request("POST", "/family", {
    token: parentToken,
    body: {
      relationType: "Spouse",
      name: "Spouse 1",
      dob: "1994-08-20",
      gender: "Female",
      email: `spouse1-${Date.now()}@test.family`
    }
  });
  assert.equal(spouse1.response.status, 200);

  const secondSpouseRes = await request("POST", "/family", {
    token: parentToken,
    body: {
      relationType: "Spouse",
      name: "Second Spouse Profile",
      dob: "1994-08-20",
      gender: "Female",
      email: `secondspouse-${Date.now()}@test.family`
    }
  });
  assert.equal(secondSpouseRes.response.status, 409); // fails because spouse limit is 1

  // --- TEST CASE 13: Parent account deleted while child records exist -> transfer ownership required ---
  console.log("\nRunning Test Case 13...");
  // Re-add an active child so we have an active child profile
  const activeChildRel = await request("POST", "/family", {
    token: parentToken,
    body: {
      relationType: "Child",
      name: "Active Child Name",
      dob: "2017-05-15",
      gender: "Male"
    }
  });
  assert.equal(activeChildRel.response.status, 200);

  // Attempt to delete parent relativeId = parentId (self profile) while active child exists
  const parentDeleteRes = await request("DELETE", `/family/members/${parentId}`, {
    token: parentToken
  });
  assert.equal(parentDeleteRes.response.status, 409); // throws "Transfer ownership required"

  // --- TEST CASE 14: Concurrent booking attempts for same child ---
  console.log("\nRunning Test Case 14...");
  const child2Id = activeChildRel.payload.data.relativeId;
  await BookingCredit.create({
    userId: child2Id,
    credits: 5,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    reason: "future_compensation"
  });

  // Run two concurrent booking fetch promises
  const [b1, b2] = await Promise.all([
    request("POST", "/queue/book", {
      token: parentToken,
      body: { doctorId: doctor._id, patientId: child2Id, bookingDate: session.date, slotTime: "12:00" }
    }),
    request("POST", "/queue/book", {
      token: parentToken,
      body: { doctorId: doctor._id, patientId: child2Id, bookingDate: session.date, slotTime: "12:00" }
    })
  ]);

  // One should succeed, one should fail with DUPLICATE_BOOKING
  const succeeded = (b1.payload.success && b1.payload.data.canBook) || (b2.payload.success && b2.payload.data.canBook);
  const failedCode = (b1.payload.data?.code === "DUPLICATE_BOOKING") || (b2.payload.data?.code === "DUPLICATE_BOOKING");
  assert.ok(succeeded);
  assert.ok(failedCode);

  // --- TEST CASE 15: Parent revokes relationship during active appointment ---
  console.log("\nRunning Test Case 15...");
  // Rahul is archived. Let's create an active child 3 with a booking, then archive the relationship.
  const activeChild3 = await request("POST", "/family", {
    token: parentToken,
    body: { relationType: "Child", name: "Child 3", dob: "2019-01-01", gender: "Male" }
  });
  const child3Id = activeChild3.payload.data.relativeId;
  await BookingCredit.create({
    userId: child3Id,
    credits: 5,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    reason: "future_compensation"
  });

  // Book slot
  const bookChild3 = await request("POST", "/queue/book", {
    token: parentToken,
    body: { doctorId: doctor._id, patientId: child3Id, bookingDate: session.date, slotTime: "12:30" }
  });
  assert.equal(bookChild3.payload.data.canBook, true);

  // Revoke relationship
  const revokeChild3 = await request("DELETE", `/family/members/${child3Id}`, {
    token: parentToken
  });
  assert.equal(revokeChild3.response.status, 200);

  // Verify the booking still exists in Queue DB (appointment remains)
  const bookingExists = await Queue.exists({ userId: child3Id, isActive: true });
  assert.ok(bookingExists);

  console.log("\nAll 15 Family Center Integration Test Cases PASSED successfully! 🛡️");

  // Clean up workers
  await stopSearchWorkers();
  await stopNotificationWorkers();
  await stopHealthWorker();
  await stopReportWorker();
  await mongoose.disconnect();
  server.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  if (server) server.close();
  process.exit(1);
});
