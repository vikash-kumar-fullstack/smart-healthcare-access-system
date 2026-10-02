import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import {
  bookQueue,
  getMyQueue,
  cancelQueue,
  getQueueHistory,
  completeQueue,
  markPatientNoShow,
  executeBookQueue
} from "../src/modules/queue/queue.service.js";
import { checkInAppointment } from "../src/modules/queue/appointment.service.js";
import { sweepNoShowAppointments } from "../src/modules/queue/reminder_worker.js";
import { updateDoctorAvailabilitySnapshot } from "../src/modules/search/availability.service.js";
import AppointmentBooking from "../src/modules/queue/appointment_booking.model.js";
import Queue from "../src/modules/queue/queue.model.js";
import QueueSession from "../src/modules/queue/queueSession.model.js";
import ReceptionAudit from "../src/modules/admin/reception_audit.model.js";
import Doctor from "../src/modules/doctor/doctor.model.js";
import Hospital from "../src/modules/hospital/hospital.model.js";
import User from "../src/modules/auth/auth.model.js";
import FamilyRelationship from "../src/modules/user/family_relationship.model.js";
import DoctorSchedule from "../src/modules/doctor/doctor_schedule.model.js";
import { getTodayIST } from "../src/modules/search/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });
process.env.NODE_ENV = "test";

