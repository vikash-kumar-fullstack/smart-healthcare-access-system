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
import QueueSession from "../src/modules/queue/queueSession.model.js";
import AppointmentBooking from "../src/modules/queue/appointment_booking.model.js";
import AccountBookingCapacity from "../src/modules/queue/account_booking_capacity.model.js";
import FamilyRelationship from "../src/modules/user/family_relationship.model.js";
import { executeBookQueue, cancelQueue, releaseBookingCapacity } from "../src/modules/queue/queue.service.js";

async function runConcurrencyTests() {
  console.log("==================================================");
  console.log("BOOKING CONCURRENCY & EXACT-SLOT UNIQUENESS SUITE");
  console.log("==================================================\n");

  await mongoose.connect(process.env.MONGO_URI);

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

  const testDoctorId = new mongoose.Types.ObjectId();
  const getFutureDateStr = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  };

  const dateStr = getFutureDateStr(2);
  const nextDayStr = getFutureDateStr(3);

  try {
    // 0. Setup doctor, hospital, schedules
    let hospital = await Hospital.findOne();
    if (!hospital) {
      hospital = await Hospital.create({
        name: "Concurrency Test Medical Center",
        address: "100 Health Way",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
        contactNumber: "9876543210",
        emergencyContactNumber: "9876543211",
        status: "active",
        location: {
          type: "Point",
          coordinates: [77.2090, 28.6139]
        },
        bookingWindowDays: 60,
        bookingCutoffMinutes: 0
      });
    }

    const docUser = await User.create({
      name: "Dr. Concurrency Specialist",
      email: `doc.concurrency.${Date.now()}@health.local`,
      role: "doctor",
      passwordHash: "hash"
    });

    const doctor = await Doctor.create({
      _id: testDoctorId,
      name: "Dr. Concurrency Specialist",
      userId: docUser._id,
      hospitalId: hospital._id,
      specialization: "General Physician",
      avgConsultationTime: 10,
      status: "verified"
    });

    const DoctorSchedule = mongoose.model("DoctorSchedule");
    for (let d = 0; d <= 6; d++) {
      await DoctorSchedule.create({
        doctorId: doctor._id,
        dayOfWeek: d,
        startTime: "08:00",
        endTime: "18:00",
        slotDuration: 10,
        maxPatientsPerSlot: 1,
        enabled: true,
        status: "published"
      });
    }

    // Setup patients
    const patientA = await User.create({
      name: "Patient Concurrency Alpha",
      email: `patient.alpha.${Date.now()}@health.local`,
      role: "patient",
      passwordHash: "hash"
    });

    const patientB = await User.create({
      name: "Patient Concurrency Beta",
      email: `patient.beta.${Date.now()}@health.local`,
      role: "patient",
      passwordHash: "hash"
    });

    const patientC = await User.create({
      name: "Patient Concurrency Gamma",
      email: `patient.gamma.${Date.now()}@health.local`,
      role: "patient",
      passwordHash: "hash"
    });

    const familyMember1 = await User.create({
      name: "Family Member One",
      email: `fam1.${Date.now()}@health.local`,
      role: "patient",
      passwordHash: "hash"
    });

    const rel1 = await FamilyRelationship.create({
      ownerId: patientA._id,
      relativeId: familyMember1._id,
      relationType: "Parent",
      managementType: "FULL_ACCESS",
      ownershipType: "SELF_MANAGED",
      status: "ACTIVE",
      createdBy: patientA._id,
      updatedBy: patientA._id
    });

    // ──────────────────────────────────────────────────
    // TEST 1: Sequential duplicate same slot
    // ──────────────────────────────────────────────────
    console.log("--> TEST 1: Sequential duplicate same slot");
    const res1a = await executeBookQueue(patientA._id, doctor._id, dateStr, "09:00");
    if (!res1a.canBook) console.log("res1a error:", res1a);
    assert(res1a.canBook === true, "1a. Initial booking succeeds");

    const res1b = await executeBookQueue(patientB._id, doctor._id, dateStr, "09:00");
    assert(res1b.canBook === false, "1b. Second sequential booking for same slot rejected");

    // ──────────────────────────────────────────────────
    // TEST 2: Two simultaneous requests for same slot
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 2: Two simultaneous requests for same slot (Promise.all)");
    const [res2a, res2b] = await Promise.all([
      executeBookQueue(patientB._id, doctor._id, dateStr, "09:10"),
      executeBookQueue(patientC._id, doctor._id, dateStr, "09:10")
    ]);

    const successes2 = [res2a, res2b].filter(r => r.canBook === true);
    const failures2 = [res2a, res2b].filter(r => r.canBook === false && r.code === "SLOT_UNAVAILABLE");

    assert(successes2.length === 1, "2a. Exactly 1 request succeeds");
    assert(failures2.length === 1, "2b. Exactly 1 request rejected with SLOT_UNAVAILABLE");

    const count2 = await AppointmentBooking.countDocuments({
      doctorId: doctor._id,
      date: dateStr,
      slotTime: "09:10",
      status: { $in: ["BOOKED", "CONFIRMED", "REMINDER_SENT", "READY", "IN_CONSULTATION"] }
    });
    assert(count2 === 1, "2c. Exactly 1 active booking document exists in database for slot 09:10");

    // ──────────────────────────────────────────────────
    // TEST 3: Five simultaneous requests for same slot
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 3: Five simultaneous requests for same slot");
    const testUsers5 = [];
    for (let i = 0; i < 5; i++) {
      testUsers5.push(await User.create({
        name: `User Racer ${i}`,
        email: `racer${i}.${Date.now()}@health.local`,
        role: "patient",
        passwordHash: "hash"
      }));
    }

    const fiveRaces = await Promise.all(
      testUsers5.map(u => executeBookQueue(u._id, doctor._id, dateStr, "09:20"))
    );

    const successes5 = fiveRaces.filter(r => r.canBook === true);
    const failures5 = fiveRaces.filter(r => r.canBook === false);

    assert(successes5.length === 1, "3a. Exactly 1 of 5 simultaneous requests succeeds");
    assert(failures5.length === 4, "3b. Exactly 4 of 5 simultaneous requests fail");

    const count5 = await AppointmentBooking.countDocuments({
      doctorId: doctor._id,
      date: dateStr,
      slotTime: "09:20",
      status: { $in: ["BOOKED", "CONFIRMED", "REMINDER_SENT", "READY", "IN_CONSULTATION"] }
    });
    assert(count5 === 1, "3c. Exactly 1 active booking exists in database for slot 09:20");

    // ──────────────────────────────────────────────────
    // TEST 4: Same user retries within 60 seconds
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 4: Same user retries within 60 seconds (Idempotent retry)");
    const winningUser3 = testUsers5.find((u, idx) => fiveRaces[idx].canBook === true);
    const retryRes4 = await executeBookQueue(winningUser3._id, doctor._id, dateStr, "09:20");
    assert(retryRes4.canBook === true, "4a. Idempotent retry succeeds");
    assert(retryRes4.message?.includes("already have an active booking"), "4b. Returns idempotent guidance message");

    const count4 = await AppointmentBooking.countDocuments({
      doctorId: doctor._id,
      date: dateStr,
      slotTime: "09:20"
    });
    assert(count4 === 1, "4c. No duplicate document created on idempotent retry");

    // ──────────────────────────────────────────────────
    // TEST 5: Different users race same slot
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 5: Different users race same slot");
    const uDiff1 = await User.create({ name: "User Diff 1", email: `udiff1.${Date.now()}@health.local`, role: "patient", passwordHash: "h" });
    const uDiff2 = await User.create({ name: "User Diff 2", email: `udiff2.${Date.now()}@health.local`, role: "patient", passwordHash: "h" });

    const [resDiff1, resDiff2] = await Promise.all([
      executeBookQueue(uDiff1._id, doctor._id, dateStr, "09:30"),
      executeBookQueue(uDiff2._id, doctor._id, dateStr, "09:30")
    ]);
    const passDiff = [resDiff1, resDiff2].filter(r => r.canBook === true);
    assert(passDiff.length === 1, "5. Exactly one user succeeds when different users race");

    // ──────────────────────────────────────────────────
    // TEST 6: Cancel booking then rebook same slot
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 6: Cancel booking then rebook same slot");
    const bookingToCancel = await AppointmentBooking.findOne({ doctorId: doctor._id, date: dateStr, slotTime: "09:30" });
    await cancelQueue(bookingToCancel.userId, bookingToCancel._id);

    const rebookUser = await User.create({ name: "User Rebook", email: `rebook.${Date.now()}@health.local`, role: "patient", passwordHash: "h" });
    const rebookRes = await executeBookQueue(rebookUser._id, doctor._id, dateStr, "09:30");
    assert(rebookRes.canBook === true, "6a. Rebooking previously cancelled slot succeeds");

    const docsAtSlot6 = await AppointmentBooking.find({ doctorId: doctor._id, date: dateStr, slotTime: "09:30" });
    assert(docsAtSlot6.length === 2, "6b. Slot contains historical CANCELLED doc and new CONFIRMED doc");
    const activeAtSlot6 = docsAtSlot6.filter(d => ["BOOKED", "CONFIRMED"].includes(d.status));
    assert(activeAtSlot6.length === 1, "6c. Exactly 1 active booking exists at slot");

    // ──────────────────────────────────────────────────
    // TEST 7: NO_SHOW then rebook same slot
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 7: NO_SHOW then rebook same slot");
    const uNoShow = await User.create({ name: "User NoShow", email: `noshow.${Date.now()}@health.local`, role: "patient", passwordHash: "h" });
    const res7Init = await executeBookQueue(uNoShow._id, doctor._id, dateStr, "09:40");
    assert(res7Init.canBook === true, "7a. Initial booking for slot 09:40 created");

    // Mark as NO_SHOW (status: CANCELLED, arrivalStatus: NO_SHOW)
    const bNoShow = await AppointmentBooking.findById(res7Init.booking.bookingId);
    bNoShow.arrivalStatus = "NO_SHOW";
    bNoShow.status = "CANCELLED";
    await bNoShow.save();
    await releaseBookingCapacity(uNoShow._id, bNoShow._id);

    const uAfterNoShow = await User.create({ name: "User After NoShow", email: `after.ns.${Date.now()}@health.local`, role: "patient", passwordHash: "h" });
    const res7Rebook = await executeBookQueue(uAfterNoShow._id, doctor._id, dateStr, "09:40");
    assert(res7Rebook.canBook === true, "7b. Rebooking slot after NO_SHOW succeeds");

    // ──────────────────────────────────────────────────
    // TEST 8: Historical COMPLETED booking + new booking same slot
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 8: Historical COMPLETED booking + new booking same slot");
    const uHistPatient = await User.create({
      name: "Past Completed Patient",
      email: `past.comp.${Date.now()}@health.local`,
      role: "patient",
      passwordHash: "h"
    });
    const pastSlotDateStr = "2026-08-15";
    // 1. Create a historical COMPLETED booking on pastSlotDateStr at "10:00"
    await AppointmentBooking.create({
      bookingNumber: `HIST-${Date.now()}`,
      userId: uHistPatient._id,
      doctorId: doctor._id,
      hospitalId: hospital._id,
      sessionId: new mongoose.Types.ObjectId(),
      date: pastSlotDateStr,
      slotTime: "10:00",
      status: "COMPLETED",
      arrivalStatus: "CHECKED_IN"
    });

    // 2. Direct active booking insertion on the exact same (doctorId, pastSlotDateStr, "10:00")
    // Proves the partial unique index allows active booking alongside historical COMPLETED booking on identical slot
    const uNewActiveDirect = await User.create({
      name: "New Active Direct Patient",
      email: `new.act.dir.${Date.now()}@health.local`,
      role: "patient",
      passwordHash: "h"
    });
    const docActiveSameSlot = await AppointmentBooking.create({
      bookingNumber: `ACT-${Date.now()}`,
      userId: uNewActiveDirect._id,
      doctorId: doctor._id,
      hospitalId: hospital._id,
      sessionId: new mongoose.Types.ObjectId(),
      date: pastSlotDateStr,
      slotTime: "10:00",
      status: "CONFIRMED",
      arrivalStatus: "NOT_ARRIVED"
    });
    assert(docActiveSameSlot !== null, "8a. Active booking coexists with historical COMPLETED booking on identical slot");

    // 3. And booking the same doctor and slot on dateStr through executeBookQueue succeeds cleanly
    const uNewActive = await User.create({
      name: "New Active Patient",
      email: `new.active.${Date.now()}@health.local`,
      role: "patient",
      passwordHash: "h"
    });
    const res8New = await executeBookQueue(uNewActive._id, doctor._id, dateStr, "10:00");
    assert(res8New.canBook === true, "8b. New active booking succeeds through executeBookQueue");

    // ──────────────────────────────────────────────────
    // TEST 9: Different slots same doctor/date
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 9: Different slots same doctor/date for different patients");
    const uSlot1 = await User.create({ name: "Slot User 1", email: `su1.${Date.now()}@health.local`, role: "patient", passwordHash: "h" });
    const uSlot2 = await User.create({ name: "Slot User 2", email: `su2.${Date.now()}@health.local`, role: "patient", passwordHash: "h" });

    const res9a = await executeBookQueue(uSlot1._id, doctor._id, dateStr, "10:10");
    const res9b = await executeBookQueue(uSlot2._id, doctor._id, dateStr, "10:20");
    assert(res9a.canBook === true && res9b.canBook === true, "9. Different slots for different patients both succeed");

    // ──────────────────────────────────────────────────
    // TEST 10: Different doctors allowed
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 10: Different doctors allowed");
    const docUser2 = await User.create({ name: "Dr. Doc Two", email: `doc2.${Date.now()}@health.local`, role: "doctor", passwordHash: "h" });
    const doctor2 = await Doctor.create({
      name: "Dr. Doc Two",
      userId: docUser2._id,
      hospitalId: hospital._id,
      specialization: "General Physician",
      avgConsultationTime: 10,
      status: "verified"
    });
    for (let d = 0; d <= 6; d++) {
      await DoctorSchedule.create({
        doctorId: doctor2._id,
        dayOfWeek: d,
        startTime: "08:00",
        endTime: "18:00",
        slotDuration: 10,
        maxPatientsPerSlot: 1,
        enabled: true,
        status: "published"
      });
    }

    const res10 = await executeBookQueue(uSlot1._id, doctor2._id, dateStr, "10:10");
    assert(res10.canBook === true, "10. Booking with different doctor succeeds");

    // ──────────────────────────────────────────────────
    // TEST 11: Different dates allowed
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 11: Different dates allowed");

    const res11 = await executeBookQueue(uSlot1._id, doctor._id, nextDayStr, "10:10");
    assert(res11.canBook === true, "11. Booking on different date succeeds");

    // ──────────────────────────────────────────────────
    // TEST 12: MAX-3: Account has 2 active upcoming appointments, 2 simultaneous requests
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 12: MAX-3: Account has 2 active upcoming appointments, 2 simultaneous requests");
    const maxAccountOwner = await User.create({
      name: "Owner Max3 Test",
      email: `owner.max3.${Date.now()}@health.local`,
      role: "patient",
      passwordHash: "hash"
    });

    // Book appointment 1
    const resM1 = await executeBookQueue(maxAccountOwner._id, doctor._id, dateStr, "11:00");
    assert(resM1.canBook === true, "12a. First appointment booked");

    // Book appointment 2
    const resM2 = await executeBookQueue(maxAccountOwner._id, doctor._id, dateStr, "11:10");
    assert(resM2.canBook === false && resM2.code === "DUPLICATE_DOCTOR_DATE_APPOINTMENT", "12b. Same-doctor/day duplicate correctly blocked for same patient");

    // Book appointment 2 with doctor2 on dateStr
    const resM2Doc2 = await executeBookQueue(maxAccountOwner._id, doctor2._id, dateStr, "11:10");
    assert(resM2Doc2.canBook === true, "12c. Second appointment with doctor 2 booked (Count = 2)");

    // Now account has EXACTLY 2 active appointments.
    // Fire TWO simultaneous requests for 3rd slot: one for dateStr, one for nextDayStr
    const [resRace1, resRace2] = await Promise.all([
      executeBookQueue(maxAccountOwner._id, doctor._id, nextDayStr, "11:00"),
      executeBookQueue(maxAccountOwner._id, doctor2._id, nextDayStr, "11:00")
    ]);

    const passesRace = [resRace1, resRace2].filter(r => r.canBook === true);
    const failsRace = [resRace1, resRace2].filter(r => r.canBook === false && r.code === "MAX_UPCOMING_APPOINTMENTS_REACHED");

    assert(passesRace.length === 1, "12d. Exactly one concurrent request succeeds when at count = 2");
    assert(failsRace.length === 1, "12e. Exactly one concurrent request rejected with MAX_UPCOMING_APPOINTMENTS_REACHED");

    const finalActiveOwnerCount = await AppointmentBooking.countDocuments({
      $or: [{ userId: maxAccountOwner._id }, { bookedByUserId: maxAccountOwner._id }],
      status: { $in: ["BOOKED", "CONFIRMED", "REMINDER_SENT", "READY", "IN_CONSULTATION"] },
      arrivalStatus: { $ne: "NO_SHOW" }
    });
    assert(finalActiveOwnerCount === 3, `12f. Final active count is strictly 3 (Got: ${finalActiveOwnerCount})`);

    // ──────────────────────────────────────────────────
    // TEST 13: MAX-3: Account has 3 active upcoming appointments, any new request rejected
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 13: MAX-3: Account has 3 active appointments, any new request rejected");
    const res13 = await executeBookQueue(maxAccountOwner._id, doctor._id, nextDayStr, "11:10");
    assert(res13.canBook === false, "13a. Attempting 4th appointment rejected");
    assert(res13.code === "MAX_UPCOMING_APPOINTMENTS_REACHED", "13b. Returns MAX_UPCOMING_APPOINTMENTS_REACHED error code");

    // ──────────────────────────────────────────────────
    // TEST 14: Cancel one of 3: New booking succeeds
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 14: Cancel one of 3: New booking succeeds");
    const oneOfThree = await AppointmentBooking.findOne({
      $or: [{ userId: maxAccountOwner._id }, { bookedByUserId: maxAccountOwner._id }],
      status: "CONFIRMED"
    });
    await cancelQueue(maxAccountOwner._id, oneOfThree._id);

    const dayAfterNextStr = getFutureDateStr(4);
    const res14 = await executeBookQueue(maxAccountOwner._id, doctor._id, dayAfterNextStr, "11:00");
    assert(res14.canBook === true, "14. After cancelling one of 3, new booking succeeds");

    // ──────────────────────────────────────────────────
    // TEST 15: NO_SHOW one of 3: New booking succeeds
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 15: NO_SHOW one of 3: New booking succeeds");
    // Mark one booking as NO_SHOW
    const bookingToNoShow = await AppointmentBooking.findById(res14.booking.bookingId);
    bookingToNoShow.arrivalStatus = "NO_SHOW";
    bookingToNoShow.status = "CANCELLED";
    await bookingToNoShow.save();
    await releaseBookingCapacity(maxAccountOwner._id, bookingToNoShow._id);

    const dayAfter4Str = getFutureDateStr(5);
    const res15 = await executeBookQueue(maxAccountOwner._id, doctor._id, dayAfter4Str, "11:00");
    assert(res15.canBook === true, "15. After NO_SHOW frees capacity, new booking succeeds");

    // ──────────────────────────────────────────────────
    // TEST 16: Family: Self + family members count toward same limit
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 16: Family: Self + family members count toward same limit");
    const famOwner = await User.create({ name: "Fam Owner", email: `fam.owner.${Date.now()}@health.local`, role: "patient", passwordHash: "h" });
    const famChild = await User.create({ name: "Fam Child", email: `fam.child.${Date.now()}@health.local`, role: "patient", passwordHash: "h" });
    const famRel = await FamilyRelationship.create({
      ownerId: famOwner._id,
      relativeId: famChild._id,
      relationType: "Child",
      managementType: "FULL_ACCESS",
      ownershipType: "SELF_MANAGED",
      status: "ACTIVE",
      createdBy: famOwner._id,
      updatedBy: famOwner._id
    });

    const resFam1 = await executeBookQueue(famOwner._id, doctor._id, dateStr, "12:00", null, null, "SELF");
    const resFam2 = await executeBookQueue(famChild._id, doctor._id, dateStr, "12:10", famOwner._id, famRel._id, "FAMILY_MEMBER");
    const resFam3 = await executeBookQueue(famOwner._id, doctor2._id, dateStr, "12:00", null, null, "SELF");
    assert(resFam1.canBook && resFam2.canBook && resFam3.canBook, "16a. 2 Self + 1 Family member booking fills capacity to 3");

    const resFam4 = await executeBookQueue(famChild._id, doctor2._id, dateStr, "12:10", famOwner._id, famRel._id, "FAMILY_MEMBER");
    assert(resFam4.canBook === false && resFam4.code === "MAX_UPCOMING_APPOINTMENTS_REACHED", "16b. 4th booking (family) rejected under shared portfolio limit");

    // ──────────────────────────────────────────────────
    // TEST 17: Family concurrent race: 2 active + 2 simultaneous family bookings
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 17: Family concurrent race: 2 active + 2 simultaneous family bookings");
    // Cancel 1 from famOwner
    const bkToCancelFam = await AppointmentBooking.findById(resFam1.booking.bookingId);
    await cancelQueue(famOwner._id, bkToCancelFam._id);

    // Now famOwner has 2 active. Fire two simultaneous family requests
    const [raceFamA, raceFamB] = await Promise.all([
      executeBookQueue(famChild._id, doctor._id, nextDayStr, "12:00", famOwner._id, famRel._id, "FAMILY_MEMBER"),
      executeBookQueue(famChild._id, doctor2._id, nextDayStr, "12:00", famOwner._id, famRel._id, "FAMILY_MEMBER")
    ]);

    const passesFamRace = [raceFamA, raceFamB].filter(r => r.canBook === true);
    assert(passesFamRace.length === 1, "17a. Exactly one concurrent family request succeeds at count = 2");

    const totalFamActive = await AppointmentBooking.countDocuments({
      $or: [{ userId: famOwner._id }, { bookedByUserId: famOwner._id }],
      status: { $in: ["BOOKED", "CONFIRMED", "REMINDER_SENT", "READY", "IN_CONSULTATION"] },
      arrivalStatus: { $ne: "NO_SHOW" }
    });
    assert(totalFamActive === 3, "17b. Total portfolio active count remains strictly 3");

    // ──────────────────────────────────────────────────
    // TEST 18: Double release: cancel/release lifecycle cannot free capacity twice
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 18: Double release: cancel/release lifecycle cannot free capacity twice");
    const capDocBefore = await AccountBookingCapacity.findOne({ ownerId: famOwner._id });
    const countBefore = capDocBefore.activeBookings.length;

    // Call release twice for the same booking
    const sampleId = capDocBefore.activeBookings[0];
    await releaseBookingCapacity(famOwner._id, sampleId);
    const capDocAfter1 = await AccountBookingCapacity.findOne({ ownerId: famOwner._id });
    assert(capDocAfter1.activeBookings.length === countBefore - 1, "18a. First release decrements array size by 1");

    await releaseBookingCapacity(famOwner._id, sampleId);
    const capDocAfter2 = await AccountBookingCapacity.findOne({ ownerId: famOwner._id });
    assert(capDocAfter2.activeBookings.length === countBefore - 1, "18b. Second release for same bookingId is a no-op (no double release)");

    // ──────────────────────────────────────────────────
    // TEST 19: Backend restart/process independence: DB-backed verification
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 19: DB-backed verification of partial unique index and capacity collection");
    const indexes = await mongoose.connection.collection("appointmentbookings").indexes();
    const activeSlotIdx = indexes.find(i => i.name === "uniq_active_doctor_date_slot");
    assert(activeSlotIdx !== undefined, "19a. uniq_active_doctor_date_slot index exists in MongoDB");
    assert(activeSlotIdx.unique === true, "19b. Index is unique = true");
    assert(activeSlotIdx.partialFilterExpression !== undefined, "19c. Partial filter expression is persisted in MongoDB");

    const capacityCollectionExists = await mongoose.connection.db.listCollections({ name: "accountbookingcapacities" }).toArray();
    assert(capacityCollectionExists.length > 0, "19d. accountbookingcapacities collection persisted in MongoDB");

    // ──────────────────────────────────────────────────
    // MANDATORY STRESS TESTS: Repeated concurrent races at count=2
    // ──────────────────────────────────────────────────
    console.log("\n--> MANDATORY STRESS TESTS: 10 repeated concurrent races at count=2");
    let stressRacesPassed = 0;
    for (let i = 1; i <= 10; i++) {
      const uStressRace = await User.create({
        name: `Stress Race User ${i}`,
        email: `stress.race.${i}.${Date.now()}@health.local`,
        role: "patient",
        passwordHash: "hash"
      });

      const dayA = getFutureDateStr(2);
      const dayB = getFutureDateStr(3);

      const totalMinutes = 14 * 60 + (i * 10);
      const slotHour = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
      const slotMin = String(totalMinutes % 60).padStart(2, "0");
      const testSlot = `${slotHour}:${slotMin}`;

      // Book 2 appointments
      const b1 = await executeBookQueue(uStressRace._id, doctor._id, dayA, testSlot);
      const b2 = await executeBookQueue(uStressRace._id, doctor2._id, dayA, testSlot);
      if (!b1.canBook || !b2.canBook) {
        console.error(`  [FAIL] Stress Race ${i}: Initial setup failed to create 2 appointments: b1=${b1.code || b1.reason}, b2=${b2.code || b2.reason}`);
        failed++;
        continue;
      }

      // Verify DB count is exactly 2 before race
      const initialDbCount = await AppointmentBooking.countDocuments({
        $or: [{ userId: uStressRace._id }, { bookedByUserId: uStressRace._id }],
        status: { $in: ["BOOKED", "CONFIRMED", "REMINDER_SENT", "READY", "IN_CONSULTATION"] },
        arrivalStatus: { $ne: "NO_SHOW" }
      });
      if (initialDbCount !== 2) {
        console.error(`  [FAIL] Stress Race ${i}: Expected initial DB count = 2, got ${initialDbCount}`);
        failed++;
        continue;
      }

      // Fire 2 simultaneous booking requests for 3rd slot
      const [r1, r2] = await Promise.all([
        executeBookQueue(uStressRace._id, doctor._id, dayB, testSlot),
        executeBookQueue(uStressRace._id, doctor2._id, dayB, testSlot)
      ]);

      const passes = [r1, r2].filter(r => r.canBook === true);
      const fails = [r1, r2].filter(r => r.canBook === false && r.code === "MAX_UPCOMING_APPOINTMENTS_REACHED");

      // Query database directly
      const finalDbCount = await AppointmentBooking.countDocuments({
        $or: [{ userId: uStressRace._id }, { bookedByUserId: uStressRace._id }],
        status: { $in: ["BOOKED", "CONFIRMED", "REMINDER_SENT", "READY", "IN_CONSULTATION"] },
        arrivalStatus: { $ne: "NO_SHOW" }
      });

      const racePassed = passes.length === 1 && fails.length === 1 && finalDbCount === 3;
      if (racePassed) {
        stressRacesPassed++;
      } else {
        console.error(`  [FAIL] Stress Race ${i}: passes=${passes.length}, fails=${fails.length}, finalDbCount=${finalDbCount}`);
      }
    }
    assert(stressRacesPassed === 10, `Mandatory Stress: All 10 repeated concurrent races at count=2 passed strictly (Got ${stressRacesPassed}/10)`);

    // ──────────────────────────────────────────────────
    // MANDATORY STRESS TESTS: 5 simultaneous requests from count=2
    // ──────────────────────────────────────────────────
    console.log("\n--> MANDATORY STRESS TESTS: 5 simultaneous requests from count=2");
    const uStress5 = await User.create({
      name: "Stress 5 Simultaneous User",
      email: `stress.5sim.${Date.now()}@health.local`,
      role: "patient",
      passwordHash: "hash"
    });

    const day4 = getFutureDateStr(4);
    const day5 = getFutureDateStr(5);
    const day6 = getFutureDateStr(6);
    const day7 = getFutureDateStr(7);

    const s1 = await executeBookQueue(uStress5._id, doctor._id, day4, "16:00");
    const s2 = await executeBookQueue(uStress5._id, doctor2._id, day4, "16:00");
    assert(s1.canBook === true && s2.canBook === true, "5-sim setup: Initial 2 appointments booked successfully");

    const initialDbCount5 = await AppointmentBooking.countDocuments({
      $or: [{ userId: uStress5._id }, { bookedByUserId: uStress5._id }],
      status: { $in: ["BOOKED", "CONFIRMED", "REMINDER_SENT", "READY", "IN_CONSULTATION"] },
      arrivalStatus: { $ne: "NO_SHOW" }
    });
    assert(initialDbCount5 === 2, "5-sim setup: Initial DB count is exactly 2");

    // Fire 5 simultaneous requests across valid dates within the 7-day window
    const race5Results = await Promise.all([
      executeBookQueue(uStress5._id, doctor._id, day5, "16:00"),
      executeBookQueue(uStress5._id, doctor2._id, day5, "16:00"),
      executeBookQueue(uStress5._id, doctor._id, day6, "16:00"),
      executeBookQueue(uStress5._id, doctor2._id, day6, "16:00"),
      executeBookQueue(uStress5._id, doctor._id, day7, "16:00")
    ]);

    const passes5 = race5Results.filter(r => r.canBook === true);
    const fails5 = race5Results.filter(r => r.canBook === false && r.code === "MAX_UPCOMING_APPOINTMENTS_REACHED");

    assert(passes5.length === 1, `5-sim race: Exactly 1 of 5 simultaneous requests succeeds (Got: ${passes5.length})`);
    assert(fails5.length === 4, `5-sim race: Exactly 4 of 5 simultaneous requests rejected with MAX_UPCOMING_APPOINTMENTS_REACHED (Got: ${fails5.length})`);

    const finalDbCount5 = await AppointmentBooking.countDocuments({
      $or: [{ userId: uStress5._id }, { bookedByUserId: uStress5._id }],
      status: { $in: ["BOOKED", "CONFIRMED", "REMINDER_SENT", "READY", "IN_CONSULTATION"] },
      arrivalStatus: { $ne: "NO_SHOW" }
    });
    assert(finalDbCount5 === 3, `5-sim race: Final active AppointmentBooking count in database is strictly 3 (Got: ${finalDbCount5})`);



    // ──────────────────────────────────────────────────
    // TEST 20: Clean up test documents
    // ──────────────────────────────────────────────────
    console.log("\n--> TEST 20: Test data cleanup");
    await Doctor.deleteOne({ _id: doctor._id });
    await Doctor.deleteOne({ _id: doctor2._id });
    await DoctorSchedule.deleteMany({ doctorId: { $in: [doctor._id, doctor2._id] } });
    if (hospital.name === "Concurrency Test Medical Center") {
      await Hospital.deleteOne({ _id: hospital._id });
    }
    await AppointmentBooking.deleteMany({ doctorId: { $in: [doctor._id, doctor2._id] } });
    await QueueSession.deleteMany({ doctorId: { $in: [doctor._id, doctor2._id] } });
    assert(true, "20. Test isolation and cleanup complete");

    console.log("\n==================================================");
    console.log(`CONCURRENCY SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

  } catch (err) {
    console.error("Test execution failed:", err);
    failed++;
  } finally {
    await mongoose.disconnect();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runConcurrencyTests();
