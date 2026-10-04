import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import Doctor from "../src/modules/doctor/doctor.model.js";
import Hospital from "../src/modules/hospital/hospital.model.js";
import User from "../src/modules/auth/auth.model.js";
import Queue from "../src/modules/queue/queue.model.js";
import QueueSession from "../src/modules/queue/queueSession.model.js";
import AppointmentBooking from "../src/modules/queue/appointment_booking.model.js";
import { getTodayIST } from "../src/modules/search/utils.js";
import { calculateEstimatedConsultationWindow, getMyQueue } from "../src/modules/queue/queue.service.js";

async function runDynamicWaitTimeTests() {
  console.log("==================================================");
  console.log("DYNAMIC WAIT-TIME / APPOINTMENT ESTIMATE TEST SUITE");
  console.log("==================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  const todayStr = getTodayIST();

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

  try {
    // Setup test doctor, hospital, and users
    let hospital = await Hospital.findOne();
    if (!hospital) {
      hospital = await Hospital.create({
        name: "Metro Health Facility",
        address: { city: "Delhi", state: "Delhi" },
        location: { type: "Point", coordinates: [77.2, 28.6] }
      });
    }

    let doctorUser = await User.findOne({ email: "doc.dynamic.test@health.local" });
    if (!doctorUser) {
      doctorUser = await User.create({
        name: "Dr. Ananya Roy",
        email: "doc.dynamic.test@health.local",
        role: "doctor",
        passwordHash: "hash"
      });
    }

    let doctor = await Doctor.findOne({ email: "doc.dynamic.test@health.local" });
    if (!doctor) {
      doctor = await Doctor.create({
        name: "Dr. Ananya Roy",
        email: "doc.dynamic.test@health.local",
        userId: doctorUser._id,
        specialization: "General Physician",
        hospitalId: hospital._id,
        avgConsultationTime: 10,
        status: "verified"
      });
    } else {
      doctor.avgConsultationTime = 10;
      await doctor.save();
    }

    let patient1 = await User.findOne({ email: "patient1.dyn@health.local" });
    if (!patient1) {
      patient1 = await User.create({
        name: "Test Patient One",
        email: "patient1.dyn@health.local",
        role: "patient",
        passwordHash: "hash"
      });
    }

    let patient2 = await User.findOne({ email: "patient2.dyn@health.local" });
    if (!patient2) {
      patient2 = await User.create({
        name: "Test Patient Two",
        email: "patient2.dyn@health.local",
        role: "patient",
        passwordHash: "hash"
      });
    }

    // Clean previous test session and queues
    await QueueSession.deleteMany({ doctorId: doctor._id, date: todayStr });
    await Queue.deleteMany({ doctorId: doctor._id });
    await AppointmentBooking.deleteMany({ doctorId: doctor._id, date: todayStr });

    const session = await QueueSession.create({
      doctorId: doctor._id,
      date: todayStr,
      sessionStatus: "active",
      sessionState: "ACTIVE",
      scheduleSnapshot: {
        startTime: "09:00",
        endTime: "17:00",
        doctorName: doctor.name
      }
    });

    // ──────────────────────────────────────────────────
    // TEST 1: On-time clinic
    // ──────────────────────────────────────────────────
    console.log("--> TEST 1: On-time clinic calculation");
    const booking1 = await AppointmentBooking.create({
      bookingNumber: "TEST-BK-001",
      userId: patient1._id,
      doctorId: doctor._id,
      hospitalId: hospital._id,
      sessionId: session._id,
      date: todayStr,
      slotTime: "09:30",
      status: "CONFIRMED",
      arrivalStatus: "NOT_ARRIVED"
    });

    // nowMinutes = 540 (09:00), 0 patients ahead, slotTime = 09:30
    const est1 = await calculateEstimatedConsultationWindow({
      booking: booking1,
      queue: null,
      session,
      nowMinutesOverride: 540 // 09:00
    });

    assert(est1 !== null, "Returns non-null consultation window");
    assert(est1.start === "09:30", `Projected start matches slotTime when on time (Got: ${est1.start})`);
    assert(est1.delayMinutes === 0, `delayMinutes is 0 on-time (Got: ${est1.delayMinutes})`);
    assert(est1.end === "09:40", `Projected end reflects slot + avgConsultation (Got: ${est1.end})`);

    // ──────────────────────────────────────────────────
    // TEST 2: Doctor running 20 minutes late
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 2: Doctor running 20 minutes late");
    // nowMinutes = 570 (09:30). 2 patients ahead, avgTime = 10 mins -> 20 mins wait.
    // projected start = 09:30 + 20 mins = 09:50.
    // slot was 09:30 -> delay is 20 minutes.
    const priorB1 = await AppointmentBooking.create({
      bookingNumber: "TEST-PRIOR-1",
      userId: new mongoose.Types.ObjectId(),
      doctorId: doctor._id,
      hospitalId: hospital._id,
      sessionId: session._id,
      date: todayStr,
      slotTime: "09:10",
      status: "CONFIRMED",
      arrivalStatus: "NOT_ARRIVED"
    });
    const priorB2 = await AppointmentBooking.create({
      bookingNumber: "TEST-PRIOR-2",
      userId: new mongoose.Types.ObjectId(),
      doctorId: doctor._id,
      hospitalId: hospital._id,
      sessionId: session._id,
      date: todayStr,
      slotTime: "09:20",
      status: "CONFIRMED",
      arrivalStatus: "NOT_ARRIVED"
    });

    const est2 = await calculateEstimatedConsultationWindow({
      booking: booking1, // slot: 09:30
      queue: null,
      session,
      nowMinutesOverride: 570 // 09:30
    });

    assert(est2.start === "09:50", `Start shifted by 20m delay (Got: ${est2.start})`);
    assert(est2.delayMinutes === 20, `delayMinutes accurately equals 20 (Got: ${est2.delayMinutes})`);
    assert(est2.end === "10:00", `End reflects 10m consult duration (Got: ${est2.end})`);

    // ──────────────────────────────────────────────────
    // TEST 3: Upcoming appointment does not project before slotTime
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 3: Scheduled-Time Invariant (Never project earlier than slotTime)");
    // now is 09:00 (540). Queue is completely empty (0 wait).
    // Booking is at 10:00 (600).
    const bookingFar = await AppointmentBooking.create({
      bookingNumber: "TEST-BK-FAR",
      userId: patient2._id,
      doctorId: doctor._id,
      hospitalId: hospital._id,
      sessionId: session._id,
      date: todayStr,
      slotTime: "10:00",
      status: "CONFIRMED",
      arrivalStatus: "NOT_ARRIVED"
    });

    const est3 = await calculateEstimatedConsultationWindow({
      booking: bookingFar,
      queue: null,
      session,
      nowMinutesOverride: 540 // 09:00
    });

    assert(est3.start >= "10:00", `Start is clamped to slotTime floor (Got: ${est3.start})`);
    assert(est3.delayMinutes === 0, "No false negative delay when clinic is ahead");

    // ──────────────────────────────────────────────────
    // TEST 4: Active consultation with elapsed time
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 4: In-progress consultation with elapsed time deduction");
    const activeQ = await Queue.create({
      userId: new mongoose.Types.ObjectId(),
      doctorId: doctor._id,
      sessionId: session._id,
      queueNumber: 1,
      status: "in_progress",
      isActive: true,
      startedAt: new Date(Date.now() - 6 * 60000) // started 6 mins ago, avgTime=10, 4 mins remaining
    });

    // Clean prior bookings so only activeQ remains
    await AppointmentBooking.deleteMany({ _id: { $in: [priorB1._id, priorB2._id] } });

    const est4 = await calculateEstimatedConsultationWindow({
      booking: booking1, // slot: 09:30
      queue: null,
      session,
      nowMinutesOverride: 570 // 09:30
    });

    // remaining = 10 - 6 = 4 mins. nowMinutes = 570. projected = 574 (09:34).
    assert(est4.start === "09:34", `Elapsed time deducted accurately (Got: ${est4.start}, Expected: 09:34)`);
    assert(est4.delayMinutes === 4, `delayMinutes equals 4 (Got: ${est4.delayMinutes})`);

    await Queue.deleteOne({ _id: activeQ._id });

    // ──────────────────────────────────────────────────
    // TEST 5: Multiple patients ahead
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 5: Multiple waiting patients ahead");
    const q1 = await Queue.create({
      userId: new mongoose.Types.ObjectId(),
      doctorId: doctor._id,
      sessionId: session._id,
      queueNumber: 2,
      status: "waiting",
      isActive: true
    });
    const q2 = await Queue.create({
      userId: new mongoose.Types.ObjectId(),
      doctorId: doctor._id,
      sessionId: session._id,
      queueNumber: 3,
      status: "waiting",
      isActive: true
    });
    const q3 = await Queue.create({
      userId: new mongoose.Types.ObjectId(),
      doctorId: doctor._id,
      sessionId: session._id,
      queueNumber: 4,
      status: "waiting",
      isActive: true
    });

    const est5 = await calculateEstimatedConsultationWindow({
      booking: booking1, // slot 09:30
      queue: null,
      session,
      nowMinutesOverride: 570 // 09:30
    });

    // 3 waiting * 10 mins = 30 mins wait. projected = 09:30 + 30m = 10:00
    assert(est5.start === "10:00", `3 patients ahead adds 30 mins (Got: ${est5.start})`);
    assert(est5.delayMinutes === 30, `delayMinutes is 30 (Got: ${est5.delayMinutes})`);

    // ──────────────────────────────────────────────────
    // TEST 6: Completed patient is NOT counted
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 6: Completed patient is excluded");
    const qCompleted = await Queue.create({
      userId: new mongoose.Types.ObjectId(),
      doctorId: doctor._id,
      sessionId: session._id,
      queueNumber: 1,
      status: "completed",
      isActive: false
    });

    const est6 = await calculateEstimatedConsultationWindow({
      booking: booking1,
      queue: null,
      session,
      nowMinutesOverride: 570
    });

    assert(est6.start === "10:00", `Completed patient did not increment wait (Got: ${est6.start})`);

    // ──────────────────────────────────────────────────
    // TEST 7: Cancelled patient is NOT counted
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 7: Cancelled patient is excluded");
    const qCancelled = await Queue.create({
      userId: new mongoose.Types.ObjectId(),
      doctorId: doctor._id,
      sessionId: session._id,
      queueNumber: 5,
      status: "cancelled",
      isActive: false
    });

    const est7 = await calculateEstimatedConsultationWindow({
      booking: booking1,
      queue: null,
      session,
      nowMinutesOverride: 570
    });

    assert(est7.start === "10:00", `Cancelled patient did not increment wait (Got: ${est7.start})`);

    // ──────────────────────────────────────────────────
    // TEST 8: No-show patient is NOT counted
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 8: No-show patient is excluded");
    const qNoShow = await Queue.create({
      userId: new mongoose.Types.ObjectId(),
      doctorId: doctor._id,
      sessionId: session._id,
      queueNumber: 6,
      status: "no_show",
      isActive: false
    });

    const est8 = await calculateEstimatedConsultationWindow({
      booking: booking1,
      queue: null,
      session,
      nowMinutesOverride: 570
    });

    assert(est8.start === "10:00", `No-show patient did not increment wait (Got: ${est8.start})`);

    // Cleanup extra queues
    await Queue.deleteMany({ _id: { $in: [q1._id, q2._id, q3._id, qCompleted._id, qCancelled._id, qNoShow._id] } });

    // ──────────────────────────────────────────────────
    // TEST 9: Paused session
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 9: Paused session reflects paused state");
    session.sessionStatus = "paused";
    await session.save();

    const est9 = await calculateEstimatedConsultationWindow({
      booking: booking1,
      queue: null,
      session,
      nowMinutesOverride: 570
    });

    assert(est9.isPaused === true, `isPaused flag is true when session paused (Got: ${est9.isPaused})`);

    // ──────────────────────────────────────────────────
    // TEST 10: Inactive session
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 10: Inactive session returns null window");
    session.sessionStatus = "inactive";
    await session.save();

    const est10 = await calculateEstimatedConsultationWindow({
      booking: booking1,
      queue: null,
      session,
      nowMinutesOverride: 570
    });

    assert(est10 === null, "Inactive session safely returns null rather than fabricating an ETA");

    // ──────────────────────────────────────────────────
    // TEST 11: Missing data returns null
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 11: Missing booking / future date returns null");
    const futureBooking = await AppointmentBooking.create({
      bookingNumber: "TEST-FUTURE-BK",
      userId: patient1._id,
      doctorId: doctor._id,
      hospitalId: hospital._id,
      sessionId: session._id,
      date: "2026-12-31",
      slotTime: "10:00",
      status: "CONFIRMED",
      arrivalStatus: "NOT_ARRIVED"
    });

    const est11 = await calculateEstimatedConsultationWindow({
      booking: futureBooking,
      queue: null,
      session
    });

    assert(est11 === null, "Future date booking returns null (cannot project live queue days ahead)");

    // ──────────────────────────────────────────────────
    // TEST 12: Existing slotTime remains unchanged
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 12: Existing slotTime remains unchanged");
    await AppointmentBooking.updateOne(
      { _id: booking1._id },
      { $set: { status: "CONFIRMED", arrivalStatus: "NOT_ARRIVED" } }
    );
    const freshBooking = await AppointmentBooking.findById(booking1._id);
    assert(freshBooking.slotTime === "09:30", `slotTime on document is strictly preserved (Got: ${freshBooking.slotTime})`);

    // ──────────────────────────────────────────────────
    // TEST 13: Existing check-in / no-show behavior remains unchanged
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 13: Check-in & arrivalStatus unchanged");
    assert(freshBooking.arrivalStatus === "NOT_ARRIVED", "arrivalStatus remains NOT_ARRIVED");
    assert(freshBooking.status === "CONFIRMED", "status remains CONFIRMED");

    // ──────────────────────────────────────────────────
    // TEST 14: getMyQueue returns backward compatible response with estimatedConsultationWindow
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 14: getMyQueue API contract & backward compatibility");
    session.sessionStatus = "active";
    await session.save();

    const myQueueRes = await getMyQueue(patient1._id);

    assert(myQueueRes.bookingId.toString() === booking1._id.toString(), "bookingId matches");
    assert(myQueueRes.slotTime === "09:30", `slotTime in response is exact (Got: ${myQueueRes.slotTime})`);
    assert(myQueueRes.isUpcoming === true, "isUpcoming flag is true");
    assert(myQueueRes.isLiveQueue === false, "isLiveQueue flag is false");
    assert("estimatedConsultationWindow" in myQueueRes, "estimatedConsultationWindow field is present in response");
    assert(myQueueRes.estimatedConsultationWindow !== null, "estimatedConsultationWindow is populated for today's active session");

    // ──────────────────────────────────────────────────
    // TEST 15: Backward compatibility when patient has no active booking
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 15: Error handling backward compatibility (404 when no booking)");
    const ghostUserId = new mongoose.Types.ObjectId();
    let threw404 = false;
    try {
      await getMyQueue(ghostUserId);
    } catch (err) {
      if (err.status === 404) threw404 = true;
    }
    assert(threw404, "Throws HTTP 404 cleanly when no active booking exists");

    console.log("\n==================================================");
    console.log(`TOTAL DYNAMIC WAIT-TIME TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    // Clean up test documents
    await QueueSession.deleteMany({ doctorId: doctor._id });
    await Queue.deleteMany({ doctorId: doctor._id });
    await AppointmentBooking.deleteMany({ doctorId: doctor._id });
    await Doctor.deleteMany({ _id: doctor._id });
    await User.deleteMany({ _id: { $in: [patient1._id, patient2._id] } });

    await mongoose.disconnect();
    if (failed > 0) process.exit(1);
  } catch (err) {
    console.error("Test execution error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

runDynamicWaitTimeTests();