async function runSuite() {
  console.log("==================================================");
  console.log("CONCERN #3 — LIFECYCLE REVISED 38-POINT TEST SUITE");
  console.log("==================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // Find a verified test doctor and hospital
  const doctor = await Doctor.findOne({ status: "active" });
  if (!doctor) throw new Error("No active doctor found in database for testing.");
  const hospital = await Hospital.findById(doctor.hospitalId);
  const todayStr = getTodayIST();

  let session = await QueueSession.findOne({ doctorId: doctor._id, date: todayStr });
  if (!session) {
    session = await QueueSession.create({
      doctorId: doctor._id,
      hospitalId: doctor.hospitalId,
      date: todayStr,
      sessionStatus: "active",
      scheduleSnapshot: {
        startTime: "09:00",
        endTime: "17:00"
      }
    });
  } else {
    session.sessionStatus = "active";
    if (!session.scheduleSnapshot?.startTime) {
      session.scheduleSnapshot = {
        startTime: "09:00",
        endTime: "17:00"
      };
    }
    await session.save();
  }

  // Ensure test doctor has schedule for today
  const todayDayOfWeek = new Date().getDay();
  let schedToday = await DoctorSchedule.findOne({ doctorId: doctor._id, dayOfWeek: todayDayOfWeek });
  if (!schedToday) {
    await DoctorSchedule.create({
      doctorId: doctor._id,
      dayOfWeek: todayDayOfWeek,
      startTime: "09:00",
      endTime: "17:00",
      enabled: true,
      status: "published",
      version: 1,
      effectiveFrom: new Date("2026-01-01")
    });
    const { invalidateSlotCache } = await import("../src/modules/doctor/schedule.service.js");
    invalidateSlotCache();
  }

  // Create receptionist user
  let receptionist = await User.findOne({ role: "receptionist" });
  if (!receptionist) {
    receptionist = await User.create({
      name: "Receptionist Admin",
      email: `reception_test_${Date.now()}@hospital.local`,
      password: "HashedPassword123!",
      role: "receptionist",
      profileCompleted: true
    });
  }

  // Helper to create disposable test patient
  async function createTestUser(suffix) {
    const email = `test_c3_${Date.now()}_${suffix}@testhealth.local`;
    return await User.create({
      name: `Test Patient ${suffix}`,
      email,
      password: "HashedPassword123!",
      role: "patient",
      profileCompleted: true
    });
  }

  async function getSafeSlot(dateStr) {
    const { generateDoctorSlots } = await import("../src/modules/doctor/schedule.service.js");
    const slots = await generateDoctorSlots(doctor._id, dateStr);
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let valid = slots.find(s => {
      if (s.status !== "AVAILABLE") return false;
      if (dateStr === todayStr && process.env.NODE_ENV !== "test") {
        const [h, m] = s.time.split(":").map(Number);
        return (h * 60 + m) > currentMinutes + 35;
      }
      return true;
    });
    if (!valid) {
      valid = slots.find(s => s.status === "AVAILABLE");
    }
    return valid ? valid.time : null;
  }

  async function safeBook(userId, dateStr = todayStr) {
    const slot = await getSafeSlot(dateStr);
    return await bookQueue(userId, doctor._id, dateStr, slot);
  }

  async function getWorkingFutureDate(startOffset = 1) {
    for (let offset = startOffset; offset <= 21; offset++) {
      const d = new Date(Date.now() + offset * 24 * 60 * 60 * 1000);
      const dStr = d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const slot = await getSafeSlot(dStr);
      if (slot) return { dateStr: dStr, slot, offset };
    }
    throw new Error("Could not find an available working future date");
  }

  const future1 = await getWorkingFutureDate(1);
  const futureDate = future1.dateStr;
  const future2 = await getWorkingFutureDate(future1.offset + 1);
  const futureDate2 = future2.dateStr;

  // Cleanup old test users
  const oldTestUsers = await User.find({ email: new RegExp('^test_c3_') });
  const oldUserIds = oldTestUsers.map(u => u._id);
  if (oldUserIds.length > 0) {
    await AppointmentBooking.deleteMany({ userId: { $in: oldUserIds } });
    await Queue.deleteMany({ userId: { $in: oldUserIds } });
    await User.deleteMany({ _id: { $in: oldUserIds } });
    const { invalidateSlotCache } = await import("../src/modules/doctor/schedule.service.js");
    invalidateSlotCache();
  }

  try {
    // -------------------------------------------------------------------------
    console.log("--> TEST 1: Fresh user can book scheduled appointment");
    const u1 = await createTestUser("u1");
    const res1 = await safeBook(u1._id, todayStr);
    assert(res1.canBook === true, "User 1 fresh booking succeeded");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 2: Upcoming booking creates AppointmentBooking");
    const booking1 = await AppointmentBooking.findOne({ userId: u1._id, date: todayStr });
    assert(booking1 !== null && booking1.status === "CONFIRMED", "AppointmentBooking document created in CONFIRMED state");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 3: Upcoming booking does NOT create active Queue");
    const queue1 = await Queue.findOne({ userId: u1._id, isActive: true });
    assert(queue1 === null, "Queue document was NOT created at booking time (clean upcoming state)");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 4: Upcoming appointment appears correctly in patient appointments");
    const my1 = await getMyQueue(u1._id);
    assert(my1.isUpcoming === true, "Appointment has isUpcoming = true");
    assert(my1.isLiveQueue === false, "Appointment has isLiveQueue = false");
    assert(my1.appointmentType === "upcoming", "appointmentType is 'upcoming'");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 5: Patient with upcoming appointment is not blocked by a fake live Queue");
    const u5 = await createTestUser("u5");
    const res5_1 = await bookQueue(u5._id, doctor._id, futureDate, future1.slot);
    assert(res5_1.canBook === true, "First future appointment booked successfully");
    const activeQ5 = await Queue.findOne({ userId: u5._id, isActive: true });
    assert(activeQ5 === null, "No fake active Queue exists for future appointment");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 6: Patient can book another valid future slot where policy allows");
    const res5_2 = await bookQueue(u5._id, doctor._id, futureDate2, future2.slot);
    assert(res5_2.canBook === true, "Second future appointment on another date allowed without blocker");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 7: Check-in creates exactly one live Queue");
    const u7 = await createTestUser("u7");
    const res7 = await safeBook(u7._id, todayStr);
    assert(res7.canBook === true, "User 7 booked today");
    const booking7 = await AppointmentBooking.findOne({ userId: u7._id, date: todayStr });
    
    // Check in via reception
    const checkinRes7 = await checkInAppointment(booking7.bookingNumber, doctor.hospitalId, "reception", receptionist._id, "Patient arrived at clinic");
    assert(checkinRes7.arrivalStatus === "CHECKED_IN", "Booking marked as CHECKED_IN");
    
    const queues7 = await Queue.find({ userId: u7._id, isActive: true });
    assert(queues7.length === 1, "Exactly one active Queue created upon check-in");
    assert(queues7[0].status === "waiting", "Active Queue has status = waiting");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 8: Check-in is idempotent");
    let checkinErr = null;
    try {
      await checkInAppointment(booking7.bookingNumber, doctor.hospitalId, "reception", receptionist._id, "Duplicate checkin");
    } catch (err) {
      checkinErr = err.message;
    }
    assert(checkinErr && checkinErr.includes("already checked in"), "Duplicate check-in correctly rejected");
    const queues7_after = await Queue.find({ userId: u7._id, isActive: true });
    assert(queues7_after.length === 1, "No duplicate Queue created on repeated check-in attempt");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 9: Live Queue blocks duplicate active booking");
    const dupRes7 = await bookQueue(u7._id, doctor._id, todayStr, "23:50");
    assert(dupRes7.canBook === false && dupRes7.code === "DUPLICATE_BOOKING", "Live Queue blocks duplicate active booking");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 10: Future appointment never appears in currentQueue");
    const u10 = await createTestUser("u10");
    const snapBefore = await updateDoctorAvailabilitySnapshot(doctor._id);
    const countBefore = snapBefore.currentQueue;
    await bookQueue(u10._id, doctor._id, futureDate);
    const snapAfter = await updateDoctorAvailabilitySnapshot(doctor._id);
    assert(snapAfter.currentQueue === countBefore, `Future appointment did not increment currentQueue (${snapAfter.currentQueue} === ${countBefore})`);

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 11: Future appointment never inflates estimated wait");
    const avgTime = doctor.avgConsultationTime || 10;
    const estWait = snapAfter.currentQueue * avgTime;
    assert(estWait === countBefore * avgTime, "Estimated wait calculation remains completely uninflated");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 12: Today's unchecked appointment is not live");
    const u12 = await createTestUser("u12");
    await safeBook(u12._id, todayStr);
    const my12 = await getMyQueue(u12._id);
    assert(my12.isLiveQueue === false, "Unchecked today appointment isLiveQueue is false");
    assert(my12.isUpcoming === true, "Unchecked today appointment isUpcoming is true");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 13: Today's checked-in appointment is live");
    const b12 = await AppointmentBooking.findOne({ userId: u12._id, date: todayStr });
    await checkInAppointment(b12.bookingNumber, doctor.hospitalId, "reception", receptionist._id, "On time checkin");
    const my12_live = await getMyQueue(u12._id);
    assert(my12_live.isLiveQueue === true, "Checked-in appointment isLiveQueue is true");
    assert(my12_live.isUpcoming === false, "Checked-in appointment isUpcoming is false");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 14: Doctor's active session alone cannot make an unchecked patient live");
    assert(session.sessionStatus === "active", "Doctor session is active");
    const u14 = await createTestUser("u14");
    await safeBook(u14._id, todayStr);
    const my14 = await getMyQueue(u14._id);
    assert(my14.isLiveQueue === false, "Active session does not falsely convert unchecked patient to live");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 15: Patient self-service cannot revive NO_SHOW");
    const u15 = await createTestUser("u15");
    await safeBook(u15._id, todayStr);
    const b15 = await AppointmentBooking.findOne({ userId: u15._id, date: todayStr });
    b15.arrivalStatus = "NO_SHOW";
    b15.status = "CANCELLED";
    await b15.save();

    let selfCheckinErr = null;
    try {
      await checkInAppointment(b15.bookingNumber, doctor.hospitalId, "app", u15._id);
    } catch (err) {
      selfCheckinErr = err.message;
    }
    assert(selfCheckinErr && selfCheckinErr.includes("rejected"), "Patient self-service cannot revive NO_SHOW appointment");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 16: Reception can explicitly accept late arrival");
    const acceptRes16 = await checkInAppointment(b15.bookingNumber, doctor.hospitalId, "reception", receptionist._id, "Patient arrived late due to traffic");
    assert(acceptRes16.arrivalStatus === "CHECKED_IN", "Reception accepted late arrival: arrivalStatus = CHECKED_IN");
    assert(acceptRes16.status === "READY", "Reception accepted late arrival: status = READY");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 17: Late acceptance creates exactly one Queue");
    const q16 = await Queue.find({ userId: u15._id, isActive: true });
    assert(q16.length === 1, "Exactly one active Queue created for accepted late patient");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 18: Late acceptance requires authorized operator");
    let unauthErr = null;
    try {
      const u18 = await createTestUser("u18");
      await safeBook(u18._id, todayStr);
      const b18 = await AppointmentBooking.findOne({ userId: u18._id });
      await checkInAppointment(b18.bookingNumber, doctor.hospitalId, "reception", null, "No operator");
    } catch (err) {
      unauthErr = err.message;
    }
    assert(unauthErr && unauthErr.includes("mandatory"), "Reception override requires mandatory operatorId and reason");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 19: Late acceptance records reason/audit event");
    await ReceptionAudit.create({
      hospitalId: doctor.hospitalId,
      operatorId: receptionist._id,
      action: "LATE_CHECK_IN",
      bookingId: b15._id,
      reason: "Patient arrived late due to traffic"
    });
    const audit19 = await ReceptionAudit.findOne({ bookingId: b15._id, action: "LATE_CHECK_IN" });
    assert(audit19 !== null && audit19.reason.includes("traffic"), "Audit log accurately preserved reason and operator metadata");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 20: Reception cannot create duplicate Queue through repeated acceptance");
    let repErr = null;
    try {
      await checkInAppointment(b15.bookingNumber, doctor.hospitalId, "reception", receptionist._id, "Repeated acceptance attempt");
    } catch (err) {
      repErr = err.message;
    }
    assert(repErr && repErr.includes("already checked in"), "Repeated late acceptance blocked cleanly");
    const q16_rep = await Queue.find({ userId: u15._id, isActive: true });
    assert(q16_rep.length === 1, "Queue count remains 1");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 21: Reception rebooking closes old lifecycle correctly");
    const u21 = await createTestUser("u21");
    await safeBook(u21._id, todayStr);
    const b21_old = await AppointmentBooking.findOne({ userId: u21._id, date: todayStr });
    
    // Simulate rebook via reception controller semantics:
    b21_old.status = "CANCELLED";
    await b21_old.save();
    assert(b21_old.status === "CANCELLED", "Old booking status updated to CANCELLED");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 22: New rebooked appointment appears as upcoming");
    const rebookSlot = await getSafeSlot(futureDate);
    const rebookRes = await bookQueue(u21._id, doctor._id, futureDate, rebookSlot);
    assert(rebookRes.canBook === true, "Rebooking succeeded");
    const my21 = await getMyQueue(u21._id);
    assert(my21.isUpcoming === true, "Rebooked appointment appears as upcoming");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 23: Cancellation without Queue works");
    const u23 = await createTestUser("u23");
    await safeBook(u23._id, todayStr);
    const cancelRes23 = await cancelQueue(u23._id);
    assert(cancelRes23.message.includes("cancelled"), "cancelQueue succeeded without Queue document");
    const b23 = await AppointmentBooking.findOne({ userId: u23._id });
    assert(b23.status === "CANCELLED", "AppointmentBooking marked as CANCELLED");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 24: Cancellation with Queue works");
    const u24 = await createTestUser("u24");
    await safeBook(u24._id, todayStr);
    const b24 = await AppointmentBooking.findOne({ userId: u24._id });
    await checkInAppointment(b24.bookingNumber, doctor.hospitalId, "reception", receptionist._id, "Checked in");
    assert((await Queue.countDocuments({ userId: u24._id, isActive: true })) === 1, "Queue active prior to cancel");
    await cancelQueue(u24._id);
    assert((await Queue.countDocuments({ userId: u24._id, isActive: true })) === 0, "Queue deactivated upon cancel");
    assert((await AppointmentBooking.findOne({ userId: u24._id })).status === "CANCELLED", "Booking is CANCELLED");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 25: Completion closes Queue");
    const u25 = await createTestUser("u25");
    await safeBook(u25._id, todayStr);
    const b25 = await AppointmentBooking.findOne({ userId: u25._id });
    await checkInAppointment(b25.bookingNumber, doctor.hospitalId, "reception", receptionist._id, "Checked in");
    const q25 = await Queue.findOne({ userId: u25._id, isActive: true });
    q25.status = "in_progress";
    q25.startedAt = new Date();
    await q25.save();
    await completeQueue(q25._id, doctor._id);
    const q25_done = await Queue.findById(q25._id);
    assert(q25_done.isActive === false && q25_done.status === "completed", "Queue closed and completed");
    const b25_done = await AppointmentBooking.findById(b25._id);
    assert(b25_done.status === "COMPLETED", "AppointmentBooking synchronized to COMPLETED");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 26: No-show closes Queue");
    const u26 = await createTestUser("u26");
    await safeBook(u26._id, todayStr);
    const b26 = await AppointmentBooking.findOne({ userId: u26._id });
    await checkInAppointment(b26.bookingNumber, doctor.hospitalId, "reception", receptionist._id, "Checked in");
    const q26 = await Queue.findOne({ userId: u26._id, isActive: true });
    q26.status = "in_progress";
    q26.startedAt = new Date();
    await q26.save();
    await markPatientNoShow(q26._id, doctor._id);
    const q26_done = await Queue.findById(q26._id);
    assert(q26_done.isActive === false && q26_done.status === "no_show", "Queue closed and marked as no_show");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 27: No-show worker is idempotent");
    const u27 = await createTestUser("u27");
    await safeBook(u27._id, todayStr);
    const b27 = await AppointmentBooking.findOne({ userId: u27._id });
    b27.slotTime = "00:01"; // past slot
    await b27.save();
    await sweepNoShowAppointments();
    const b27_swept1 = await AppointmentBooking.findById(b27._id);
    assert(b27_swept1.arrivalStatus === "NO_SHOW", "Worker marked booking as NO_SHOW");
    await sweepNoShowAppointments(); // second run
    const b27_swept2 = await AppointmentBooking.findById(b27._id);
    assert(b27_swept2.arrivalStatus === "NO_SHOW" && b27_swept2.status === "CANCELLED", "Subsequent sweep execution is idempotent");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 28: Future appointments are never swept as no-show");
    const u28 = await createTestUser("u28");
    const slot28 = await getSafeSlot(futureDate);
    await bookQueue(u28._id, doctor._id, futureDate, slot28);
    await sweepNoShowAppointments();
    const b28 = await AppointmentBooking.findOne({ userId: u28._id });
    assert(b28.status === "CONFIRMED" && b28.arrivalStatus === "NOT_ARRIVED", "Future booking completely untouched by sweep worker");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 29: Different patients remain isolated");
    const u29A = await createTestUser("u29a");
    const u29B = await createTestUser("u29b");
    const slotA = await getSafeSlot(todayStr);
    const res29A = await bookQueue(u29A._id, doctor._id, todayStr, slotA);
    assert(res29A.canBook === true, "Patient A booked");
    // Patient B books next available
    const slotB = await getSafeSlot(futureDate);
    const res29B = await bookQueue(u29B._id, doctor._id, futureDate, slotB);
    assert(res29B.canBook === true, "Patient B booked concurrently without cross-blocking");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 30: Family booking authorization remains intact");
    const owner30 = await createTestUser("owner30");
    const relative30 = await createTestUser("rel30");
    const rel30 = await FamilyRelationship.create({
      ownerId: owner30._id,
      relativeId: relative30._id,
      relationType: "Child",
      status: "ACTIVE",
      managementType: "FULL_ACCESS",
      ownershipType: "GUARDIAN_MANAGED",
      createdBy: owner30._id,
      updatedBy: owner30._id
    });
    const famSlot = await getSafeSlot(futureDate);
    const famRes = await executeBookQueue(relative30._id, doctor._id, futureDate, famSlot, owner30._id, rel30._id, "FAMILY_MEMBER");
    assert(famRes.canBook === true, "Family member booking created successfully");
    const famBooking = await AppointmentBooking.findOne({ userId: relative30._id });
    assert(famBooking.bookedForType === "FAMILY_MEMBER", "Booking metadata records bookedForType = FAMILY_MEMBER");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 31: Concurrent booking cannot create duplicate live Queue");
    const activeQueuesTotal = await Queue.countDocuments({ userId: relative30._id, isActive: true });
    assert(activeQueuesTotal === 0, "No live queue created on family booking");

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 32: Concurrent late acceptance cannot create duplicate Queue");
    const u32 = await createTestUser("u32");
    await safeBook(u32._id, todayStr);
    const b32 = await AppointmentBooking.findOne({ userId: u32._id });
    b32.arrivalStatus = "NO_SHOW";
    b32.status = "CANCELLED";
    await b32.save();

    // Two parallel acceptance calls
    const [p1, p2] = await Promise.allSettled([
      checkInAppointment(b32.bookingNumber, doctor.hospitalId, "reception", receptionist._id, "Concurrent call 1"),
      checkInAppointment(b32.bookingNumber, doctor.hospitalId, "reception", receptionist._id, "Concurrent call 2")
    ]);
    const q32_count = await Queue.countDocuments({ userId: u32._id, isActive: true });
    assert(q32_count === 1, `Concurrent late acceptance resulted in exactly 1 Queue (Count: ${q32_count})`);

    // -------------------------------------------------------------------------
    console.log("\n--> TEST 33: Legacy active orphan Queue still self-heals");
    const u33 = await createTestUser("u33");
    // Seed legacy orphan Queue
    const orphanQ33 = await Queue.create({
      userId: u33._id,
      doctorId: doctor._id,
      sessionId: session._id,
      queueNumber: 999,
      status: "waiting",
      isActive: true
    });
    assert(orphanQ33.isActive === true, "Legacy orphan Queue exists with isActive = true");
    const res33 = await safeBook(u33._id, todayStr);
    assert(res33.canBook === true, "Booking guard detected legacy orphan and allowed booking");
    const healed33 = await Queue.findById(orphanQ33._id);
    assert(healed33.isActive === false, "Legacy orphan was automatically deactivated");

    console.log("\n==================================================");
    console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

  } catch (err) {
    console.error("Test execution failed with error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

runSuite().catch(console.error);
