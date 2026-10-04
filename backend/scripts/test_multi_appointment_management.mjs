import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });
process.env.NODE_ENV = "test";

import Doctor from "../src/modules/doctor/doctor.model.js";
import Hospital from "../src/modules/hospital/hospital.model.js";
import User from "../src/modules/auth/auth.model.js";
import DoctorSchedule from "../src/modules/doctor/doctor_schedule.model.js";
import AppointmentBooking from "../src/modules/queue/appointment_booking.model.js";
import Queue from "../src/modules/queue/queue.model.js";
import QueueSession from "../src/modules/queue/queueSession.model.js";
import FamilyRelationship from "../src/modules/user/family_relationship.model.js";
import ReminderQueue from "../src/modules/queue/reminder_queue.model.js";
import { executeBookQueue, getMyQueue, cancelQueue } from "../src/modules/queue/queue.service.js";
import { checkInAppointment } from "../src/modules/queue/appointment_orchestration.service.js";
import { getFamilyMembers } from "../src/modules/user/family.service.js";
import { getTodayIST } from "../src/modules/search/utils.js";

async function runMultiAppointmentTests() {
  console.log("==================================================");
  console.log("MULTI-APPOINTMENT & APPOINTMENT HUB VERIFICATION");
  console.log("==================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  const todayStr = getTodayIST();
  
  // Future dates helper (e.g. +1 day, +2 days)
  const getFutureDateStr = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const tomorrowStr = getFutureDateStr(1);
  const dayAfterTomorrowStr = getFutureDateStr(2);
  const nextWeekStr = getFutureDateStr(3);

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

  // Generate unique test emails to avoid conflicts
  const testRunId = Date.now();
  const ownerEmail = `test_owner_${testRunId}@example.com`;
  const relativeEmail1 = `test_rel1_${testRunId}@example.com`;
  const relativeEmail2 = `test_rel2_${testRunId}@example.com`;
  const otherUserEmail = `test_other_${testRunId}@example.com`;

  try {
    // 0. Setup shared test hospital & doctors
    let hospital = await Hospital.findOne();
    if (!hospital) {
      hospital = await Hospital.create({
        name: "Metro General Hospital",
        address: "100 Health Way",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
        contactNumber: "9876543210",
        emergencyContactNumber: "9876543211",
        status: "active"
      });
    }

    const doctorUserA = await User.create({
      name: `Dr. Multi Alpha ${testRunId}`,
      email: `dr_alpha_${testRunId}@example.com`,
      passwordHash: "hash123",
      role: "doctor",
      status: "active"
    });

    const doctorA = await Doctor.create({
      userId: doctorUserA._id,
      name: `Dr. Multi Alpha ${testRunId}`,
      hospitalId: hospital._id,
      specialization: "Cardiology",
      avgConsultationTime: 15,
      status: "verified",
      availabilityState: "available",
      profileCompleted: true,
      defaultQueueLimit: 50
    });

    const doctorUserB = await User.create({
      name: `Dr. Multi Beta ${testRunId}`,
      email: `dr_beta_${testRunId}@example.com`,
      passwordHash: "hash123",
      role: "doctor",
      status: "active"
    });

    const doctorB = await Doctor.create({
      userId: doctorUserB._id,
      name: `Dr. Multi Beta ${testRunId}`,
      hospitalId: hospital._id,
      specialization: "Pediatrics",
      avgConsultationTime: 10,
      status: "verified",
      availabilityState: "available",
      profileCompleted: true,
      defaultQueueLimit: 50
    });

    // Setup Published Schedules for both doctors for all days of the week
    for (let day = 0; day <= 6; day++) {
      await DoctorSchedule.create({
        doctorId: doctorA._id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "17:00",
        status: "published",
        version: 1
      });
      await DoctorSchedule.create({
        doctorId: doctorB._id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "17:00",
        status: "published",
        version: 1
      });
    }

    // Setup Account Owner User
    const owner = await User.create({
      name: `Vikash Kumar ${testRunId}`,
      email: ownerEmail,
      passwordHash: "hash123",
      role: "patient",
      status: "active"
    });

    // Setup Family Members
    const familyMember1 = await User.create({
      name: `Anita Devi ${testRunId}`,
      email: relativeEmail1,
      passwordHash: "hash123",
      role: "patient",
      status: "active"
    });

    const rel1 = await FamilyRelationship.create({
      ownerId: owner._id,
      relativeId: familyMember1._id,
      relationType: "Parent",
      managementType: "FULL_ACCESS",
      ownershipType: "SELF_MANAGED",
      status: "ACTIVE",
      createdBy: owner._id,
      updatedBy: owner._id
    });

    const familyMember2 = await User.create({
      name: `Rahul Kumar ${testRunId}`,
      email: relativeEmail2,
      passwordHash: "hash123",
      role: "patient",
      status: "active"
    });

    const rel2 = await FamilyRelationship.create({
      ownerId: owner._id,
      relativeId: familyMember2._id,
      relationType: "Child",
      managementType: "FULL_ACCESS",
      ownershipType: "SELF_MANAGED",
      status: "ACTIVE",
      createdBy: owner._id,
      updatedBy: owner._id
    });

    // Setup Unrelated User
    const otherUser = await User.create({
      name: `Other Patient ${testRunId}`,
      email: otherUserEmail,
      passwordHash: "hash123",
      role: "patient",
      status: "active"
    });

    console.log("--- PART 1: MULTIPLE BOOKINGS & LIMIT (MAX_UPCOMING_APPOINTMENTS = 3) ---");

    // 1. One upcoming appointment succeeds
    const book1 = await executeBookQueue(owner._id, doctorA._id, tomorrowStr, "09:00", owner._id, null, "SELF");
    assert(book1.canBook === true && book1.booking?.bookingNumber, "1. One upcoming appointment succeeds");

    // 2. Second upcoming appointment succeeds (different doctor, same or different date)
    const book2 = await executeBookQueue(owner._id, doctorB._id, tomorrowStr, "10:00", owner._id, null, "SELF");
    assert(book2.canBook === true && book2.booking?.bookingNumber, "2. Second upcoming appointment succeeds");

    // 3. Third upcoming appointment succeeds (family member booking for Mother)
    const book3 = await executeBookQueue(familyMember1._id, doctorA._id, dayAfterTomorrowStr, "09:00", owner._id, rel1._id, "FAMILY_MEMBER");
    assert(book3.canBook === true && book3.booking?.bookingNumber, "3. Third upcoming appointment succeeds (Family member: Mother)");

    // 4. Fourth upcoming appointment is rejected (Limit reached)
    const book4 = await executeBookQueue(familyMember2._id, doctorB._id, dayAfterTomorrowStr, "11:00", owner._id, rel2._id, "FAMILY_MEMBER");
    assert(book4.canBook === false && book4.code === "MAX_UPCOMING_APPOINTMENTS_REACHED", "4. Fourth upcoming appointment is rejected with MAX_UPCOMING_APPOINTMENTS_REACHED");

    console.log("--- PART 2: TERMINAL STATES RESTORE BOOKING CAPACITY ---");

    // 5. Cancel one appointment and fourth booking becomes possible
    const cancelRes = await cancelQueue(owner._id, book1.booking.bookingId);
    assert(cancelRes !== null, "Cancel targeting Appointment 1 succeeds");

    const book4Retry = await executeBookQueue(familyMember2._id, doctorB._id, dayAfterTomorrowStr, "11:00", owner._id, rel2._id, "FAMILY_MEMBER");
    assert(book4Retry.canBook === true && book4Retry.booking?.bookingNumber, "5. Cancel one appointment and fourth booking becomes possible");

    // 6. Completed appointment no longer counts toward limit
    const bookToComplete = await AppointmentBooking.findById(book2.booking.bookingId);
    bookToComplete.status = "COMPLETED";
    await bookToComplete.save();

    const book5 = await executeBookQueue(owner._id, doctorA._id, nextWeekStr, "09:30", owner._id, null, "SELF");
    assert(book5.canBook === true && book5.booking?.bookingNumber, "6. Completed appointment no longer counts toward limit");

    // 7. No-show appointment no longer counts toward limit
    const bookToNoShow = await AppointmentBooking.findById(book5.booking.bookingId);
    bookToNoShow.arrivalStatus = "NO_SHOW";
    bookToNoShow.status = "CANCELLED";
    await bookToNoShow.save();

    const book6 = await executeBookQueue(owner._id, doctorB._id, nextWeekStr, "14:00", owner._id, null, "SELF");
    assert(book6.canBook === true && book6.booking?.bookingNumber, "7. No-show appointment no longer counts toward limit");

    console.log("--- PART 3: PORTFOLIO & FAMILY RETRIEVAL ---");

    // 8. Self + family appointments count toward same account limit
    const activeCount = await AppointmentBooking.countDocuments({
      $or: [{ userId: owner._id }, { bookedByUserId: owner._id }],
      status: { $in: ["BOOKED", "CONFIRMED", "REMINDER_SENT", "READY", "IN_CONSULTATION"] },
      arrivalStatus: { $ne: "NO_SHOW" }
    });
    assert(activeCount <= 3, "8. Self + family appointments count toward same account limit");

    // 9. Self + family appointments are both retrievable via getMyQueue
    const myQueueData = await getMyQueue(owner._id);
    assert(Array.isArray(myQueueData.upcomingAppointments), "9a. getMyQueue returns upcomingAppointments array");
    const hasSelf = myQueueData.upcomingAppointments.some(a => a.bookedForType === "SELF");
    const hasFamily = myQueueData.upcomingAppointments.some(a => a.bookedForType === "FAMILY_MEMBER");
    assert(hasSelf && hasFamily, "9b. Self + family appointments are both retrievable in upcomingAppointments");

    console.log("--- PART 4: APPOINTMENT COMBINATIONS & DUPLICATE RULES ---");

    // Clean up temporary active bookings for this user to test combinatorial matrix
    await AppointmentBooking.updateMany(
      { $or: [{ userId: owner._id }, { bookedByUserId: owner._id }] },
      { $set: { status: "CANCELLED" } }
    );

    // 10. Different doctors allowed
    const combDocA = await executeBookQueue(owner._id, doctorA._id, tomorrowStr, "09:00", owner._id, null, "SELF");
    const combDocB = await executeBookQueue(owner._id, doctorB._id, tomorrowStr, "10:00", owner._id, null, "SELF");
    assert(combDocA.canBook === true && combDocB.canBook === true, "10. Different doctors allowed on same date");

    // 11. Different dates allowed
    const combDate1 = await executeBookQueue(familyMember1._id, doctorA._id, dayAfterTomorrowStr, "09:00", owner._id, rel1._id, "FAMILY_MEMBER");
    assert(combDate1.canBook === true, "11. Different dates allowed across appointments");

    // Reset for specific duplicate tests
    await AppointmentBooking.updateMany(
      { $or: [{ userId: owner._id }, { bookedByUserId: owner._id }] },
      { $set: { status: "CANCELLED" } }
    );

    // 12. Same doctor different dates allowed
    const sameDocDate1 = await executeBookQueue(owner._id, doctorA._id, tomorrowStr, "09:00", owner._id, null, "SELF");
    const sameDocDate2 = await executeBookQueue(owner._id, doctorA._id, dayAfterTomorrowStr, "09:00", owner._id, null, "SELF");
    assert(sameDocDate1.canBook === true && sameDocDate2.canBook === true, "12. Same doctor on different dates is allowed");

    // 13. Different doctors same date allowed
    const diffDocSameDate = await executeBookQueue(owner._id, doctorB._id, tomorrowStr, "11:00", owner._id, null, "SELF");
    assert(diffDocSameDate.canBook === true, "13. Different doctors on the same date is allowed");

    // 14. Same patient + same doctor + same date + different slot rejected
    // Reset so limit 3 is not hit
    await AppointmentBooking.updateMany(
      { $or: [{ userId: owner._id }, { bookedByUserId: owner._id }] },
      { $set: { status: "CANCELLED" } }
    );

    const baseAppt = await executeBookQueue(owner._id, doctorA._id, tomorrowStr, "09:00", owner._id, null, "SELF");
    assert(baseAppt.canBook === true, "Base appointment established for duplicate test");

    const diffSlotSameDay = await executeBookQueue(owner._id, doctorA._id, tomorrowStr, "09:30", owner._id, null, "SELF");
    assert(diffSlotSameDay.canBook === false && diffSlotSameDay.code === "DUPLICATE_DOCTOR_DATE_APPOINTMENT",
      "14. Same patient + same doctor + same date + different slot rejected with DUPLICATE_DOCTOR_DATE_APPOINTMENT");

    // 15. Exact duplicate rejected (same doctor, same date, same slot)
    // Note: When called within 60s, existing idempotency returns existing booking. Beyond or forced new, DUPLICATE_BOOKING.
    const exactDup = await executeBookQueue(owner._id, doctorA._id, tomorrowStr, "09:00", owner._id, null, "SELF");
    assert(exactDup.guidance?.includes("idempotent retry") || exactDup.code === "DUPLICATE_BOOKING",
      "15. Exact duplicate protected (returns idempotent retry or DUPLICATE_BOOKING without duplicate record creation)");

    // 16. Different family member + same doctor/date/different slot allowed
    const familyMemberAppt = await executeBookQueue(familyMember1._id, doctorA._id, tomorrowStr, "09:30", owner._id, rel1._id, "FAMILY_MEMBER");
    assert(familyMemberAppt.canBook === true, "16. Different family member with same doctor on same date at different slot is allowed");

    console.log("--- PART 5: APPOINTMENTS HUB DATA SHAPE & CHRONOLOGICAL SORTING ---");

    // Book a 3rd appointment with date further in future
    const thirdAppt = await executeBookQueue(familyMember2._id, doctorB._id, nextWeekStr, "10:00", owner._id, rel2._id, "FAMILY_MEMBER");

    const retrievalResult = await getMyQueue(owner._id);

    // 17. Appointments returned as array
    assert(Array.isArray(retrievalResult.upcomingAppointments) && retrievalResult.upcomingAppointments.length === 3,
      "17. Appointments returned as array with exactly 3 items");

    // 18. Chronological sorting correct (date ASC, slotTime ASC)
    const list = retrievalResult.upcomingAppointments;
    const sorted = [...list].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.slotTime.localeCompare(b.slotTime);
    });
    const isChronological = JSON.stringify(list.map(a => a._id)) === JSON.stringify(sorted.map(a => a._id));
    assert(isChronological, "18. Appointments returned in ascending chronological order (date, slotTime)");

    console.log("--- PART 6: LIVE QUEUE SEPARATION ---");

    // Simulate check-in for today's appointment
    // First, book an appointment for today
    await AppointmentBooking.updateMany(
      { $or: [{ userId: owner._id }, { bookedByUserId: owner._id }] },
      { $set: { status: "CANCELLED" } }
    );

    const todayBooking = await executeBookQueue(owner._id, doctorA._id, todayStr, "14:00", owner._id, null, "SELF");
    const futureBookingB = await executeBookQueue(owner._id, doctorB._id, tomorrowStr, "10:00", owner._id, null, "SELF");
    const futureBookingC = await executeBookQueue(familyMember1._id, doctorA._id, nextWeekStr, "09:00", owner._id, rel1._id, "FAMILY_MEMBER");

    // Check in today's appointment using targeted check-in
    const checkedInDoc = await checkInAppointment(todayBooking.booking.bookingNumber, hospital._id, "app");
    assert(checkedInDoc.arrivalStatus === "CHECKED_IN", "Today's appointment successfully checked in");

    // Query active queue session and create active Queue entry as receptionist/check-in does
    const liveQueueEntry = await Queue.create({
      userId: owner._id,
      doctorId: doctorA._id,
      sessionId: todayBooking.booking.sessionId || (await QueueSession.findOne({ doctorId: doctorA._id, date: todayStr }))._id,
      queueNumber: 7,
      status: "waiting",
      isActive: true,
      slotTime: "14:00"
    });

    const liveMyQueue = await getMyQueue(owner._id);

    // 19. Live queue separated from upcoming appointments
    assert(liveMyQueue.liveQueue !== null && liveMyQueue.liveQueue.queueNumber === 7,
      "19. Live queue is present and distinct from generic booking state");

    // 20. Live queue does not replace other upcoming appointments
    assert(Array.isArray(liveMyQueue.upcomingAppointments) && liveMyQueue.upcomingAppointments.length === 3,
      "20. Live queue exists alongside upcoming appointments without replacing or hiding them");

    console.log("--- PART 7: TARGETED CANCELLATION & CHECK-IN ---");

    // 21. Cancel targets exact booking
    const targetCancelId = futureBookingB.booking.bookingId;
    await cancelQueue(owner._id, targetCancelId);
    const postCancelTarget = await AppointmentBooking.findById(targetCancelId);
    assert(postCancelTarget.status === "CANCELLED", "21. Target appointment B is cancelled");

    // 22. Cancelling A leaves B/C untouched
    const apptTodayAfterCancel = await AppointmentBooking.findById(todayBooking.booking.bookingId);
    const apptCAfterCancel = await AppointmentBooking.findById(futureBookingC.booking.bookingId);
    assert(["READY", "CONFIRMED"].includes(apptTodayAfterCancel.status) && apptCAfterCancel.status === "CONFIRMED",
      "22. Cancelling appointment B leaves appointment A (today) and C (future) active and uncancelled");

    // Clean up live queue
    liveQueueEntry.isActive = false;
    await liveQueueEntry.save();

    // 23. Check-in targets exact booking
    // Create new booking for check-in targeting test
    const targetBookingForCheckin = await executeBookQueue(owner._id, doctorB._id, todayStr, "16:00", owner._id, null, "SELF");
    const checkedInByRef = await checkInAppointment(targetBookingForCheckin.booking.bookingNumber, hospital._id, "app");
    assert(checkedInByRef.bookingNumber === targetBookingForCheckin.booking.bookingNumber,
      "23. Check-in targets exact booking by bookingNumber");

    console.log("--- PART 8: FAMILY VISIBILITY & AUTHORIZATION ---");

    // 24. Family appointment visible to account owner
    const myQueueWithFamily = await getMyQueue(owner._id);
    const familyCard = myQueueWithFamily.upcomingAppointments.find(a => a.patientId.toString() === familyMember1._id.toString());
    assert(familyCard !== undefined && familyCard.relationLabel === "Parent",
      "24. Family appointment visible to account owner with relationLabel Parent");

    // 25. Unrelated user's appointment inaccessible
    let unauthorizedCancelFailed = false;
    try {
      await cancelQueue(otherUser._id, futureBookingC.booking.bookingId);
    } catch (authErr) {
      if (authErr.status === 403 || authErr.message.includes("Access denied")) {
        unauthorizedCancelFailed = true;
      }
    }
    assert(unauthorizedCancelFailed, "25. Unrelated user cannot cancel an appointment they do not own (403 Access Denied)");

    // 26. Dashboard remains functional (getMyQueue returns compatible top-level shape)
    assert(myQueueWithFamily.bookingNumber !== undefined && myQueueWithFamily.status !== undefined,
      "26. Dashboard backward compatibility: getMyQueue returns top-level appointment properties");

    // 27. Family service activeBooking populated for upcoming booking
    const familyMembersList = await getFamilyMembers(owner._id);
    const rel1Obj = familyMembersList.find(r => r.relativeId._id.toString() === familyMember1._id.toString());
    assert(rel1Obj?.activeBooking !== null && rel1Obj?.activeBooking?.isUpcoming === true,
      "27. Family service reflects upcoming booking when no active live Queue is present");

    // 28. Notification and reminder booking specificity
    // Schedule reminders for appointment C
    const { scheduleReminders } = await import("../src/modules/queue/appointment.service.js");
    const bookingCDoc = await AppointmentBooking.findById(futureBookingC.booking.bookingId);
    await scheduleReminders(bookingCDoc);
    const remindersCreated = await ReminderQueue.find({ bookingId: bookingCDoc._id });
    assert(remindersCreated.length > 0 && remindersCreated.every(r => r.bookingId.toString() === bookingCDoc._id.toString()),
      "28. ReminderQueue entries are strictly associated with specific bookingId");

    console.log("\n==================================================");
    console.log(`MULTI-APPOINTMENT VERIFICATION RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

  } catch (error) {
    console.error("Test execution threw exception:", error);
    failed++;
  } finally {
    await mongoose.disconnect();
  }

  process.exit(failed > 0 ? 1 : 0);
}

runMultiAppointmentTests();
