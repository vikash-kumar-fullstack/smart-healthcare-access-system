import assert from "node:assert/strict";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

process.env.NODE_ENV = "test";

// Load models
import DoctorSchedule from "../src/modules/doctor/doctor_schedule.model.js";
import DoctorScheduleOverride from "../src/modules/doctor/doctor_schedule_override.model.js";
import DoctorLeave from "../src/modules/doctor/doctor_leave.model.js";
import DoctorBreak from "../src/modules/doctor/doctor_break.model.js";
import QueueSession from "../src/modules/queue/queueSession.model.js";
import Queue from "../src/modules/queue/queue.model.js";
import Doctor from "../src/modules/doctor/doctor.model.js";
import HospitalHoliday from "../src/modules/hospital/hospital_holiday.model.js";
import Hospital from "../src/modules/hospital/hospital.model.js";
import User from "../src/modules/auth/auth.model.js";
import AdminAudit from "../src/modules/admin/admin_audit.model.js";
import BookingCredit from "../src/modules/queue/booking_credit.model.js";
import PatientStats from "../src/modules/queue/patient_stats.model.js";

// Services
import * as scheduleService from "../src/modules/doctor/schedule.service.js";
import { bookQueue } from "../src/modules/queue/queue.service.js";
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
  return `${hostPart}/smart-healthcare-test-schedule${queryPart}`;
};

