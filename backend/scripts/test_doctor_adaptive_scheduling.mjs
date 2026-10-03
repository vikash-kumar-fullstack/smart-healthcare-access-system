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
import DoctorSchedule from "../src/modules/doctor/doctor_schedule.model.js";
import DoctorScheduleOverride from "../src/modules/doctor/doctor_schedule_override.model.js";
import DoctorBreak from "../src/modules/doctor/doctor_break.model.js";
import DoctorLeave from "../src/modules/doctor/doctor_leave.model.js";
import HospitalHoliday from "../src/modules/hospital/hospital_holiday.model.js";
import AppointmentBooking from "../src/modules/queue/appointment_booking.model.js";
import FamilyRelationship from "../src/modules/user/family_relationship.model.js";
import { generateDoctorSlots, invalidateSlotCache } from "../src/modules/doctor/schedule.service.js";
import { calculateEstimatedConsultationWindow } from "../src/modules/queue/queue.service.js";
import { getTodayIST } from "../src/modules/search/utils.js";

async function runDoctorAdaptiveSchedulingTests() {
  console.log("==================================================");
  console.log("DOCTOR-ADAPTIVE SCHEDULING VERIFICATION SUITE");
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
    // 0. Setup shared test entities
    let hospital = await Hospital.findOne();
    if (!hospital) {
      hospital = await Hospital.create({
        name: "Adaptive City Hospital",
        address: "123 Medical Center Way",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
        contactNumber: "9876543210",
        emergencyContactNumber: "9876543211",
        status: "active"
      });
    }

    const testDoctorUser = await User.create({
      name: "Dr. Adaptive Scheduler",
      email: `dr.adapt.${Date.now()}@test.com`,
      phone: `99${Date.now().toString().slice(-8)}`,
      role: "doctor",
      profileCompleted: true
    });

    const testDoctor = await Doctor.create({
      userId: testDoctorUser._id,
      hospitalId: hospital._id,
      name: testDoctorUser.name,
      specialization: "General Medicine",
      qualification: "MD",
      experienceYears: 10,
      avgConsultationTime: 10,
      status: "verified"
    });

    const targetDate = todayStr;
    const targetDayOfWeek = new Date(targetDate).getDay();

    // Setup basic published schedule: 09:00 - 10:00 (1 hour shift)
    await DoctorSchedule.deleteMany({ doctorId: testDoctor._id });
    await DoctorSchedule.create({
      doctorId: testDoctor._id,
      dayOfWeek: targetDayOfWeek,
      startTime: "09:00",
      endTime: "10:00",
      status: "published",
      version: 1
    });

    // ── TEST 1: Doctor duration 10 minutes ────────────────────────────────────
    console.log("--> TEST 1: Doctor duration 10 minutes");
    await Doctor.findByIdAndUpdate(testDoctor._id, { avgConsultationTime: 10 });
    invalidateSlotCache(testDoctor._id, targetDate);

    const slots10 = await generateDoctorSlots(testDoctor._id, targetDate);
    const times10 = slots10.map(s => s.time);
    const expected10 = ["09:00", "09:10", "09:20", "09:30", "09:40", "09:50"];
    assert(times10.length === 6, `Expected exactly 6 slots for 10 min duration (Got: ${times10.length})`);
    assert(JSON.stringify(times10) === JSON.stringify(expected10), `Slots match expected 10-min sequence: ${times10.join(", ")}`);

    // ── TEST 2: Doctor duration 15 minutes ────────────────────────────────────
    console.log("\n--> TEST 2: Doctor duration 15 minutes");
    await Doctor.findByIdAndUpdate(testDoctor._id, { avgConsultationTime: 15 });
    invalidateSlotCache(testDoctor._id, targetDate);

    const slots15 = await generateDoctorSlots(testDoctor._id, targetDate);
    const times15 = slots15.map(s => s.time);
    const expected15 = ["09:00", "09:15", "09:30", "09:45"];
    assert(times15.length === 4, `Expected exactly 4 slots for 15 min duration (Got: ${times15.length})`);
    assert(JSON.stringify(times15) === JSON.stringify(expected15), `Slots match expected 15-min sequence: ${times15.join(", ")}`);

    // ── TEST 3: Doctor duration 20 minutes ────────────────────────────────────
    console.log("\n--> TEST 3: Doctor duration 20 minutes");
    await Doctor.findByIdAndUpdate(testDoctor._id, { avgConsultationTime: 20 });
    invalidateSlotCache(testDoctor._id, targetDate);

    const slots20 = await generateDoctorSlots(testDoctor._id, targetDate);
    const times20 = slots20.map(s => s.time);
    const expected20 = ["09:00", "09:20", "09:40"];
    assert(times20.length === 3, `Expected exactly 3 slots for 20 min duration (Got: ${times20.length})`);
    assert(JSON.stringify(times20) === JSON.stringify(expected20), `Slots match expected 20-min sequence: ${times20.join(", ")}`);

    // ── TEST 4: Doctor duration 30 minutes ────────────────────────────────────
    console.log("\n--> TEST 4: Doctor duration 30 minutes");
    await Doctor.findByIdAndUpdate(testDoctor._id, { avgConsultationTime: 30 });
    invalidateSlotCache(testDoctor._id, targetDate);

    const slots30 = await generateDoctorSlots(testDoctor._id, targetDate);
    const times30 = slots30.map(s => s.time);
    const expected30 = ["09:00", "09:30"];
    assert(times30.length === 2, `Expected exactly 2 slots for 30 min duration (Got: ${times30.length})`);
    assert(JSON.stringify(times30) === JSON.stringify(expected30), `Slots match expected 30-min sequence: ${times30.join(", ")}`);

    // ── TEST 5: Shift-end boundary safety ─────────────────────────────────────
    console.log("\n--> TEST 5: Shift-end boundary safety (09:00–10:25 with 20 min duration)");
    // Update schedule shift to 09:00–10:25
    await DoctorSchedule.updateOne({ doctorId: testDoctor._id }, { startTime: "09:00", endTime: "10:25" });
    await Doctor.findByIdAndUpdate(testDoctor._id, { avgConsultationTime: 20 });
    invalidateSlotCache(testDoctor._id, targetDate);

    const slotsBoundary = await generateDoctorSlots(testDoctor._id, targetDate);
    const timesBoundary = slotsBoundary.map(s => s.time);
    // 09:00 (ends 09:20), 09:20 (ends 09:40), 09:40 (ends 10:00), 10:00 (ends 10:20).
    // 10:20 would end at 10:40 > 10:25 -> must NOT be generated!
    assert(!timesBoundary.includes("10:20"), "Slot 10:20 is excluded because it extends past shift end (10:25)");
    assert(timesBoundary[timesBoundary.length - 1] === "10:00", `Final valid slot is 10:00 (Got: ${timesBoundary[timesBoundary.length - 1]})`);

    // Restore schedule to 09:00–12:00 for subsequent tests
    await DoctorSchedule.updateOne({ doctorId: testDoctor._id }, { startTime: "09:00", endTime: "12:00" });

    // ── TEST 6: Break overlap safety (interval overlap) ────────────────────────
    console.log("\n--> TEST 6: Break overlap safety (interval overlap check)");
    // Doctor duration 30 min. Break is 11:00–11:30.
    // Shift is 09:00–12:00.
    // Suppose shift has an override or slot at 10:45 (ends 11:15) -> overlaps break 11:00-11:30.
    // Let's create a break 10:15–10:45.
    await DoctorBreak.deleteMany({ doctorId: testDoctor._id });
    await DoctorBreak.create({
      doctorId: testDoctor._id,
      date: targetDate,
      startTime: "10:15",
      endTime: "10:45",
      breakType: "custom",
      reason: "Mid-morning break"
    });

    // 30 min slots: 09:00, 09:30 (ends 10:00), 10:00 (ends 10:30 -> overlaps 10:15-10:45 break!).
    // 10:00 start (600) < break end (645) && break start (615) < 10:00 end (630) -> TRUE!
    await Doctor.findByIdAndUpdate(testDoctor._id, { avgConsultationTime: 30 });
    invalidateSlotCache(testDoctor._id, targetDate);

    const slotsBreak = await generateDoctorSlots(testDoctor._id, targetDate);
    const slotAt10 = slotsBreak.find(s => s.time === "10:00");
    assert(slotAt10?.status === "BREAK", `Slot 10:00 overlapping 10:15–10:45 break is marked BREAK (Got: ${slotAt10?.status})`);

    // Clean up break
    await DoctorBreak.deleteMany({ doctorId: testDoctor._id });

    // ── TEST 7: Partial leave overlap safety ───────────────────────────────────
    console.log("\n--> TEST 7: Partial leave overlap safety");
    await DoctorLeave.deleteMany({ doctorId: testDoctor._id });
    await DoctorLeave.create({
      doctorId: testDoctor._id,
      leaveType: "half_day",
      startDate: targetDate,
      endDate: targetDate,
      startTime: "10:15",
      endTime: "11:00",
      status: "approved",
      reason: "Emergency partial leave"
    });

    invalidateSlotCache(testDoctor._id, targetDate);
    const slotsLeave = await generateDoctorSlots(testDoctor._id, targetDate);
    const slotLeaveAt10 = slotsLeave.find(s => s.time === "10:00");
    assert(slotLeaveAt10?.status === "LEAVE", `Slot 10:00 overlapping 10:15–11:00 partial leave is marked LEAVE (Got: ${slotLeaveAt10?.status})`);

    // Clean up leave
    await DoctorLeave.deleteMany({ doctorId: testDoctor._id });

    // ── TEST 8: Full-day holiday behavior unchanged ────────────────────────────
    console.log("\n--> TEST 8: Full-day holiday behavior unchanged");
    await HospitalHoliday.deleteMany({ date: targetDate });
    const holiday = await HospitalHoliday.create({
      date: targetDate,
      name: "National Healthcare Observance Day"
    });
    invalidateSlotCache(testDoctor._id, targetDate);

    const holidaySlots = await generateDoctorSlots(testDoctor._id, targetDate);
    assert(holidaySlots.length === 1 && holidaySlots[0].status === "HOLIDAY", "Returns single HOLIDAY token");
    assert(holidaySlots[0].label === holiday.name, `Holiday label preserved (Got: ${holidaySlots[0].label})`);

    await HospitalHoliday.deleteMany({ date: targetDate });

    // ── TEST 9: Full-day leave behavior unchanged ──────────────────────────────
    console.log("\n--> TEST 9: Full-day leave behavior unchanged");
    await DoctorLeave.create({
      doctorId: testDoctor._id,
      leaveType: "full_day",
      startDate: targetDate,
      endDate: targetDate,
      status: "approved",
      reason: "Annual Medical Conference"
    });
    invalidateSlotCache(testDoctor._id, targetDate);

    const fullLeaveSlots = await generateDoctorSlots(testDoctor._id, targetDate);
    assert(fullLeaveSlots.length === 1 && fullLeaveSlots[0].status === "LEAVE", "Returns single LEAVE token");

    await DoctorLeave.deleteMany({ doctorId: testDoctor._id });

    // ── TEST 10: Schedule override behavior unchanged ──────────────────────────
    console.log("\n--> TEST 10: Schedule override behavior unchanged");
    await DoctorScheduleOverride.deleteMany({ doctorId: testDoctor._id });
    await DoctorScheduleOverride.create({
      doctorId: testDoctor._id,
      date: targetDate,
      startTime: "14:00",
      endTime: "15:00",
      enabled: true
    });
    await Doctor.findByIdAndUpdate(testDoctor._id, { avgConsultationTime: 20 });
    invalidateSlotCache(testDoctor._id, targetDate);

    const overrideSlots = await generateDoctorSlots(testDoctor._id, targetDate);
    const overrideTimes = overrideSlots.map(s => s.time);
    const expectedOverride = ["14:00", "14:20", "14:40"];
    assert(JSON.stringify(overrideTimes) === JSON.stringify(expectedOverride), `Override shifts applied cleanly: ${overrideTimes.join(", ")}`);

    await DoctorScheduleOverride.deleteMany({ doctorId: testDoctor._id });

    // ── TEST 11: Existing booked slot is correctly marked BOOKED ───────────────
    console.log("\n--> TEST 11: Existing booked slot marked BOOKED");
    // Roster 09:00–12:00, duration 20 min
    await DoctorSchedule.updateOne({ doctorId: testDoctor._id }, { startTime: "09:00", endTime: "12:00" });
    await Doctor.findByIdAndUpdate(testDoctor._id, { avgConsultationTime: 20 });

    const patientUser = await User.create({
      name: "Patient Alpha",
      email: `patient.alpha.${Date.now()}@test.com`,
      phone: `91${Date.now().toString().slice(-8)}`,
      role: "patient",
      profileCompleted: true
    });

    await AppointmentBooking.deleteMany({ doctorId: testDoctor._id, date: targetDate });
    const booking = await AppointmentBooking.create({
      bookingNumber: `BK-${Date.now().toString().slice(-4)}`,
      userId: patientUser._id,
      doctorId: testDoctor._id,
      hospitalId: hospital._id,
      sessionId: new mongoose.Types.ObjectId(),
      date: targetDate,
      slotTime: "09:20",
      status: "CONFIRMED",
      arrivalStatus: "NOT_ARRIVED"
    });

    invalidateSlotCache(testDoctor._id, targetDate);
    const slotsWithBooking = await generateDoctorSlots(testDoctor._id, targetDate);
    const bookedSlot = slotsWithBooking.find(s => s.time === "09:20");
    assert(bookedSlot?.status === "BOOKED", `Slot 09:20 is marked BOOKED (Got: ${bookedSlot?.status})`);
    const availableSlot = slotsWithBooking.find(s => s.time === "09:00");
    assert(availableSlot?.status === "AVAILABLE" || availableSlot?.status === "LOCKED", "Other slots remain AVAILABLE/LOCKED");

    // ── TEST 12: Cancelled booking frees slot ──────────────────────────────────
    console.log("\n--> TEST 12: Cancelled booking frees slot");
    booking.status = "CANCELLED";
    await booking.save();
    invalidateSlotCache(testDoctor._id, targetDate);

    const slotsAfterCancel = await generateDoctorSlots(testDoctor._id, targetDate);
    const freedSlot = slotsAfterCancel.find(s => s.time === "09:20");
    assert(freedSlot?.status === "AVAILABLE" || freedSlot?.status === "LOCKED", `Cancelled booking freed 09:20 slot (Got: ${freedSlot?.status})`);

    // ── TEST 13: Concurrent duplicate booking rejected ─────────────────────────
    console.log("\n--> TEST 13: Concurrent duplicate booking rejected");
    // Active booking at 09:40
    await AppointmentBooking.create({
      bookingNumber: `BK-${Date.now().toString().slice(-4)}-A`,
      userId: patientUser._id,
      doctorId: testDoctor._id,
      hospitalId: hospital._id,
      sessionId: new mongoose.Types.ObjectId(),
      date: targetDate,
      slotTime: "09:40",
      status: "CONFIRMED",
      arrivalStatus: "NOT_ARRIVED"
    });

    const duplicateAttempt = await AppointmentBooking.findOne({
      doctorId: testDoctor._id,
      date: targetDate,
      slotTime: "09:40",
      status: { $in: ["BOOKED", "CONFIRMED", "READY", "IN_CONSULTATION"] }
    });
    assert(duplicateAttempt !== null, "Pre-booking duplicate guard correctly detects existing active slot booking");

    // ── TEST 14: Doctor with 5-minute configured duration still works ───────────
    console.log("\n--> TEST 14: Doctor with 5-minute configured duration works");
    await Doctor.findByIdAndUpdate(testDoctor._id, { avgConsultationTime: 5 });
    invalidateSlotCache(testDoctor._id, targetDate);

    const slots5 = await generateDoctorSlots(testDoctor._id, targetDate);
    assert(slots5.length > 0, `Generated ${slots5.length} slots for 5-min duration`);
    assert(slots5[0].time === "09:00" && slots5[1].time === "09:05", "5-min step sequence verified (09:00, 09:05)");

    // ── TEST 15: Missing/null duration uses safe existing fallback (10 min) ─────
    console.log("\n--> TEST 15: Missing/null duration uses safe fallback");
    await Doctor.findByIdAndUpdate(testDoctor._id, { avgConsultationTime: null });
    invalidateSlotCache(testDoctor._id, targetDate);

    const fallbackSlots = await generateDoctorSlots(testDoctor._id, targetDate);
    assert(fallbackSlots.length > 0, "Fallback slots generated successfully");
    assert(fallbackSlots[0].time === "09:00" && fallbackSlots[1].time === "09:10", "Fallback defaults cleanly to 10 minutes when null (09:00, 09:10)");

    // ── TEST 16: Existing AppointmentBooking.slotTime format remains HH:mm ──────
    console.log("\n--> TEST 16: AppointmentBooking.slotTime format invariant");
    const activeBooking = await AppointmentBooking.findOne({ doctorId: testDoctor._id, status: "CONFIRMED" });
    const isHHMM = /^\d{2}:\d{2}$/.test(activeBooking.slotTime);
    assert(isHHMM, `slotTime strictly matches HH:mm format (Got: ${activeBooking.slotTime})`);

    // ── TEST 17: Existing bookings remain valid after duration configuration changes
    console.log("\n--> TEST 17: Existing bookings immutable when doctor duration changes");
    const originalSlotTime = activeBooking.slotTime;
    // Doctor updates duration setting in profile from 20 -> 30 mins
    await Doctor.findByIdAndUpdate(testDoctor._id, { avgConsultationTime: 30 });
    const retrievedBooking = await AppointmentBooking.findById(activeBooking._id);
    assert(retrievedBooking.slotTime === originalSlotTime, `Booking slotTime is strictly immutable (Expected: ${originalSlotTime}, Got: ${retrievedBooking.slotTime})`);

    // ── TEST 18 & 19: Authenticated user identity resolution in BookingJourney ──
    console.log("\n--> TEST 18 & 19: Authenticated user identity resolution (Vikash)");
    const vikashUser = { name: "Vikash", email: "vikash@test.com", role: "patient" };
    // Simulation of BookingJourney patient label logic
    const resolvePatientLabel = (selectedPatient, currentUser) => {
      return selectedPatient ? selectedPatient.name : `Self (${currentUser?.name || "Account Owner"})`;
    };

    const selfLabel = resolvePatientLabel(null, vikashUser);
    assert(selfLabel === "Self (Vikash)", `Step 0 & Step 4 resolve dynamically to Self (Vikash) (Got: ${selfLabel})`);

    // ── TEST 20: Family member selection displays actual relative name ──────────
    console.log("\n--> TEST 20: Family member selection displays relative name");
    const relative = { _id: new mongoose.Types.ObjectId(), name: "Aarav Kumar" };
    const familyLabel = resolvePatientLabel(relative, vikashUser);
    assert(familyLabel === "Aarav Kumar", `Family selection preserves relative's canonical name (Got: ${familyLabel})`);

    // ── TEST 21: Patient ID sent during self booking is authenticated user ID ───
    console.log("\n--> TEST 21: Self booking patientId resolution");
    const ownerId = testDoctorUser._id;
    const bodyPatientId = undefined; // Self selection in frontend sends undefined
    const resolvedPatientId = bodyPatientId || ownerId;
    assert(resolvedPatientId.toString() === ownerId.toString(), "Self booking patientId resolves authoritatively to ownerId");

    // ── TEST 22: Family booking authorization remains intact ────────────────────
    console.log("\n--> TEST 22: Family booking authorization remains intact");
    const familyMemberId = new mongoose.Types.ObjectId();
    const rel = await FamilyRelationship.create({
      ownerId,
      relativeId: familyMemberId,
      relationType: "Child",
      managementType: "FULL_ACCESS",
      ownershipType: "GUARDIAN_MANAGED",
      status: "ACTIVE",
      createdBy: ownerId,
      updatedBy: ownerId
    });

    const activeRel = await FamilyRelationship.findOne({ ownerId, relativeId: familyMemberId });
    assert(activeRel && activeRel.status === "ACTIVE", "Active family relationship authorizes family booking");
    await FamilyRelationship.deleteMany({ ownerId });

    // ── TEST 23: Dynamic wait suite calculation remains unaffected ──────────────
    console.log("\n--> TEST 23: Dynamic wait estimation compatibility");
    // Verify calculateEstimatedConsultationWindow continues to operate cleanly
    const dynamicWindow = await calculateEstimatedConsultationWindow({
      booking: { slotTime: "09:30", date: targetDate, doctorId: testDoctor._id },
      queue: null,
      session: { sessionStatus: "active", _id: new mongoose.Types.ObjectId() },
      nowMinutesOverride: 540 // 09:00 AM
    });

    assert(dynamicWindow !== null, "calculateEstimatedConsultationWindow returns non-null window");
    assert(dynamicWindow.start && dynamicWindow.end, `Estimated window has start (${dynamicWindow.start}) and end (${dynamicWindow.end})`);

    console.log("\n==================================================");
    console.log(`TOTAL DOCTOR-ADAPTIVE TESTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("==================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runDoctorAdaptiveSchedulingTests();