const runTests = async () => {
  const testMongoUri = rewriteMongoUri(process.env.MONGO_URI);
  console.log("Connecting to schedule test database...");
  await mongoose.connect(testMongoUri);

  console.log("Cleaning schedule test collections...");
  await Promise.all(
    mongoose.modelNames().map(modelName => mongoose.model(modelName).deleteMany({}))
  );

  console.log("Waiting for indexes...");
  await Promise.all(
    mongoose.modelNames().map(modelName => mongoose.model(modelName).init())
  );

  // 1. Seed Initial Data
  console.log("Seeding test entities...");
  const hospital = await Hospital.create({
    name: "St. Jude Roster General",
    address: "77 Medical Plaza, District 5",
    location: { type: "Point", coordinates: [77.5946, 12.9716] },
    specializations: ["Cardiology", "General"],
    bookingWindowDays: 14,
    bookingCutoffMinutes: 15
  });

  const hashedPwd = await bcrypt.hash("Password123", 10);
  const userDoctor1 = await User.create({
    name: "Dr. Gregory House",
    email: "gregory.house@stjude.org",
    phone: "9887766554",
    role: "doctor",
    password: hashedPwd
  });

  const doctor1 = await Doctor.create({
    name: "Dr. Gregory House",
    specialization: "Cardiology",
    hospitalId: hospital._id,
    userId: userDoctor1._id,
    avgConsultationTime: 15,
    status: "verified",
    profileCompleted: true
  });

  const userDoctor2 = await User.create({
    name: "Dr. Allison Cameron",
    email: "allison.cameron@stjude.org",
    phone: "9887766555",
    role: "doctor",
    password: hashedPwd
  });

  const doctor2 = await Doctor.create({
    name: "Dr. Allison Cameron",
    specialization: "Cardiology",
    hospitalId: hospital._id,
    userId: userDoctor2._id,
    avgConsultationTime: 15,
    status: "verified",
    profileCompleted: true
  });

  const userPatient = await User.create({
    name: "Patient Robert Chase",
    email: "robert.chase@gmail.com",
    phone: "9112233445",
    role: "patient",
    password: hashedPwd
  });

  const userPatient2 = await User.create({
    name: "Patient Eric Foreman",
    email: "eric.foreman@gmail.com",
    phone: "9112233446",
    role: "patient",
    password: hashedPwd
  });

  // 2. Test Weekly Schedule CRUD, Draft & Publish
  console.log("Testing weekly schedule draft & publish lifecycle...");
  const shifts = [
    { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }, // Morning shift
    { dayOfWeek: 1, startTime: "14:00", endTime: "17:00" }  // Afternoon split shift
  ];

  const draftResult = await scheduleService.saveWeeklyScheduleDraft(doctor1._id, shifts);
  assert.equal(draftResult.version, 1, "Roster draft should start at version 1");
  const draftSchedules = await DoctorSchedule.find({ doctorId: doctor1._id, version: 1 });
  assert.equal(draftSchedules.length, 2);
  assert.equal(draftSchedules[0].status, "draft");

  // Publish
  await scheduleService.publishWeeklySchedule(doctor1._id, 1);
  const publishedSchedules = await DoctorSchedule.find({ doctorId: doctor1._id, status: "published" });
  assert.equal(publishedSchedules.length, 2);
  assert.equal(publishedSchedules[0].version, 1);

  // 3. Test Conflict Detection (Overlapping split shifts)
  console.log("Testing conflict detection on overlapping shifts...");
  const badShifts = [
    { dayOfWeek: 2, startTime: "09:00", endTime: "12:00" },
    { dayOfWeek: 2, startTime: "11:30", endTime: "14:00" }
  ];
  await assert.rejects(
    async () => {
      await scheduleService.saveWeeklyScheduleDraft(doctor1._id, badShifts);
    },
    /Split shift overlaps detected/,
    "Overlapping shifts must be rejected."
  );

  // 4. Test Lock Window constraints
  console.log("Testing lock window constraints...");
  const todayStr = getTodayIST();
  // Create an active session today
  await QueueSession.create({
    doctorId: doctor1._id,
    date: todayStr,
    sessionState: "ACTIVE",
    sessionStatus: "active",
    scheduleSnapshot: {
      startTime: "09:00",
      endTime: "12:00",
      queueLimit: 10,
      doctorName: doctor1.name,
      hospitalName: hospital.name,
      averageConsultationTime: 15,
      scheduleVersion: 1
    }
  });

  await assert.rejects(
    async () => {
      await scheduleService.saveWeeklyScheduleDraft(doctor1._id, [{ dayOfWeek: 1, startTime: "10:00", endTime: "12:00" }]);
    },
    /An active session is currently running today/,
    "Modifications should be blocked when session is active."
  );

  // Remove the active session to unblock other tests
  await QueueSession.deleteMany({ doctorId: doctor1._id, date: todayStr });

  // 5. Test Dynamic Slot Generation & Cache
  console.log("Testing dynamic slot generator...");
  // Monday next week date
  const testMondayDate = "2026-07-06"; // Confirmed Monday
  const slots = await scheduleService.generateDoctorSlots(doctor1._id, testMondayDate);
  // Shift 1: 09:00 - 12:00 (15m slot = 12 slots)
  // Shift 2: 14:00 - 17:00 (15m slot = 12 slots)
  // Total = 24 slots
  assert.equal(slots.length, 24);
  assert.equal(slots[0].time, "09:00");
  assert.equal(slots[0].status, "AVAILABLE");

  // Check cache hit
  const cacheKey = `${doctor1._id}_${testMondayDate}_v1`;
  assert.ok(scheduleService.generateDoctorSlots.cache !== null);

  // 6. Test Booking Slot Integration & cutoff buffers
  console.log("Testing booking slot selection...");
  // Book slot 09:15
  const bookingRes = await bookQueue(userPatient._id, doctor1._id, testMondayDate, "09:15");
  assert.ok(bookingRes.canBook);
  assert.equal(bookingRes.booking.isPriority, false);

  // Re-generate slots ➔ slot 09:15 should be marked BOOKED
  scheduleService.invalidateSlotCache(doctor1._id, testMondayDate);
  const slotsAfterBook = await scheduleService.generateDoctorSlots(doctor1._id, testMondayDate);
  const slot0915 = slotsAfterBook.find(s => s.time === "09:15");
  assert.equal(slot0915.status, "BOOKED");

  // Try to double-book slot 09:15
  const doubleBookRes = await bookQueue(userPatient2._id, doctor1._id, testMondayDate, "09:15");
  assert.equal(doubleBookRes.canBook, false);
  assert.equal(doubleBookRes.code, "SLOT_UNAVAILABLE");

  // 7. Test Leave Approval Auto-Reassignment
  console.log("Testing leave approval auto-reassignment workflow...");
  // Set up doctor 2 (peer Allison Cameron) schedule for next Monday as well
  await scheduleService.saveWeeklyScheduleDraft(doctor2._id, [
    { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }
  ]);
  await scheduleService.publishWeeklySchedule(doctor2._id, 1);

  // Generate slots for doctor 2 to populate cache/availability
  const doctor2Slots = await scheduleService.generateDoctorSlots(doctor2._id, testMondayDate);
  assert.ok(doctor2Slots.length > 0);

  // Patient is booked for Gregory House on Monday 09:15.
  // Request leave for Gregory House on Monday next week.
  const leave = await scheduleService.requestLeave(
    doctor1._id,
    "full_day",
    testMondayDate,
    testMondayDate,
    null,
    null,
    "Vacation to Princeton-Plainsboro"
  );

  // Approve leave ➔ Gregory House's booking for Robert Chase at 09:15 should be re-assigned to Allison Cameron!
  const approveRes = await scheduleService.approveLeave(leave._id, userDoctor1._id);
  assert.equal(approveRes.reassignments.length, 1);
  assert.equal(approveRes.reassignments[0].newDoctorId.toString(), doctor2._id.toString());

  // Confirm booking changed doctor
  const updatedBooking = await Queue.findById(bookingRes.booking.queueId);
  assert.equal(updatedBooking.doctorId.toString(), doctor2._id.toString());

  // 8. Test Holiday Hierarchy Inheritance
  console.log("Testing holiday hierarchy inheritance...");
  const holidayDate = "2026-07-07"; // Tuesday
  await HospitalHoliday.create({
    name: "National Access Day",
    date: holidayDate,
    type: "national_holiday"
  });

  const holidaySlots = await scheduleService.generateDoctorSlots(doctor1._id, holidayDate);
  assert.equal(holidaySlots.length, 1);
  assert.equal(holidaySlots[0].status, "HOLIDAY");
  assert.equal(holidaySlots[0].label, "National Access Day");

  // 9. Stress Testing Performance
  console.log("Running scalability stress test...");
  const stressDoctorIds = [];
  for (let i = 0; i < 20; i++) {
    const u = await User.create({
      name: `Stress Doc ${i}`,
      email: `stress.doc${i}@stjude.org`,
      phone: `999000${String(i).padStart(4, "0")}`,
      role: "doctor",
      password: hashedPwd
    });
    const d = await Doctor.create({
      name: `Stress Doc ${i}`,
      specialization: "Cardiology",
      hospitalId: hospital._id,
      userId: u._id,
      avgConsultationTime: 10,
      status: "verified",
      profileCompleted: true
    });
    stressDoctorIds.push(d._id);
    await scheduleService.saveWeeklyScheduleDraft(d._id, [
      { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" } // 8 hours = 48 slots each
    ]);
    await scheduleService.publishWeeklySchedule(d._id, 1);
  }

  const startMs = Date.now();
  // Generate slots for all 20 stress test doctors
  for (const dId of stressDoctorIds) {
    const s = await scheduleService.generateDoctorSlots(dId, "2026-07-13");
    assert.equal(s.length, 48);
  }
  const durationMs = Date.now() - startMs;
  console.log(`Generated 960 availability slots across 20 doctors in ${durationMs}ms`);
  assert.ok(durationMs < 15000, "Stress slot generation should execute under 15 seconds");

  console.log("🎉 All backend schedule ecosystem tests passed successfully!");
  process.exit(0);
};

runTests().catch(err => {
  console.error("❌ Schedule ecosystem tests failed:", err);
  process.exit(1);
});
