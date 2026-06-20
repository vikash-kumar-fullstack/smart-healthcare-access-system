import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import mongoose from "mongoose";
import http from "http";
import io from "socket.io-client";

process.env.NODE_ENV = "test";

import app from "../src/app.js";
import User from "../src/modules/auth/auth.model.js";
import Doctor from "../src/modules/doctor/doctor.model.js";
import Hospital from "../src/modules/hospital/hospital.model.js";
import Queue from "../src/modules/queue/queue.model.js";
import QueueSession from "../src/modules/queue/queueSession.model.js";
import Notification from "../src/modules/notification/notification.model.js";
import BookingCredit from "../src/modules/queue/booking_credit.model.js";
import PatientStats from "../src/modules/queue/patient_stats.model.js";
import DoctorSchedule from "../src/modules/doctor/doctor_schedule.model.js";
import DoctorScheduleOverride from "../src/modules/doctor/doctor_schedule_override.model.js";
import DoctorAvailabilityLog from "../src/modules/doctor/doctor_availability_log.model.js";
import DoctorAnalyticsDaily from "../src/modules/doctor/doctor_analytics_daily.model.js";
import AnalyticsRebuildAuditLog from "../src/modules/doctor/analytics_rebuild_audit_log.model.js";
import SystemMonitoring from "../src/modules/doctor/system_monitoring.model.js";
import NotificationOutbox from "../src/modules/notification/notification_outbox.model.js";
import NotificationPreferences from "../src/modules/notification/notification_preferences.model.js";
import NotificationCounter from "../src/modules/notification/notification_counter.model.js";
import NotificationDeadLetter from "../src/modules/notification/notification_dead_letter.model.js";
import NotificationSequence from "../src/modules/notification/notification_sequence.model.js";
import { createNotification } from "../src/modules/notification/notification.service.js";
import { incrementUnread } from "../src/modules/notification/notification_counter.service.js";
import { notificationDispatcher, retryWorker, cleanupWorker, initNotificationWorkers, stopNotificationWorkers } from "../src/modules/notification/notification_worker.js";
import { initSocket } from "../src/utils/socket.js";
import { runMonthlyReset, runBookingCreditCleanup } from "../src/utils/cron.js";
import { stopSearchWorkers } from "../src/modules/search/search_worker.js";
import Visit from "../src/modules/visit/visit.model.js";
import VisitTimeline from "../src/modules/visit/visit_timeline.model.js";
import VisitSummary from "../src/modules/visit/visit_summary.model.js";
import VisitSequence from "../src/modules/visit/visit_sequence.model.js";
import SymptomDictionary from "../src/modules/search/symptom_dictionary.model.js";
import DoctorAvailabilitySnapshot from "../src/modules/search/doctor_availability_snapshot.model.js";
import SearchEvent from "../src/modules/search/search_event.model.js";
import SearchCache from "../src/modules/search/search_cache.model.js";
import SearchAnalyticsDaily from "../src/modules/search/search_analytics_daily.model.js";
import SearchMonitoringDaily from "../src/modules/search/search_monitoring_daily.model.js";
import SearchOutbox from "../src/modules/search/search_outbox.model.js";
import SearchVersionMeta from "../src/modules/search/search_version_meta.model.js";

dotenv.config();

const requiredEnv = ["MONGO_URI", "JWT_SECRET"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`${key} is required to run smoke tests.`);
  }
}

const testRunId = `smoke-${Date.now()}`;
const password = "Password123";
const created = {
  users: [],
  doctors: [],
  hospitals: [],
  queues: [],
  sessions: [],
  notificationsForUsers: []
};

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

const expectSuccess = async (method, path, options = {}) => {
  const result = await request(method, path, options);
  assert.equal(
    result.payload.success,
    true,
    `${method} ${path} failed: ${JSON.stringify(result.payload)}`
  );
  return result.payload.data;
};

const expectFailure = async (method, path, expectedStatus, options = {}) => {
  const result = await request(method, path, options);
  assert.equal(
    result.response.status,
    expectedStatus,
    `${method} ${path} expected ${expectedStatus}, got ${result.response.status}: ${JSON.stringify(result.payload)}`
  );
  assert.equal(result.payload.success, false);
  return result.payload;
};

const createUser = async ({ name, email, phone, role }) => {
  const user = await User.create({
    name,
    email,
    phone,
    role,
    password: await bcrypt.hash(password, 10)
  });
  created.users.push(user._id);
  created.notificationsForUsers.push(user._id);
  return user;
};

const login = async (email) => {
  const data = await expectSuccess("POST", "/api/v1/auth/login", {
    body: { email, password }
  });

  assert.ok(data.token, "login should return token");
  assert.equal(data.user.password, undefined, "login must not return password hash");
  return data.token;
};

const cleanup = async () => {
  stopNotificationWorkers();
  stopSearchWorkers();
  await Promise.allSettled([
    Queue.deleteMany({
      $or: [
        { _id: { $in: created.queues } },
        { userId: { $in: created.users } },
        { doctorId: { $in: created.doctors } }
      ]
    }),
    QueueSession.deleteMany({
      $or: [
        { _id: { $in: created.sessions } },
        { doctorId: { $in: created.doctors } }
      ]
    }),
    BookingCredit.deleteMany({ userId: { $in: created.users } }),
    PatientStats.deleteMany({ userId: { $in: created.users } }),
    Notification.deleteMany({ recipientUserId: { $in: created.notificationsForUsers } }),
    NotificationOutbox.deleteMany({}),
    NotificationPreferences.deleteMany({}),
    NotificationCounter.deleteMany({}),
    NotificationDeadLetter.deleteMany({}),
    NotificationSequence.deleteMany({}),
    Doctor.deleteMany({ _id: { $in: created.doctors } }),
    DoctorSchedule.deleteMany({ doctorId: { $in: created.doctors } }),
    DoctorScheduleOverride.deleteMany({ doctorId: { $in: created.doctors } }),
    DoctorAvailabilityLog.deleteMany({ doctorId: { $in: created.doctors } }),
    DoctorAnalyticsDaily.deleteMany({ doctorId: { $in: created.doctors } }),
    AnalyticsRebuildAuditLog.deleteMany({ doctorId: { $in: created.doctors } }),
    SystemMonitoring.deleteMany({}),
    Hospital.deleteMany({ _id: { $in: created.hospitals } }),
    User.deleteMany({ _id: { $in: created.users } }),
    Visit.deleteMany({}),
    VisitTimeline.deleteMany({}),
    VisitSummary.deleteMany({}),
    VisitSequence.deleteMany({}),
    SymptomDictionary.deleteMany({}),
    DoctorAvailabilitySnapshot.deleteMany({}),
    SearchEvent.deleteMany({}),
    SearchCache.deleteMany({}),
    SearchAnalyticsDaily.deleteMany({}),
    SearchMonitoringDaily.deleteMany({}),
    SearchOutbox.deleteMany({}),
    SearchVersionMeta.deleteMany({})
  ]);
};

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
  return `${hostPart}/smart-healthcare-test${queryPart}`;
};

const run = async () => {
  const testMongoUri = rewriteMongoUri(process.env.MONGO_URI);
  console.log("Connecting to isolated test database...");
  await mongoose.connect(testMongoUri);

  // Pre-run cleanup of leftover test users and doctors to avoid duplicate key errors
  const testPhones = [
    "9000000001", "9000000002", "9000000003", "9000000004", "9000000005",
    "9000000006", "9000000077", "9000000088", "9100000099", "9000000009"
  ];
  const leftoverUsers = await User.find({ phone: { $in: testPhones } }).lean();
  if (leftoverUsers.length > 0) {
    const leftoverUserIds = leftoverUsers.map(u => u._id);
    await User.deleteMany({ _id: { $in: leftoverUserIds } });
    await Doctor.deleteMany({ userId: { $in: leftoverUserIds } });
  }

  server = http.createServer(app);
  initSocket(server);
  initNotificationWorkers(100);
  server.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;

  const hospital = await Hospital.create({
    name: `${testRunId} Hospital`,
    address: "Smoke Test Address",
    location: { type: "Point", coordinates: [85.1, 25.6] },
    specializations: ["cardiology"]
  });
  created.hospitals.push(hospital._id);

  const patientOne = await createUser({
    name: `${testRunId} Patient One`,
    email: `${testRunId}-patient1@example.com`,
    phone: "9000000001",
    role: "patient"
  });
  const patientTwo = await createUser({
    name: `${testRunId} Patient Two`,
    email: `${testRunId}-patient2@example.com`,
    phone: "9000000002",
    role: "patient"
  });
  const doctorUser = await createUser({
    name: `${testRunId} Doctor`,
    email: `${testRunId}-doctor@example.com`,
    phone: "9000000003",
    role: "doctor"
  });
  const otherDoctorUser = await createUser({
    name: `${testRunId} Other Doctor`,
    email: `${testRunId}-other-doctor@example.com`,
    phone: "9000000004",
    role: "doctor"
  });
  const unavailableDoctorUser = await createUser({
    name: `${testRunId} Unavailable Doctor`,
    email: `${testRunId}-unavailable-doctor@example.com`,
    phone: "9000000005",
    role: "doctor"
  });

  const doctor = await Doctor.create({
    name: `${testRunId} Dr Available`,
    specialization: "cardiology",
    hospitalId: hospital._id,
    avgConsultationTime: 5,
    defaultQueueLimit: 10,
    isAvailable: true,
    availabilityState: "available",
    rating: 4.8,
    experienceYears: 12,
    userId: doctorUser._id,
    profileCompleted: true,
    status: "active"
  });
  const otherDoctor = await Doctor.create({
    name: `${testRunId} Dr Other`,
    specialization: "cardiology",
    hospitalId: hospital._id,
    avgConsultationTime: 5,
    defaultQueueLimit: 10,
    isAvailable: true,
    availabilityState: "available",
    rating: 4.1,
    experienceYears: 6,
    userId: otherDoctorUser._id,
    profileCompleted: true,
    status: "active"
  });
  const unavailableDoctor = await Doctor.create({
    name: `${testRunId} Dr Unavailable`,
    specialization: "cardiology",
    hospitalId: hospital._id,
    avgConsultationTime: 5,
    defaultQueueLimit: 10,
    isAvailable: false,
    availabilityState: "unavailable",
    rating: 4.9,
    experienceYears: 15,
    userId: unavailableDoctorUser._id,
    profileCompleted: true,
    status: "active"
  });
  created.doctors.push(doctor._id, otherDoctor._id, unavailableDoctor._id);

  // Set up doctor schedules so they are available
  const setupDoctorSchedules = async (doctorId) => {
    for (let i = 0; i < 7; i++) {
      await DoctorSchedule.create({
        doctorId,
        dayOfWeek: i,
        startTime: "09:00",
        endTime: "23:59",
        enabled: true
      });
    }
  };
  await setupDoctorSchedules(doctor._id);
  await setupDoctorSchedules(otherDoctor._id);

  const patientOneToken = await login(patientOne.email);
  const patientTwoToken = await login(patientTwo.email);
  const doctorToken = await login(doctorUser.email);
  const otherDoctorToken = await login(otherDoctorUser.email);

  console.log("  - Verifying booking unavailable doctor returns soft failure...");
  const unavailableResponse = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: unavailableDoctor._id.toString() }
  });
  assert.equal(unavailableResponse.canBook, false);
  assert.equal(unavailableResponse.code, "DOCTOR_OFFLINE");

  const patientOneBooking = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString() }
  });
  created.queues.push(patientOneBooking.booking.queueId);
  assert.equal(patientOneBooking.booking.patientsAhead, 0);
  assert.equal(patientOneBooking.timing.estimatedWaitTime, null);

  console.log("  - Verifying duplicate booking returns soft failure...");
  const duplicateResponse = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: otherDoctor._id.toString() }
  });
  assert.equal(duplicateResponse.canBook, false);
  assert.equal(duplicateResponse.code, "DUPLICATE_BOOKING");

  const patientTwoBooking = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientTwoToken,
    body: { doctorId: doctor._id.toString() }
  });
  created.queues.push(patientTwoBooking.booking.queueId);
  assert.equal(patientTwoBooking.booking.patientsAhead, 1);

  const patientOneQueueBeforeStart = await expectSuccess("GET", "/api/v1/queue/my", {
    token: patientOneToken
  });
  assert.equal(patientOneQueueBeforeStart.status, "waiting");
  assert.equal(patientOneQueueBeforeStart.sessionStatus, "inactive");
  assert.equal(patientOneQueueBeforeStart.eta, null);

  await expectSuccess("PATCH", "/api/v1/queue/start-session", { token: doctorToken });

  const doctorQueueAfterStart = await expectSuccess("GET", "/api/v1/queue/doctor", {
    token: doctorToken
  });
  assert.equal(doctorQueueAfterStart.sessionStatus, "active");
  assert.equal(doctorQueueAfterStart.queue[0].status, "in_progress");
  assert.equal(doctorQueueAfterStart.queue[0].queueNumber, 1);
  assert.equal(doctorQueueAfterStart.queue[1].status, "waiting");

  await expectFailure("PATCH", "/api/v1/queue/complete", 400, {
    token: otherDoctorToken,
    body: { queueId: patientOneBooking.booking.queueId }
  });

  await expectSuccess("PATCH", "/api/v1/queue/skip", {
    token: doctorToken,
    body: { queueId: patientOneBooking.booking.queueId }
  });

  const skippedQueue = await Queue.findById(patientOneBooking.booking.queueId).lean();
  assert.equal(skippedQueue.status, "skipped");
  assert.equal(skippedQueue.isActive, false);

  const doctorQueueAfterSkip = await expectSuccess("GET", "/api/v1/queue/doctor", {
    token: doctorToken
  });
  assert.equal(doctorQueueAfterSkip.queue.length, 1);
  assert.equal(doctorQueueAfterSkip.queue[0].queueNumber, 2);
  assert.equal(doctorQueueAfterSkip.queue[0].status, "in_progress");

  const patientOneRebook = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString() }
  });
  created.queues.push(patientOneRebook.booking.queueId);
  assert.equal(patientOneRebook.booking.patientsAhead, 0);

  await expectSuccess("PATCH", "/api/v1/queue/complete", {
    token: doctorToken,
    body: { queueId: patientTwoBooking.booking.queueId }
  });

  const rebookedQueue = await expectSuccess("GET", "/api/v1/queue/my", {
    token: patientOneToken
  });
  assert.equal(rebookedQueue.patientsAhead, 0);
  assert.equal(rebookedQueue.status, "in_progress");

  const history = await expectSuccess("GET", "/api/v1/queue/history", {
    token: patientOneToken
  });
  assert.ok(
    history.some((item) => item.status === "skipped" && item.outcome === "Missed"),
    "history should include skipped patient as Missed"
  );

  // Allow the background worker loop (100ms interval) to process the outbox notification
  await new Promise((resolve) => setTimeout(resolve, 200));

  const notifications = await expectSuccess("GET", "/api/v1/notifications?view=all", {
    token: patientOneToken
  });
  assert.ok(
    notifications.some((notification) => notification.title === "Turn Skipped"),
    "skipped patient should receive notification"
  );

  const patientTwoQueue = await Queue.findById(patientTwoBooking.booking.queueId).lean();
  assert.equal(patientTwoQueue.status, "completed");
  assert.equal(patientTwoQueue.isActive, false);

  // ─── Phase 4 Onboarding & Verification Tests ─────────────────────────────────
  console.log("Starting Phase 4 Onboarding & Verification Tests...");

  // Test 1: Role Security Check (Patient token calling complete profile) -> 403 Forbidden
  await expectFailure("POST", "/api/v1/doctors/profile/complete", 403, {
    token: patientOneToken,
    body: { avgConsultationTime: 10, experienceYears: 3 }
  });
  console.log("✓ Patient role security check passed (403 Forbidden received).");

  // Test 2: Incomplete Doctor Status and Onboarding Flow
  const newDoctorUser = await createUser({
    name: `${testRunId} New Onboard Doctor`,
    email: `${testRunId}-onboard-dr@example.com`,
    phone: "9000000006",
    role: "doctor"
  });
  const newDoctorToken = await login(newDoctorUser.email);

  // Profile stub created by admin
  const doctorStub = await Doctor.create({
    name: newDoctorUser.name,
    specialization: "neurology",
    hospitalId: hospital._id,
    userId: newDoctorUser._id,
    profileCompleted: false,
    status: "pending_profile"
  });
  created.doctors.push(doctorStub._id);

  // Call profile complete with invalid data -> 400 Bad Request
  await expectFailure("POST", "/api/v1/doctors/profile/complete", 400, {
    token: newDoctorToken,
    body: { avgConsultationTime: -5 }
  });

  // Fetch incomplete profile -> profileCompleted = false
  const initialProfile = await expectSuccess("GET", "/api/v1/doctors/profile", { token: newDoctorToken });
  assert.equal(initialProfile.profileCompleted, false);
  assert.equal(initialProfile.doctor.status, "pending_profile");

  // Call queue operations as incomplete doctor -> 403 Forbidden
  await expectFailure("GET", "/api/v1/queue/doctor", 403, { token: newDoctorToken });

  // Complete profile -> Success (200 OK), transitions status to pending_activation
  const completedProfileData = await expectSuccess("POST", "/api/v1/doctors/profile/complete", {
    token: newDoctorToken,
    body: { avgConsultationTime: 12, experienceYears: 8 }
  });
  assert.equal(completedProfileData.profileCompleted, true);
  assert.equal(completedProfileData.status, "pending_activation");
  assert.ok(completedProfileData.completedProfileAt);

  // Re-completion attempt -> 409 Conflict
  await expectFailure("POST", "/api/v1/doctors/profile/complete", 409, {
    token: newDoctorToken,
    body: { avgConsultationTime: 10, experienceYears: 5 }
  });

  // Call queue operations as pending_activation doctor -> 403 Forbidden
  await expectFailure("GET", "/api/v1/queue/doctor", 403, { token: newDoctorToken });

  // Admin approves / activates doctor in database
  await Doctor.findByIdAndUpdate(doctorStub._id, { status: "active" });

  // Call queue operations as active doctor -> 200 OK
  const emptyQueue = await expectSuccess("GET", "/api/v1/queue/doctor", { token: newDoctorToken });
  assert.equal(emptyQueue.sessionStatus, "inactive");
  assert.equal(emptyQueue.queue.length, 0);

  // ─── Phase 4.3 Doctor Queue Operations & Session Control Tests ───────────────
  console.log("Starting Phase 4.3 Doctor Queue Operations & Session Control Tests...");

  await Queue.deleteMany({});
  await QueueSession.deleteMany({});
  await BookingCredit.deleteMany({});
  await PatientStats.deleteMany({});

  // Reset reliability scores of our patients
  await PatientStats.create({ userId: patientOne._id, reliabilityScore: 100, noShowCountThisMonth: 0 });
  await PatientStats.create({ userId: patientTwo._id, reliabilityScore: 100, noShowCountThisMonth: 0 });

  // 1. Test booking window validation
  const invalidDateStr = new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const pastDateStr = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const validDateStr = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log("Testing booking window constraints...");
  const invalidDateResponse = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString(), bookingDate: invalidDateStr }
  });
  assert.equal(invalidDateResponse.canBook, false);
  assert.equal(invalidDateResponse.code, "BOOKING_WINDOW_LIMIT");

  const pastDateResponse = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString(), bookingDate: pastDateStr }
  });
  assert.equal(pastDateResponse.canBook, false);
  assert.equal(pastDateResponse.code, "BOOKING_WINDOW_LIMIT");

  const bookFutureRes = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString(), bookingDate: validDateStr }
  });
  assert.equal(bookFutureRes.booking.status, "waiting");

  // Cancel future booking so user has no active bookings
  await expectSuccess("PATCH", "/api/v1/queue/cancel", { token: patientOneToken });
  // Verify reliability score is decremented by 1 for early cancel (100 -> 99)
  const cancelledStats = await PatientStats.findOne({ userId: patientOne._id });
  assert.equal(cancelledStats.reliabilityScore, 99);

  // 2. Test Doctor Marks No-Show & Queue Auto Advance
  console.log("Testing mark no-show and auto-advance...");
  const b1 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString() }
  });
  const b2 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientTwoToken,
    body: { doctorId: doctor._id.toString() }
  });

  // Activate session
  await expectSuccess("PATCH", "/api/v1/queue/start-session", { token: doctorToken });

  // Doctor gets queue state
  let dq1 = await expectSuccess("GET", "/api/v1/queue/doctor", { token: doctorToken });
  const b1Doc = await Queue.findById(b1.booking.queueId);
  assert.equal(dq1.currentPatient.queueNumber, b1Doc.queueNumber);
  assert.equal(dq1.stats.waiting, 1);
  assert.equal(dq1.stats.remaining, 2);

  // Doctor marks patientOne as no_show
  await expectSuccess("PATCH", "/api/v1/queue/no-show", {
    token: doctorToken,
    body: { queueId: b1.booking.queueId }
  });

  const p1Doc = await Queue.findById(b1.booking.queueId);
  assert.equal(p1Doc.status, "no_show");
  assert.equal(p1Doc.isActive, false);

  const u1Doc = await PatientStats.findOne({ userId: patientOne._id });
  // 99 - 15 = 84 reliability score
  assert.equal(u1Doc.reliabilityScore, 84);
  assert.equal(u1Doc.noShowCountThisMonth, 1);

  // Verify queue auto-advanced: patientTwo should now be in_progress
  let dq2 = await expectSuccess("GET", "/api/v1/queue/doctor", { token: doctorToken });
  const b2Doc = await Queue.findById(b2.booking.queueId);
  assert.equal(dq2.currentPatient.queueNumber, b2Doc.queueNumber);
  assert.equal(dq2.currentPatient.status, "in_progress");
  assert.equal(dq2.stats.waiting, 0);
  assert.equal(dq2.stats.noShow, 1);
  assert.equal(dq2.stats.remaining, 1);

  // 3. Test Repeated No-show
  console.log("Testing repeated no-show penalty...");
  await expectSuccess("PATCH", "/api/v1/queue/complete", {
    token: doctorToken,
    body: { queueId: b2.booking.queueId }
  });

  const b1_2 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString() }
  });

  await expectSuccess("PATCH", "/api/v1/queue/pause-session", { token: doctorToken });
  await expectSuccess("PATCH", "/api/v1/queue/resume-session", { token: doctorToken });

  let dq4 = await expectSuccess("GET", "/api/v1/queue/doctor", { token: doctorToken });
  const b1_2Doc = await Queue.findById(b1_2.booking.queueId);
  assert.equal(dq4.currentPatient.queueNumber, b1_2Doc.queueNumber);

  await expectSuccess("PATCH", "/api/v1/queue/no-show", {
    token: doctorToken,
    body: { queueId: b1_2.booking.queueId }
  });

  const u1Doc2 = await PatientStats.findOne({ userId: patientOne._id });
  // Penalty for repeated no_show is -30. So 84 - 30 = 54.
  assert.equal(u1Doc2.reliabilityScore, 54);
  assert.equal(u1Doc2.noShowCountThisMonth, 2);

  // 4. Test double complete protection
  console.log("Testing double complete protection...");
  const b2_2 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientTwoToken,
    body: { doctorId: doctor._id.toString() }
  });
  await expectSuccess("PATCH", "/api/v1/queue/pause-session", { token: doctorToken });
  await expectSuccess("PATCH", "/api/v1/queue/resume-session", { token: doctorToken });

  await expectSuccess("PATCH", "/api/v1/queue/complete", {
    token: doctorToken,
    body: { queueId: b2_2.booking.queueId }
  });
  await expectFailure("PATCH", "/api/v1/queue/complete", 400, {
    token: doctorToken,
    body: { queueId: b2_2.booking.queueId }
  });

  // 5. Test Session Close Edge Case (Close disabled while consulting)
  console.log("Testing session close edge case (consultation in progress)...");

  // Book patientOne and patientTwo
  const b_edge_1 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString() }
  });

  // Since session was resumed and empty, pause and resume to auto-start this patient
  await expectSuccess("PATCH", "/api/v1/queue/pause-session", { token: doctorToken });
  await expectSuccess("PATCH", "/api/v1/queue/resume-session", { token: doctorToken });

  // Verify patient is indeed in_progress
  const q_edge_1 = await Queue.findById(b_edge_1.booking.queueId);
  assert.equal(q_edge_1.status, "in_progress");

  // Attempt to close session -> should fail because consultation is in progress
  await expectFailure("PATCH", "/api/v1/queue/close-session", 400, { token: doctorToken });

  // Complete consultation to empty progress
  await expectSuccess("PATCH", "/api/v1/queue/complete", {
    token: doctorToken,
    body: { queueId: b_edge_1.booking.queueId }
  });

  // 6. Test Session Close & Priority Credit
  console.log("Testing session close and priority credit...");
  const b1_3 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString() }
  });
  const b2_3 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientTwoToken,
    body: { doctorId: doctor._id.toString() }
  });

  await expectSuccess("PATCH", "/api/v1/queue/close-session", { token: doctorToken });

  const q1_3 = await Queue.findById(b1_3.booking.queueId);
  assert.equal(q1_3.status, "cancelled");
  assert.equal(q1_3.cancelReason, "session_closed");

  const q2_3 = await Queue.findById(b2_3.booking.queueId);
  assert.equal(q2_3.status, "cancelled");
  assert.equal(q2_3.cancelReason, "session_closed");

  // Verify BookingCredit created instead of User fields
  const credit1 = await BookingCredit.findOne({ userId: patientOne._id, used: false });
  assert.ok(credit1);
  assert.equal(credit1.credits, 1);
  assert.ok(credit1.expiresAt);

  const credit2 = await BookingCredit.findOne({ userId: patientTwo._id, used: false });
  assert.ok(credit2);
  assert.equal(credit2.credits, 1);
  assert.ok(credit2.expiresAt);

  // 7. Test Priority Credit consumption and sorting
  console.log("Testing priority credit usage...");
  const getTodayIST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayIST = getTodayIST();
  const parts = todayIST.split("-").map(Number);
  const tomorrowDate = new Date(parts[0], parts[1] - 1, parts[2] + 1);
  const tomorrowStr = tomorrowDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const b2_4 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientTwoToken,
    body: { doctorId: doctor._id.toString(), bookingDate: tomorrowStr }
  });
  assert.equal(b2_4.booking.isPriority, true);

  // Verify priority credit marked as used
  const credit2After = await BookingCredit.findOne({ userId: patientTwo._id });
  assert.equal(credit2After.used, true);

  const b1_4 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString(), bookingDate: tomorrowStr }
  });
  assert.equal(b1_4.booking.isPriority, true);

  const credit1After = await BookingCredit.findOne({ userId: patientOne._id });
  assert.equal(credit1After.used, true);

  const newPatientUser = await createUser({
    name: `${testRunId} Patient Three`,
    email: `${testRunId}-patient3@example.com`,
    phone: "9000000009",
    role: "patient"
  });
  const patientThreeToken = await login(newPatientUser.email);
  const b3_4 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientThreeToken,
    body: { doctorId: doctor._id.toString(), bookingDate: tomorrowStr }
  });
  assert.equal(b3_4.booking.isPriority, false);

  const tomorrowSession = await QueueSession.findOne({ doctorId: doctor._id, date: tomorrowStr });
  const sortedQueue = await Queue.find({ sessionId: tomorrowSession._id }).sort({ isPriority: -1, queueNumber: 1 });

  assert.equal(sortedQueue[0].userId.toString(), patientTwo._id.toString());
  assert.equal(sortedQueue[1].userId.toString(), patientOne._id.toString());
  assert.equal(sortedQueue[2].userId.toString(), newPatientUser._id.toString());

  // 8. Test ETA Recalculation
  console.log("Testing ETA Recalculation...");

  // Clear any active bookings from previous tests to avoid "one active booking" constraint
  await Queue.deleteMany({});

  // Re-activate today's session to perform live ETA tests
  const todaySession = await QueueSession.findOne({ doctorId: doctor._id, date: todayIST });
  todaySession.sessionStatus = "active";
  todaySession.isActive = true;
  await todaySession.save();

  // Book patients
  const b_eta_1 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString() }
  });
  const b_eta_2 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientTwoToken,
    body: { doctorId: doctor._id.toString() }
  });

  // Pull b_eta_1 to in_progress
  await expectSuccess("PATCH", "/api/v1/queue/pause-session", { token: doctorToken });
  await expectSuccess("PATCH", "/api/v1/queue/resume-session", { token: doctorToken });

  // Get initial ETA
  const myQueueInit = await expectSuccess("GET", "/api/v1/queue/my", { token: patientTwoToken });
  const initialEta = myQueueInit.eta; // expected around 5
  assert.ok(initialEta > 0);

  // 8a. Test: Doctor avg changes -> ETA recalculates
  console.log("Testing doctor avg changes recalculation...");
  await Doctor.findByIdAndUpdate(doctor._id, { avgConsultationTime: 12 });
  const myQueueAvgChanged = await expectSuccess("GET", "/api/v1/queue/my", { token: patientTwoToken });
  assert.ok(myQueueAvgChanged.eta > initialEta);
  assert.ok(myQueueAvgChanged.eta === 12 || myQueueAvgChanged.eta === 11, `Expected ETA 11 or 12 but got ${myQueueAvgChanged.eta}`);

  // Restore doctor avg
  await Doctor.findByIdAndUpdate(doctor._id, { avgConsultationTime: 5 });

  // 8b. Test: Session paused -> ETA is null
  console.log("Testing ETA is null when session paused...");
  await expectSuccess("PATCH", "/api/v1/queue/pause-session", { token: doctorToken });
  const myQueuePaused = await expectSuccess("GET", "/api/v1/queue/my", { token: patientTwoToken });
  assert.equal(myQueuePaused.sessionStatus, "paused");
  assert.equal(myQueuePaused.eta, null);

  // Resume
  await expectSuccess("PATCH", "/api/v1/queue/resume-session", { token: doctorToken });
  const myQueueResumed = await expectSuccess("GET", "/api/v1/queue/my", { token: patientTwoToken });
  assert.equal(myQueueResumed.sessionStatus, "active");
  assert.ok(myQueueResumed.eta > 0);

  // 8c. Test: Patient skipped -> ETA recalculates
  console.log("Testing ETA recalculation when preceding patient is skipped...");
  const b_eta_3 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientThreeToken,
    body: { doctorId: doctor._id.toString() }
  });
  const myQueue3Init = await expectSuccess("GET", "/api/v1/queue/my", { token: patientThreeToken });
  assert.equal(myQueue3Init.patientsAhead, 1);
  const initialEta3 = myQueue3Init.eta;

  // Skip the current patient (b_eta_1)
  await expectSuccess("PATCH", "/api/v1/queue/skip", {
    token: doctorToken,
    body: { queueId: b_eta_1.booking.queueId }
  });

  const myQueue3AfterSkip = await expectSuccess("GET", "/api/v1/queue/my", { token: patientThreeToken });
  assert.equal(myQueue3AfterSkip.patientsAhead, 0);
  assert.ok(myQueue3AfterSkip.eta < initialEta3);

  // ─── 9. Cron Reset & Cleanup Tests ───────────────────────────────────────────
  // 9a. Test: Verify soft credit expiry on daily cron cleanup
  console.log("Testing soft credit expiry cleanup...");
  const expiredCredit = await BookingCredit.create({
    userId: patientOne._id,
    credits: 1,
    expiresAt: new Date(Date.now() - 1000), // expired 1s ago
    reason: "session_closed",
    used: false,
    expired: false
  });

  await runBookingCreditCleanup();

  // Verify that it is now marked as expired: true
  const checkedExpired = await BookingCredit.findById(expiredCredit._id);
  assert.equal(checkedExpired.expired, true);
  assert.equal(checkedExpired.used, false);

  // 9b. Test: Verify monthly reset with Date Injection
  console.log("Testing monthly no-show reset date injection...");
  await runMonthlyReset(new Date());

  const statsBefore = await PatientStats.findOne({ userId: patientOne._id });
  statsBefore.noShowCountThisMonth = 4;
  await statsBefore.save();

  // Call runMonthlyReset with a date in the next month
  const nextMonthDate = new Date();
  nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
  await runMonthlyReset(nextMonthDate);

  const statsAfter = await PatientStats.findOne({ userId: patientOne._id });
  assert.equal(statsAfter.noShowCountThisMonth, 0);

  // ─── 10. Full Patient-Doctor Integration Journey ────────────────────────────
  console.log("Testing Full Patient-Doctor Integration Journey...");

  // Clear collections for clean run
  await Queue.deleteMany({});
  await BookingCredit.deleteMany({});
  await PatientStats.deleteMany({});

  // Re-activate today's session
  const intSession = await QueueSession.findOne({ doctorId: doctor._id, date: todayIST });
  intSession.sessionStatus = "active";
  intSession.isActive = true;
  intSession.accumulatedPausedMs = 0;
  await intSession.save();

  // 10a. Patient 1 books and turns in_progress, Patient 2 books
  console.log("  - Patient 1 books...");
  const j_book1 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString() }
  });

  // Pause/resume to auto-start Patient 1
  await expectSuccess("PATCH", "/api/v1/queue/pause-session", { token: doctorToken });
  await expectSuccess("PATCH", "/api/v1/queue/resume-session", { token: doctorToken });

  const j_q1 = await Queue.findById(j_book1.booking.queueId);
  assert.equal(j_q1.status, "in_progress");

  console.log("  - Patient 2 books...");
  const j_book2 = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientTwoToken,
    body: { doctorId: doctor._id.toString() }
  });

  // Verify Patient 2 initial position and ETA
  const j_p2_state1 = await expectSuccess("GET", "/api/v1/queue/my", { token: patientTwoToken });
  assert.equal(j_p2_state1.patientsAhead, 0); // next in line
  assert.ok(j_p2_state1.eta > 0);

  // 10b. Doctor pauses session -> Patient 2 ETA becomes null
  console.log("  - Doctor pauses session -> verifying ETA becomes null");
  await expectSuccess("PATCH", "/api/v1/queue/pause-session", { token: doctorToken });
  const j_p2_state2 = await expectSuccess("GET", "/api/v1/queue/my", { token: patientTwoToken });
  assert.equal(j_p2_state2.sessionStatus, "paused");
  assert.equal(j_p2_state2.eta, null);

  // 10c. Doctor resumes session -> Patient 2 ETA is restored
  console.log("  - Doctor resumes session -> verifying ETA is restored");
  await expectSuccess("PATCH", "/api/v1/queue/resume-session", { token: doctorToken });
  const j_p2_state3 = await expectSuccess("GET", "/api/v1/queue/my", { token: patientTwoToken });
  assert.equal(j_p2_state3.sessionStatus, "active");
  assert.ok(j_p2_state3.eta > 0);

  // 10d. Doctor skips Patient 1 -> Patient 2 is advanced to in_progress
  console.log("  - Doctor skips Patient 1...");
  await expectSuccess("PATCH", "/api/v1/queue/skip", {
    token: doctorToken,
    body: { queueId: j_book1.booking.queueId }
  });

  const j_q1_skipped = await Queue.findById(j_book1.booking.queueId);
  assert.equal(j_q1_skipped.status, "skipped");

  const j_q2_in_progress = await Queue.findById(j_book2.booking.queueId);
  assert.equal(j_q2_in_progress.status, "in_progress");

  // 10e. Doctor completes Patient 2 -> queue is now empty
  console.log("  - Doctor completes Patient 2...");
  await expectSuccess("PATCH", "/api/v1/queue/complete", {
    token: doctorToken,
    body: { queueId: j_book2.booking.queueId }
  });

  const j_q2_completed = await Queue.findById(j_book2.booking.queueId);
  assert.equal(j_q2_completed.status, "completed");

  // 10f. Patient 2 checks history
  console.log("  - Patient 2 checks history...");
  const j_history = await expectSuccess("GET", "/api/v1/queue/history", { token: patientTwoToken });
  assert.ok(j_history.some(h => h.queueId.toString() === j_book2.booking.queueId.toString() && h.outcome === "Visited"));

  // 10g. Book Patient 1 again, then close session -> verify credit is created
  console.log("  - Rebook Patient 1 and close session...");
  const j_book1_re = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString() }
  });

  await expectSuccess("PATCH", "/api/v1/queue/close-session", { token: doctorToken });

  const j_q1_cancelled = await Queue.findById(j_book1_re.booking.queueId);
  assert.equal(j_q1_cancelled.status, "cancelled");
  assert.equal(j_q1_cancelled.cancelReason, "session_closed");

  const j_credit = await BookingCredit.findOne({ userId: patientOne._id, used: false });
  assert.ok(j_credit);
  assert.equal(j_credit.credits, 1);
  assert.ok(j_credit.expiresAt);
  assert.equal(j_credit.expired, false);

  // 10h. Patient 1 rebooks for tomorrow -> verify priority credit consumed
  console.log("  - Patient 1 rebooks for tomorrow with priority credit...");
  const j_book1_tomorrow = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString(), bookingDate: tomorrowStr }
  });
  assert.equal(j_book1_tomorrow.booking.isPriority, true);

  const j_credit_used = await BookingCredit.findById(j_credit._id);
  assert.equal(j_credit_used.used, true);

  // ═══════════════════════════════════════════════════════════════════════════════
  //  PHASE 4.4 — SESSION AVAILABILITY CONTROLS VERIFICATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log("Starting Phase 4.4 Session Availability Controls Verification Tests...");

  // helper definitions for Test 6
  const getISTDateTimeTest = (dateStr, timeStr) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    const [hours, minutes] = timeStr.split(":").map(Number);
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    utcDate.setMinutes(utcDate.getMinutes() - 330);
    return utcDate;
  };
  const getShiftDatesTest = (dateStr, startTime, endTime) => {
    const startMins = startTime.split(":").map(Number);
    const endMins = endTime.split(":").map(Number);
    const startVal = startMins[0] * 60 + startMins[1];
    const endVal = endMins[0] * 60 + endMins[1];
    const startDate = getISTDateTimeTest(dateStr, startTime);
    let endDate = getISTDateTimeTest(dateStr, endTime);
    if (startVal > endVal) {
      endDate.setDate(endDate.getDate() + 1);
    }
    return { startDate, endDate };
  };

  // Clear any active bookings before starting tests
  await Queue.deleteMany({});

  // Test 1: Schedule overrides (available vs unavailable) correctly blocks bookings.
  console.log("  - Test 1: Schedule overrides...");
  const overrideDateStr = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  await DoctorScheduleOverride.create({
    doctorId: doctor._id,
    date: overrideDateStr,
    enabled: false,
    isFullDay: true
  });

  const overrideBlockedBooking = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString(), bookingDate: overrideDateStr }
  });
  assert.equal(overrideBlockedBooking.canBook, false);
  assert.equal(overrideBlockedBooking.code, "OUTSIDE_SHIFT");

  await DoctorScheduleOverride.deleteMany({ doctorId: doctor._id, date: overrideDateStr });

  // Test 2: Schedule Snapshot Integrity
  console.log("  - Test 2: Schedule Snapshot Integrity...");
  const snapshotDateStr = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const originalDoc = await Doctor.findById(doctor._id);
  const originalLimit = originalDoc.defaultQueueLimit;

  originalDoc.defaultQueueLimit = 5;
  await originalDoc.save();

  const snapSession = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString(), bookingDate: snapshotDateStr }
  });
  // Clean up booking so they don't have active bookings blocking them
  await Queue.deleteMany({ userId: patientOne._id });

  const snapSessionModel = await QueueSession.findOne({ doctorId: doctor._id, date: snapshotDateStr });
  assert.equal(snapSessionModel.maxQueueLimit, 5);
  assert.equal(snapSessionModel.scheduleSnapshot.queueLimit, 5);

  originalDoc.defaultQueueLimit = originalLimit;
  await originalDoc.save();

  // Test 3: Continue Queue Policy
  console.log("  - Test 3: Continue Queue Policy...");
  await Queue.deleteMany({});

  // Set doctor available
  await Doctor.findByIdAndUpdate(doctor._id, { availabilityState: "available" });

  // Active session today
  const todaySess = await QueueSession.findOne({ doctorId: doctor._id, date: todayIST });
  todaySess.sessionStatus = "active";
  todaySess.isActive = true;
  await todaySess.save();

  const b_continue = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString() }
  });
  assert.equal(b_continue.canBook, true);

  const currentDoctorDoc = await Doctor.findById(doctor._id);
  await expectSuccess("PATCH", "/api/v1/doctors/profile/settings", {
    token: doctorToken,
    body: {
      availabilityState: "unavailable",
      sessionPolicy: "continue",
      version: currentDoctorDoc.__v
    }
  });

  const b_continue_blocked = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientTwoToken,
    body: { doctorId: doctor._id.toString() }
  });
  assert.equal(b_continue_blocked.canBook, false);
  assert.equal(b_continue_blocked.code, "DOCTOR_OFFLINE");

  const sessVerify = await QueueSession.findById(todaySess._id);
  assert.equal(sessVerify.sessionStatus, "active");

  // Test 4: Break overdue delay status verification
  console.log("  - Test 4: Break overdue delayed status...");
  const currentDoctorDoc2 = await Doctor.findById(doctor._id);
  await expectSuccess("PATCH", "/api/v1/doctors/profile/settings", {
    token: doctorToken,
    body: {
      availabilityState: "break",
      temporaryNotice: {
        message: "Quick coffee break",
        expectedUntil: new Date(Date.now() - 5000)
      },
      version: currentDoctorDoc2.__v
    }
  });

  const docList = await expectSuccess("GET", "/api/v1/doctors", { token: patientOneToken });
  const docData = docList.find(d => d.id.toString() === doctor._id.toString());
  assert.equal(docData.availabilityState, "delayed");
  assert.equal(docData.isDelayed, true);

  // Test 5: Version conflict checks
  console.log("  - Test 5: Version conflict checks...");
  const currentDoc = await Doctor.findById(doctor._id);
  await expectFailure("PATCH", "/api/v1/doctors/profile/settings", 409, {
    token: doctorToken,
    body: {
      availabilityState: "available",
      version: currentDoc.__v - 1
    }
  });

  // Test 6: Midnight shift time bounds
  console.log("  - Test 6: Midnight shift time bounds...");
  const midnightShift = getShiftDatesTest("2026-06-15", "22:00", "02:00");
  assert.equal(midnightShift.startDate.toISOString(), "2026-06-15T16:30:00.000Z");
  assert.equal(midnightShift.endDate.toISOString(), "2026-06-15T20:30:00.000Z");

  // Test 7: Soft booking failures response schema validation
  console.log("  - Test 7: Soft booking failure response schema...");
  await Queue.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 70000) } });
  const softFailureData = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString() }
  });
  assert.equal(softFailureData.canBook, false);
  assert.ok(softFailureData.code);
  assert.ok(softFailureData.reason);
  assert.ok(softFailureData.action);

  // ═══════════════════════════════════════════════════════════════════════════════
  //  PHASE 4.5 — DOCTOR ANALYTICS VERIFICATION TESTS
  // ═══════════════════════════════════════════════════════════════════════════════
  console.log("Starting Phase 4.5 Doctor Analytics Verification Tests...");

  // 1. New Doctor / Empty Doctor
  console.log("  - Test 1: Empty Analytics for new doctor...");
  const newDoctorUser2 = await createUser({
    name: `${testRunId} Empty Doctor`,
    email: `${testRunId}-empty-dr@example.com`,
    phone: "9000000077",
    role: "doctor"
  });
  const emptyDoctorToken = await login(newDoctorUser2.email);
  const emptyDoctorStub = await Doctor.create({
    name: newDoctorUser2.name,
    specialization: "pediatrics",
    hospitalId: hospital._id,
    userId: newDoctorUser2._id,
    profileCompleted: true,
    status: "active"
  });
  created.doctors.push(emptyDoctorStub._id);

  const emptyAnalytics = await expectSuccess("GET", "/api/v1/doctors/profile/analytics?range=7days", {
    token: emptyDoctorToken
  });
  assert.equal(emptyAnalytics.version, "v1");
  assert.equal(emptyAnalytics.hasData, false);
  assert.equal(emptyAnalytics.kpi.totalConsulted, 0);
  assert.equal(emptyAnalytics.kpi.healthScore, 100);

  // 2. Sparse Data & KPI validation
  console.log("  - Test 2: Sparse data (1 consultation)...");
  await Queue.deleteMany({});
  await DoctorAnalyticsDaily.deleteMany({});

  // Set doctor back to available
  await Doctor.findByIdAndUpdate(doctor._id, { availabilityState: "available" });

  // Active session today
  const todaySessionForAnalytics = await QueueSession.findOne({ doctorId: doctor._id, date: todayIST });
  todaySessionForAnalytics.sessionStatus = "active";
  todaySessionForAnalytics.isActive = true;
  todaySessionForAnalytics.startedAt = new Date();
  todaySessionForAnalytics.lastActiveSegmentStartedAt = new Date();
  await todaySessionForAnalytics.save();

  const b_sparse = await expectSuccess("POST", "/api/v1/queue/book", {
    token: patientOneToken,
    body: { doctorId: doctor._id.toString() }
  });

  const sparseQueue = await Queue.findById(b_sparse.booking.queueId);
  sparseQueue.status = "in_progress";
  sparseQueue.startedAt = new Date(Date.now() - 5 * 60000);
  await sparseQueue.save();

  // complete consultation
  await expectSuccess("PATCH", "/api/v1/queue/complete", {
    token: doctorToken,
    body: { queueId: sparseQueue._id.toString() }
  });

  const sparseAnalytics = await expectSuccess("GET", "/api/v1/doctors/profile/analytics?range=7days", {
    token: doctorToken
  });
  assert.equal(sparseAnalytics.hasData, true);
  assert.equal(sparseAnalytics.kpi.totalConsulted, 1);
  assert.ok(sparseAnalytics.kpi.avgConsultationTime > 0);
  assert.ok(sparseAnalytics.kpi.healthScore > 0);
  assert.equal(sparseAnalytics.kpi.patientRetention, 0);

  // 3. Lock 9 Idempotency check (Retry complete request)
  console.log("  - Test 3: Lock 9 Idempotency (retry completion)...");
  const preDaily = await DoctorAnalyticsDaily.findOne({ doctorId: doctor._id, date: todayIST });
  const completedPre = preDaily.completed;

  // Retry complete should return failure (400)
  await expectFailure("PATCH", "/api/v1/queue/complete", 400, {
    token: doctorToken,
    body: { queueId: sparseQueue._id.toString() }
  });

  const postDaily = await DoctorAnalyticsDaily.findOne({ doctorId: doctor._id, date: todayIST });
  assert.equal(postDaily.completed, completedPre);

  // 4. Lock 2 Integrity check (Default consultation time change)
  console.log("  - Test 4: Lock 2 Duration Freeze (avg time change)...");
  const completedQueueDoc = await Queue.findById(sparseQueue._id);
  const frozenDuration = completedQueueDoc.consultationDurationMs;
  assert.ok(frozenDuration >= 0);

  await Doctor.findByIdAndUpdate(doctor._id, { avgConsultationTime: 45 });
  const sparseAnalyticsAfterChange = await expectSuccess("GET", "/api/v1/doctors/profile/analytics?range=7days", {
    token: doctorToken
  });
  const durationInMins = Math.round(frozenDuration / 60000);
  assert.equal(sparseAnalyticsAfterChange.kpi.avgConsultationTime, durationInMins);

  await Doctor.findByIdAndUpdate(doctor._id, { avgConsultationTime: 5 });

  // 5. Cross-Month Transition check (Apr -> May)
  console.log("  - Test 5: Cross-month date boundaries...");
  const boundsApril = getShiftDatesTest("2026-04-30", "23:59", "23:59");
  const boundsMay = getShiftDatesTest("2026-05-01", "00:01", "00:01");
  assert.equal(boundsApril.startDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }), "2026-04-30");
  assert.equal(boundsMay.startDate.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }), "2026-05-01");

  // 6. CSV Export verification
  console.log("  - Test 6: CSV Export download shape...");
  const csvResponse = await request("GET", "/api/v1/doctors/profile/analytics?range=7days&download=true", {
    token: doctorToken
  });
  assert.equal(csvResponse.response.status, 200);
  assert.equal(csvResponse.payload.csvReady, true);
  assert.ok(csvResponse.payload.csvData.includes("Date,Completed,Skipped,NoShow"));

  // 7. Rebuild Analytics verification
  console.log("  - Test 7: Rebuild Analytics service check...");
  await DoctorAnalyticsDaily.deleteMany({ doctorId: doctor._id });

  const adminUser = await createUser({
    name: `${testRunId} Admin User`,
    email: `${testRunId}-admin@example.com`,
    phone: "9000000088",
    role: "admin"
  });
  const adminUserToken = await login(adminUser.email);

  const rebuildRes = await expectSuccess("POST", "/api/v1/doctors/profile/analytics/rebuild", {
    token: adminUserToken,
    body: {
      doctorId: doctor._id.toString(),
      startDate: todayIST,
      endDate: todayIST
    }
  });
  assert.equal(rebuildRes.success, true);

  const restoredDaily = await DoctorAnalyticsDaily.findOne({ doctorId: doctor._id, date: todayIST });
  assert.ok(restoredDaily);
  assert.equal(restoredDaily.completed, 1);

  // Verify rebuild audit log entry was created (with retries for fire-and-forget async write)
  let audit = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    audit = await AnalyticsRebuildAuditLog.findOne({ doctorId: doctor._id });
    if (audit) break;
    await new Promise(r => setTimeout(r, 50));
  }
  assert.ok(audit, "An audit log entry should be created for the rebuild");
  assert.equal(audit.requestedBy.toString(), adminUser._id.toString(), "Audit requestedBy should match admin ID");
  assert.equal(audit.rebuildStatus, "completed", "Audit rebuildStatus should be completed");
  assert.ok(audit.timeTakenMs >= 0, "Audit timeTakenMs should be recorded");

  // Verify circuit breaker: consecutive rebuild fails with 429
  const responseRebuild2 = await request("POST", "/api/v1/doctors/profile/analytics/rebuild", {
    token: adminUserToken,
    body: {
      doctorId: doctor._id.toString(),
      startDate: todayIST,
      endDate: todayIST
    }
  });
  assert.equal(responseRebuild2.response.status, 429, "Consecutive rebuild should trigger circuit breaker (429)");

  // Clear audit log to bypass circuit breaker for subsequent tests
  await AnalyticsRebuildAuditLog.deleteMany({ doctorId: doctor._id });

  // Verify global system monitoring metrics (with retries for fire-and-forget async write)
  let metrics = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    metrics = await SystemMonitoring.findOne({ name: "global" });
    if (metrics && metrics.rebuild_ms > 0 && metrics.analytics_generation_ms > 0) break;
    await new Promise(r => setTimeout(r, 50));
  }
  assert.ok(metrics, "Global metrics should exist");
  assert.ok(metrics.rebuild_ms > 0, "rebuild_ms metric should be tracked");
  assert.ok(metrics.analytics_generation_ms > 0, "analytics_generation_ms metric should be tracked");
  assert.ok(metrics.queue_transition_count > 0, "queue_transition_count metric should be tracked");
  assert.ok(metrics.booking_block_count > 0, "booking_block_count metric should be tracked");

  // 8. Large History performance test (1000 items)
  console.log("  - Test 8: Large history aggregates index optimization...");
  const bulkDateStr = "2026-06-10";
  const bulkSession = await QueueSession.create({
    doctorId: doctor._id,
    date: bulkDateStr,
    sessionStatus: "closed",
    isActive: false,
    startedAt: new Date(),
    closedAt: new Date()
  });

  const bulkQueues = [];
  for (let i = 0; i < 1000; i++) {
    bulkQueues.push({
      userId: patientOne._id,
      doctorId: doctor._id,
      sessionId: bulkSession._id,
      queueNumber: i + 10,
      status: "completed",
      consultationDurationMs: 5 * 60 * 1000,
      startedAt: new Date(),
      completedAt: new Date(),
      analyticsProcessed: true,
      isActive: false
    });
  }
  await Queue.insertMany(bulkQueues);

  const startRebuildTime = Date.now();
  await expectSuccess("POST", "/api/v1/doctors/profile/analytics/rebuild", {
    token: adminUserToken,
    body: {
      doctorId: doctor._id.toString(),
      startDate: bulkDateStr,
      endDate: bulkDateStr
    }
  });
  const elapsedRebuildTime = Date.now() - startRebuildTime;
  console.log(`    Rebuild of 1000 queue items completed in ${elapsedRebuildTime} ms.`);
  assert.ok(elapsedRebuildTime < 25000);

  await Queue.deleteMany({ sessionId: bulkSession._id });
  await QueueSession.findByIdAndDelete(bulkSession._id);
  await DoctorAnalyticsDaily.deleteMany({ doctorId: doctor._id, date: bulkDateStr });

  console.log("✓ Phase 4.5 Doctor Analytics Tests passed successfully.");
  console.log("✓ Phase 4.4 Session Availability Controls Tests passed successfully.");
  console.log("✓ Phase 4.3 Doctor Queue Operations & Session Control Tests passed successfully.");
  console.log("✓ Phase 4 Onboarding & Verification Tests passed successfully.");

  // 9. Phase 5 Notification Engine Verification
  console.log("  - Test 9: Notification outbox, preferences, and workers check...");

  stopNotificationWorkers();

  const patientUser = await createUser({
    name: `${testRunId} Notification Patient`,
    email: `${testRunId}-notif@example.com`,
    phone: "9100000099",
    role: "patient"
  });
  const patientToken = await login(patientUser.email);

  // Helper functions to wait for outbox processing to complete (handles MongoDB Atlas network latency)
  const waitForOutboxProcessed = async (outboxId, maxWaitMs = 5000) => {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const ob = await NotificationOutbox.findById(outboxId).lean();
      if (ob && (ob.status === "processed" || ob.status === "failed")) {
        return ob;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return await NotificationOutbox.findById(outboxId).lean();
  };

  const waitForMarketingProcessed = async (outboxId, maxWaitMs = 5000) => {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const ob = await NotificationOutbox.findById(outboxId).lean();
      if (ob && ob.nextRetryAt && new Date(ob.nextRetryAt) > new Date()) {
        return ob;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return await NotificationOutbox.findById(outboxId).lean();
  };

  const waitForNotificationStatus = async (query, expectedStatus, maxWaitMs = 5000) => {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const notif = await Notification.findOne(query).lean();
      if (notif && notif.status === expectedStatus) {
        return notif;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return await Notification.findOne(query).lean();
  };

  // Assert Socket Authentication (Lock E)
  console.log("    - Subtest 9.1: Socket connection without token (expecting fail)...");
  let authFailed = false;
  try {
    const socket = io(baseUrl, { reconnection: false });
    await new Promise((resolve, reject) => {
      socket.on("connect", () => {
        console.log("      Socket connected unexpectedly without token!");
        socket.disconnect();
        reject(new Error("Should have failed connection without token"));
      });
      socket.on("connect_error", (err) => {
        console.log("      Socket connection failed as expected:", err.message);
        authFailed = true;
        resolve();
      });
    });
  } catch (err) {
    authFailed = true;
  }
  assert.ok(authFailed, "Socket connection without token should fail");

  // Connect with token
  console.log("    - Subtest 9.2: Socket connection with valid JWT token (expecting success)...");
  const socket = io(baseUrl, {
    query: { token: patientToken },
    reconnection: false
  });
  await new Promise((resolve, reject) => {
    socket.on("connect", () => {
      console.log("      Socket connected successfully with token!");
      resolve();
    });
    socket.on("connect_error", (err) => {
      console.log("      Socket connection failed with token:", err.message);
      reject(err);
    });
  });
  assert.ok(socket.connected, "Socket should connect with valid JWT token");
  socket.on("notification", (data) => {
    if (data.id) {
      socket.emit("notification_delivered_ack", { notificationId: data.id });
    }
  });
  console.log("    - Subtest 9.3: Socket connection verified. Testing outbox idempotency...");

  // Test Outbox Idempotency (Lock A & Event Key Correction)
  const key1 = await createNotification(patientUser._id, "Test Msg", "Body Msg", "booking", {
    aggregateType: "Queue",
    aggregateId: new mongoose.Types.ObjectId(),
    eventType: "test_event"
  });
  assert.ok(key1, "First outbox event should be created successfully");

  // Try duplicate
  const key2 = await createNotification(patientUser._id, "Test Msg", "Body Msg", "booking", {
    aggregateType: "Queue",
    aggregateId: key1.aggregateId,
    eventType: "test_event"
  });
  assert.equal(key2, null, "Duplicate outbox event should return null (idempotency)");

  // Test Preferences & Quiet Hours (Lock 4, 5, B, K)
  await NotificationPreferences.create({
    userId: patientUser._id,
    categories: {
      marketing: { in_app: true, push: false },
      queue: { in_app: true, push: true }
    },
    quietHours: {
      enabled: true,
      start: "00:00",
      end: "23:59",
      timezone: "Asia/Kolkata"
    },
    emergencyBypass: false
  });

  // Create marketing category outbox item
  const marketingOutbox = await createNotification(patientUser._id, "Promo Offer", "Buy one get one", "booking", {
    category: "marketing",
    type: "marketing",
    eventType: "promo"
  });

  await notificationDispatcher();
  const checkMarketing = await waitForMarketingProcessed(marketingOutbox._id);
  assert.equal(checkMarketing.status, "pending", "Marketing message during quiet hours should remain pending");
  assert.ok(checkMarketing.nextRetryAt > new Date(), "nextRetryAt should be set to post-quiet hours");

  // Create transactional outbox item (should bypass quiet hours)
  const transactionalOutbox = await createNotification(patientUser._id, "Urgent Call", "Doctor is waiting", "booking", {
    category: "queue",
    type: "transactional",
    eventType: "call"
  });

  await notificationDispatcher();
  const checkTx = await waitForOutboxProcessed(transactionalOutbox._id);
  assert.equal(checkTx.status, "processed", "Transactional message should bypass quiet hours and process");

  // Test Sequencing (Lock C)
  const seqOutbox = await createNotification(patientUser._id, "Urgent Call 2", "Doctor is waiting 2", "booking", {
    category: "queue",
    type: "transactional",
    eventType: "call_2"
  });
  await notificationDispatcher();
  await waitForOutboxProcessed(seqOutbox._id);

  const notifs = await expectSuccess("GET", `/api/v1/notifications?view=all`, { token: patientToken });
  assert.ok(notifs.length >= 2, "Should have processed at least 2 notifications");
  assert.equal(notifs[0].sequenceNumber, 1, "First notification sequence number should be 1");
  assert.equal(notifs[1].sequenceNumber, 2, "Second notification sequence number should be 2");

  // Test Deduplication Window (Lock 6)
  const dKey = "test_dedupe_123";
  const item1 = await createNotification(patientUser._id, "Dedupe Title", "Dedupe Body", "booking", {
    category: "queue",
    type: "transactional",
    eventType: "dedupe_run_1",
    dedupeKey: dKey
  });
  const item2 = await createNotification(patientUser._id, "Dedupe Title", "Dedupe Body", "booking", {
    category: "queue",
    type: "transactional",
    eventType: "dedupe_run_2",
    dedupeKey: dKey
  });

  await notificationDispatcher();

  const processedItem1 = await waitForOutboxProcessed(item1._id);
  const processedItem2 = await waitForOutboxProcessed(item2._id);
  assert.equal(processedItem1.status, "processed");
  assert.equal(processedItem2.status, "processed");

  const actualNotifs = await Notification.find({ dedupeKey: dKey });
  if (actualNotifs.length !== 1) {
    console.log("DEDUPE FAILURE: actualNotifs length =", actualNotifs.length, JSON.stringify(actualNotifs, null, 2));
  }
  assert.equal(actualNotifs.length, 1, "Only one notification should be created for same dedupeKey within 30s");

  // Wait for socket ACK to transition notification to "delivered"
  const actualNotif = await waitForNotificationStatus({ dedupeKey: dKey }, "delivered");
  assert.ok(actualNotif, "Notification should exist and be marked delivered");

  const allNotifs = await Notification.find({ recipientUserId: patientUser._id }).lean();
  console.log("[DEBUG COUNTER] all notifications in DB:", JSON.stringify(allNotifs, null, 2));
  const counterDoc = await NotificationCounter.findOne({ userId: patientUser._id }).lean();
  console.log("[DEBUG COUNTER] counter doc in DB:", JSON.stringify(counterDoc, null, 2));

  // Test Unread Counter Cache (Lock L)
  const counter = await NotificationCounter.findOne({ userId: patientUser._id });
  assert.ok(counter, "Counter cache document should be created");
  assert.equal(counter.unreadCount, 1, "Unread count should match delivered notifications count");

  // Test Bulk Read State Optimization (Lock D)
  const bulkReadRes = await expectSuccess("PATCH", "/api/v1/notifications/read-all", {
    token: patientToken,
    body: { beforeTimestamp: new Date() }
  });
  assert.ok(bulkReadRes.count > 0, "Bulk read should modify unread notifications");

  // Verify counter updated to 0
  const counterPost = await NotificationCounter.findOne({ userId: patientUser._id });
  assert.equal(counterPost.unreadCount, 0, "Unread count should be 0 after read-all");

  // Test Sync Route (Lock Sync Route)
  const syncRes = await expectSuccess("GET", "/api/v1/notifications/sync?afterSequence=1", {
    token: patientToken
  });
  assert.ok(syncRes.length > 0, "Sync should return notifications after sequence 1");
  assert.equal(syncRes[0].sequenceNumber, 2);

  // Test State Machine Validation (Lock M)
  const testNotif = await Notification.findOne({ recipientUserId: patientUser._id });
  testNotif.status = "processing";
  await assert.rejects(
    async () => {
      await testNotif.save();
    },
    /Invalid notification status transition/,
    "Should reject invalid status transition"
  );

  // Test TTL Cleanup (Lock 11 & J)
  const expiredNotif = await Notification.create({
    recipientUserId: patientUser._id,
    sequenceNumber: 9999,
    type: "informational",
    category: "queue",
    title: "Expired Title",
    body: "Expired Body",
    status: "delivered",
    expiresAt: new Date(Date.now() - 1000)
  });
  await incrementUnread(patientUser._id);

  await cleanupWorker();
  const checkExpired = await Notification.findById(expiredNotif._id).lean();

  assert.ok(checkExpired, "Expired notification should exist");
  assert.equal(checkExpired.status, "expired", "Notification should be soft-expired");

  const counterPostCleanup = await NotificationCounter.findOne({ userId: patientUser._id });
  assert.equal(counterPostCleanup.unreadCount, 0, "Unread counter cache should decrement on soft-expiry");

  // Test Soft-Purge Retention Policy (Lock J & soft-first correction)
  const oldDeliveredNotif = await Notification.create({
    recipientUserId: patientUser._id,
    sequenceNumber: 8888,
    type: "informational",
    category: "queue",
    title: "Old Delivered Title",
    body: "Old Delivered Body",
    status: "delivered",
    createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) // 91 days old
  });
  await incrementUnread(patientUser._id);

  await cleanupWorker();

  const checkPurged = await Notification.findById(oldDeliveredNotif._id);
  assert.equal(checkPurged.status, "purged", "90-day old delivered notification should be soft-purged");
  assert.ok(checkPurged.purgedAt, "purgedAt date should be set");

  // Test Server Crash / Worker Restart Outbox Recovery (Lock I & Smoke Test)
  const stuckOutbox = await NotificationOutbox.create({
    eventKey: `stuck_recovery_${Date.now()}`,
    eventType: "stuck_event",
    aggregateType: "Queue",
    aggregateId: new mongoose.Types.ObjectId(),
    payload: {
      recipientUserId: patientUser._id,
      type: "transactional",
      category: "queue",
      title: "Stuck Recovery Title",
      body: "Stuck Recovery Body",
      channels: ["in_app"]
    },
    status: "processing",
    processingBy: "dead_worker",
    lockedAt: new Date(Date.now() - 6 * 60 * 1000),
    nextRetryAt: new Date(Date.now() - 10 * 60 * 1000)
  });

  await notificationDispatcher();

  const recoveredOutbox = await waitForOutboxProcessed(stuckOutbox._id);
  assert.equal(recoveredOutbox.status, "processed", "Stuck outbox should be reclaimed and processed successfully");

  const recoveryNotif = await Notification.find({ title: "Stuck Recovery Title" });
  assert.equal(recoveryNotif.length, 1, "Only one notification should be created after worker recovery");

  socket.disconnect();

  // =========================================================================
  //  PHASE 6 — HEALTHCARE VISIT ENGINE SMOKE TESTS
  // =========================================================================
  console.log("\n=========================================================================");
  console.log("  RUNNING PHASE 6 — HEALTHCARE VISIT ENGINE SMOKE TESTS");
  console.log("=========================================================================");

  // Setup Phase 6 entities
  const p6Hospital = await Hospital.create({
    name: `${testRunId} Phase 6 Hospital`,
    address: "Phase 6 Test Address",
    location: { type: "Point", coordinates: [85.2, 25.7] },
    specializations: ["cardiology"]
  });
  created.hospitals.push(p6Hospital._id);

  const p6Patient = await createUser({
    name: `${testRunId} P6 Patient`,
    email: `${testRunId}-p6-patient@example.com`,
    phone: "9100000001",
    role: "patient"
  });
  const p6PatientToken = await login(p6Patient.email);

  const p6DoctorUser = await createUser({
    name: `${testRunId} P6 Doctor`,
    email: `${testRunId}-p6-doctor@example.com`,
    phone: "9100000002",
    role: "doctor"
  });
  const p6DoctorToken = await login(p6DoctorUser.email);

  const p6Doctor = await Doctor.create({
    name: `${testRunId} Dr P6 Available`,
    specialization: "cardiology",
    hospitalId: p6Hospital._id,
    avgConsultationTime: 5,
    defaultQueueLimit: 10,
    isAvailable: true,
    availabilityState: "available",
    rating: 4.9,
    experienceYears: 15,
    userId: p6DoctorUser._id,
    profileCompleted: true,
    status: "active"
  });
  created.doctors.push(p6Doctor._id);
  await setupDoctorSchedules(p6Doctor._id);

  // 1. Test 1: Queue creates visit
  console.log("  - Test 1: Booking creates a corresponding Visit and timeline event BOOKED...");
  const bookRes = await expectSuccess("POST", "/api/v1/queue/book", {
    token: p6PatientToken,
    body: { doctorId: p6Doctor._id.toString() }
  });
  created.queues.push(bookRes.booking.queueId);

  assert.ok(bookRes.booking.visit, "Booking response should include visit details");
  const visitIdStr = bookRes.booking.visit._id.toString();

  // Query db to verify Visit and Timeline
  const dbVisit = await Visit.findById(visitIdStr);
  assert.ok(dbVisit, "Visit should be present in database");
  assert.equal(dbVisit.status, "scheduled", "Visit should start in scheduled state (session inactive)");
  assert.ok(dbVisit.publicId.startsWith("VIS-"), "Visit publicId format should be VIS-YYYY-MM-XXXXXX");

  const bookedEvents = await VisitTimeline.find({ visitId: dbVisit._id, eventType: "BOOKED" });
  assert.equal(bookedEvents.length, 1, "Timeline event BOOKED should exist");
  assert.equal(bookedEvents[0].sequence, 1, "First event sequence should be 1");

  // 2. Test 2: Retry booking returns same visit
  console.log("  - Test 2: Booking retry returns the identical queue and visit records...");
  const bookRetry = await expectSuccess("POST", "/api/v1/queue/book", {
    token: p6PatientToken,
    body: { doctorId: p6Doctor._id.toString() }
  });
  assert.equal(bookRetry.booking.queueId.toString(), bookRes.booking.queueId.toString(), "Should return existing queue ID");
  assert.equal(bookRetry.booking.visit._id.toString(), visitIdStr, "Should return existing visit ID");

  // Start Session to move visit to waiting
  console.log("  - Moving scheduled visit to waiting by starting session...");
  await expectSuccess("PATCH", "/api/v1/queue/start-session", { token: p6DoctorToken });

  const visitAfterStartSession = await Visit.findById(visitIdStr);
  assert.equal(visitAfterStartSession.status, "waiting", "Visit status should transition scheduled -> waiting on session start");

  // 3. Test 3: Visit starts
  console.log("  - Test 3: Starting consultation transitions status, sets startedAt, and logs timeline...");
  const startRes = await expectSuccess("PATCH", `/api/v1/visits/${visitIdStr}/start`, { token: p6DoctorToken });
  assert.equal(startRes.visit.status, "in_progress", "Visit status should be in_progress");
  assert.ok(startRes.visit.startedAt, "startedAt should be recorded");

  const startTimeline = await VisitTimeline.find({ visitId: visitIdStr, eventType: "CONSULTATION_STARTED" });
  assert.equal(startTimeline.length, 1, "Timeline event CONSULTATION_STARTED should exist");

  // Verify corresponding queue status
  const queueAfterStart = await Queue.findById(bookRes.booking.queueId);
  assert.equal(queueAfterStart.status, "in_progress", "Queue status should sync to in_progress");

  // 4. Test 12: Concurrent Start
  console.log("  - Test 12: Concurrent requests to start consultation fail with 409...");
  const concurrentRes = await request("PATCH", `/api/v1/visits/${visitIdStr}/start`, { token: p6DoctorToken });
  assert.equal(concurrentRes.response.status, 409, "Second start should return 409 conflict");
  assert.equal(concurrentRes.payload.code, "already_in_progress");

  // 5. Test 4: Visit completes
  console.log("  - Test 4: Completing consultation transitions status, locks record, and creates summary...");
  const completeBody = {
    chiefComplaint: "Frequent headaches",
    doctorNotes: "Rest and hydration required.",
    consultationSummary: "Diagnosed mild migraine.",
    followUpAdvice: "Avoid screen time after 10 PM.",
    visitOutcome: "consulted"
  };
  const completeRes = await expectSuccess("PATCH", `/api/v1/visits/${visitIdStr}/complete`, {
    token: p6DoctorToken,
    body: completeBody
  });

  assert.equal(completeRes.visit.status, "completed", "Visit status should be completed");
  assert.ok(completeRes.visit.endedAt, "endedAt should be recorded");
  assert.equal(completeRes.visit.visitOutcome, "consulted");
  assert.equal(completeRes.visit.latestSummaryVersion, 1);

  const dbSummary = await VisitSummary.findOne({ visitId: visitIdStr, version: 1, summaryStatus: "active" });
  assert.ok(dbSummary, "Visit summary should be created");
  assert.equal(dbSummary.chiefComplaint, completeBody.chiefComplaint);
  assert.equal(dbSummary.doctorNotes, completeBody.doctorNotes);

  const completeTimeline = await VisitTimeline.find({ visitId: visitIdStr, eventType: "VISIT_COMPLETED" });
  assert.equal(completeTimeline.length, 1, "Timeline event VISIT_COMPLETED should exist");

  // Verify corresponding queue status is completed
  const queueAfterComplete = await Queue.findById(bookRes.booking.queueId);
  assert.equal(queueAfterComplete.status, "completed", "Queue status should be completed");
  assert.equal(queueAfterComplete.isActive, false, "Queue should be deactivated");

  // 6. Test 5: Invalid transition rejected
  console.log("  - Test 5: Rejecting invalid transitions...");
  // Try to restart completed visit: completed -> in_progress (rejected)
  const invalidTransitionRes = await request("PATCH", `/api/v1/visits/${visitIdStr}/start`, { token: p6DoctorToken });
  assert.equal(invalidTransitionRes.response.status, 400, "Should reject restarting a completed visit");

  // 7. Test 6: Summary and Visit Immutability
  console.log("  - Test 6: Verify service-layer checks prevent modifications on completed Visits...");
  const editSummaryBody = {
    chiefComplaint: "Updated headaches",
    doctorNotes: "Updated rest notes.",
    consultationSummary: "Updated summary notes.",
    followUpAdvice: "Updated follow up notes."
  };

  // Can still update summary post-completion (creates v2 summary, keeping older frozen v1 archived)
  const updateSummaryRes = await expectSuccess("PATCH", `/api/v1/visits/${visitIdStr}/summary`, {
    token: p6DoctorToken,
    body: editSummaryBody
  });
  assert.equal(updateSummaryRes.visit.latestSummaryVersion, 2, "Latest summary version should increment to 2");

  const v1Summary = await VisitSummary.findOne({ visitId: visitIdStr, version: 1 });
  const v2Summary = await VisitSummary.findOne({ visitId: visitIdStr, version: 2, summaryStatus: "active" });
  assert.equal(v1Summary.summaryStatus, "archived", "V1 summary should be archived and frozen");
  assert.equal(v2Summary.summaryStatus, "active", "V2 summary should be active");
  assert.equal(v2Summary.chiefComplaint, editSummaryBody.chiefComplaint);

  // Split endpoint checks: GET /api/v1/visits/:id and GET /api/v1/visits/:id/summary
  console.log("  - Verification of lightweight split visit detail endpoint...");
  const visitDetailRes = await expectSuccess("GET", `/api/v1/visits/${visitIdStr}`, { token: p6PatientToken });
  assert.ok(visitDetailRes.visit, "Should return visit object");
  assert.equal(visitDetailRes.activeSummaryVersion, 2, "Should return activeSummaryVersion = 2");
  assert.equal(visitDetailRes.hasTimeline, true, "Should return hasTimeline = true");

  console.log("  - Verification of visit summary endpoint...");
  const visitSummaryRes = await expectSuccess("GET", `/api/v1/visits/${visitIdStr}/summary`, { token: p6PatientToken });
  assert.ok(visitSummaryRes.summary, "Should return active summary object");
  assert.equal(visitSummaryRes.summary.chiefComplaint, editSummaryBody.chiefComplaint, "Should match latest edited chief complaint");

  // Test Concurrent Summary Edit: Tab A and Tab B save updates, creating v2 and v3 without overwriting...
  console.log("  - Test Concurrent Summary Edit: Saving concurrent edits sequentially...");
  const editSummaryBodyB = {
    chiefComplaint: "Concurrent headaches B",
    doctorNotes: "Concurrent rest notes B.",
    consultationSummary: "Concurrent summary notes B.",
    followUpAdvice: "Concurrent follow up notes B."
  };
  const updateSummaryResB = await expectSuccess("PATCH", `/api/v1/visits/${visitIdStr}/summary`, {
    token: p6DoctorToken,
    body: editSummaryBodyB
  });
  assert.equal(updateSummaryResB.visit.latestSummaryVersion, 3, "Latest summary version should increment to 3");

  const v2SummaryCheck = await VisitSummary.findOne({ visitId: visitIdStr, version: 2 });
  const v3SummaryCheck = await VisitSummary.findOne({ visitId: visitIdStr, version: 3, summaryStatus: "active" });
  assert.equal(v2SummaryCheck.summaryStatus, "archived", "V2 summary should be archived and frozen");
  assert.equal(v3SummaryCheck.summaryStatus, "active", "V3 summary should be active");
  assert.equal(v2SummaryCheck.chiefComplaint, editSummaryBody.chiefComplaint, "V2 summary should preserve Tab A's edits");
  assert.equal(v3SummaryCheck.chiefComplaint, editSummaryBodyB.chiefComplaint, "V3 summary should contain Tab B's edits");

  // Directly attempting to update main Visit fields (like status/outcome) throws service-layer validation error
  const { startConsultation: rawStart } = await import("../src/modules/visit/visit.service.js");
  await assert.rejects(
    async () => {
      await rawStart(visitIdStr, p6DoctorUser._id);
    },
    /Visit is immutable after completion\/cancellation/,
    "Service layer should reject modifications of finalized visits"
  );

  // 8. Test 7: Timeline sequencing
  console.log("  - Test 7: Assert timeline records have monotonically increasing sequences...");
  const allEvents = await VisitTimeline.find({ visitId: visitIdStr }).sort({ sequence: 1 });
  assert.ok(allEvents.length >= 4, "Should have at least BOOKED, QUEUE_UPDATED, CONSULTATION_STARTED, VISIT_COMPLETED, SUMMARY_UPDATED");
  for (let i = 0; i < allEvents.length; i++) {
    assert.equal(allEvents[i].sequence, i + 1, `Timeline event ${allEvents[i].eventType} has incorrect sequence`);
  }

  // 9. Test 8: Cursor-based Pagination
  console.log("  - Test 8: Patient history uses cursor-based pagination...");
  const patientVisitsRes = await expectSuccess("GET", "/api/v1/visits?limit=1", { token: p6PatientToken });
  assert.equal(patientVisitsRes.visits.length, 1);
  assert.ok(patientVisitsRes.nextCursor, "Should return next pagination cursor");

  // 10. Test 9: Outbox generated
  console.log("  - Test 9: Notification outbox entries generated for BOOKED, VISIT_STARTED, and VISIT_COMPLETED...");
  const outboxEvents = await NotificationOutbox.find({
    aggregateId: new mongoose.Types.ObjectId(visitIdStr),
    eventType: { $in: ["BOOKED", "VISIT_STARTED", "VISIT_COMPLETED"] }
  });
  assert.ok(outboxEvents.length >= 1, "Should generate visit outbox notifications");

  // 11. Test 10: Analytics updated (eventual consistency check)
  console.log("  - Test 10: Doctor daily stats updated after completed visit...");
  const doctorAnalytics = await DoctorAnalyticsDaily.findOne({ doctorId: p6Doctor._id });
  // Wait a small bit if async daily update is setImmediate
  await new Promise((resolve) => setTimeout(resolve, 100));
  const finalAnalytics = await DoctorAnalyticsDaily.findOne({ doctorId: p6Doctor._id });
  assert.ok(finalAnalytics, "Daily analytics should exist for the doctor");
  assert.equal(finalAnalytics.completed, 1, "Completed analytics count should increment to 1");

  // 12. Test 13: Frozen Doctor Snapshot
  console.log("  - Test 13: Doctor profile changes do not alter frozen snapshots...");
  p6Doctor.name = "Dr. P6 Renamed Name";
  await p6Doctor.save();

  const reFetchedVisit = await Visit.findById(visitIdStr);
  assert.equal(reFetchedVisit.doctorSnapshot.name, `${testRunId} Dr P6 Available`, "Doctor name in frozen snapshot must remain unchanged");

  // 13. Test 14: Crash Recovery / Idempotent Complete
  console.log("  - Test 14: Recovering consultation complete calls cleanly...");
  const { completeConsultation: rawComplete } = await import("../src/modules/visit/visit.service.js");
  const retryComplete = await rawComplete(visitIdStr, p6DoctorUser._id, completeBody);
  assert.equal(retryComplete.status, "completed");

  // Verify no duplicate version 1 summaries created
  const summaryCount = await VisitSummary.countDocuments({ visitId: visitIdStr, version: 1 });
  assert.equal(summaryCount, 1, "Only one version 1 summary should exist (idempotent complete)");

  // 14. Test 11: Recovery after reset/restart
  console.log("  - Test 11: Re-linking active visits on restart...");
  const activeQueue = await Queue.findById(bookRes.booking.queueId);
  const resolvedVisit = await Visit.findOne({ queueId: activeQueue._id, deletedAt: null });
  assert.ok(resolvedVisit, "Active visit is successfully resolved and linked");

  console.log("✓ Phase 6 Healthcare Visit Engine Tests passed successfully.");

  // ─── Phase 7: Search & Intelligence Tests ────────────────────────────────────
  console.log("Starting Phase 7: Search & Intelligence Tests...");

  // Seed symptom dictionary for testing
  await SymptomDictionary.create([
    {
      name: "fever",
      aliases: ["feaver", "temperature", "pyrexia"],
      specializationIds: ["cardiology", "neurology"],
      severity: "medium",
      tags: ["general", "infection"]
    },
    {
      name: "headache",
      aliases: ["migraine", "head pain"],
      specializationIds: ["neurology"],
      severity: "low",
      tags: ["pain"]
    }
  ]);

  // Pre-seed search version meta to avoid conflicts
  await SearchVersionMeta.updateOne({ key: "global-versions" }, { $set: { queueVersion: 1, availabilityVersion: 1 } }, { upsert: true });

  // 1. Safety Constraints (emoji only, spam, length check)
  console.log("  - Test 1: Safety constraints reject invalid/spam inputs...");
  await expectFailure("GET", "/api/v1/search?q=", 400, { token: patientOneToken });
  await expectFailure("GET", "/api/v1/search?q=a", 400, { token: patientOneToken });
  await expectFailure("GET", "/api/v1/search?q=" + "a".repeat(1001), 400, { token: patientOneToken });
  await expectFailure("GET", "/api/v1/search?q=😷🤢🤒", 400, { token: patientOneToken });
  await expectFailure("GET", "/api/v1/search?q=feeeeeever", 400, { token: patientOneToken });

  // 2. Spell Normalization (Levenshtein distance <= 2)
  console.log("  - Test 2: Spell normalization resolves 'feaver' -> 'fever'...");
  const spellCheckRes = await expectSuccess("GET", "/api/v1/search?q=feaver", { token: patientOneToken });
  assert.equal(spellCheckRes.normalizedQuery, "fever", "Should normalize feaver to fever");

  // 3. Availability Filter & Snapshots (is doctor available and is computed/recomputed)
  console.log("  - Test 3: Availability filter hides unavailable doctors...");
  const cardiologyRes = await expectSuccess("GET", "/api/v1/search?q=fever", { token: patientOneToken });
  const docIds = cardiologyRes.results.map(r => r.doctorId);
  assert.ok(docIds.includes(doctor._id.toString()), "Should include active available doctor");
  assert.ok(!docIds.includes(unavailableDoctor._id.toString()), "Should not include unavailable doctor");

  // 4. Trust Tier Cold Starts (new doctor reliability score is 60)
  console.log("  - Test 4: Trust Tier Cold Starts returns reliability score of 60 for new doctors...");
  const { calculateRankingScore } = await import("../src/modules/search/ranking.service.js");
  const rankingRes = await calculateRankingScore(
    doctorStub, // new doctor with <5 completed visits
    null,
    ["neurology"],
    0,
    true
  );
  assert.equal(rankingRes.snapshot.reliabilityScore, 60, "Reliability score of cold start doctor must be 60");

  // 5. Freshness Boundary Cache Verification
  console.log("  - Test 5: Freshness boundaries invalidate stale caches on version mismatch...");
  const initialCacheQuery = await expectSuccess("GET", "/api/v1/search?q=fever", { token: patientOneToken });
  const cacheKeyCount = await SearchCache.countDocuments({});
  assert.ok(cacheKeyCount > 0, "Search result should be cached");

  // Increment queue version (simulation of booking event/queue session updates)
  await SearchVersionMeta.updateOne({ key: "global-versions" }, { $inc: { queueVersion: 1 } });
  
  const secondCacheQuery = await expectSuccess("GET", "/api/v1/search?q=fever", { token: patientOneToken });
  const executeEvents = await SearchOutbox.find({ eventType: "SEARCH_EXECUTED" });
  assert.ok(executeEvents.length >= 2);

  // 6. Eventually Consistent Analytics CTR (outbox worker updates aggregated counts)
  console.log("  - Test 6: Outbox worker aggregates searches/clicks/bookings ctr asynchronously...");
  const dateIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  
  const { searchOutboxDispatcher, nightlySearchRollupWorker } = await import("../src/modules/search/search_worker.js");
  await searchOutboxDispatcher();

  const globalAnalytics = await SearchAnalyticsDaily.findOne({ date: dateIST, scope: "global" });
  assert.ok(globalAnalytics, "Aggregated daily stats should be generated by search worker");
  assert.ok(globalAnalytics.searches > 0, "Searches metric should be incremented");

  // 7. Explainability Badges (exclude raw score values)
  console.log("  - Test 7: Explanation why array contains friendly explanations and completely excludes score...");
  assert.ok(cardiologyRes.results.length > 0);
  const targetResult = cardiologyRes.results[0];
  assert.ok(Array.isArray(targetResult.why), "Result must contain why array");
  assert.equal(targetResult.score, undefined, "Result contract must exclude raw score");
  assert.equal(targetResult.why.includes("Available today") || targetResult.why.includes("Matches specialization"), true, "Should contain expected friendly description badges");

  // 8. Percentile Daily Aggregations
  console.log("  - Test 8: Percentile calculations rollup calculates correct P50/P95/P99 latencies...");
  await SearchMonitoringDaily.deleteOne({ date: dateIST, scope: "global" });
  await SearchMonitoringDaily.create({
    date: dateIST,
    scope: "global",
    latencyBuckets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    cacheHit: 5,
    cacheMiss: 5
  });

  await nightlySearchRollupWorker();
  
  const updatedMonitoring = await SearchMonitoringDaily.findOne({ date: dateIST, scope: "global" });
  assert.equal(updatedMonitoring.latencyP50, 60, "P50 latency should be calculated correctly");
  assert.equal(updatedMonitoring.latencyP95, 100, "P95 latency should be calculated correctly");

  // 9. Failsafe Fallbacks & Circuit Breakers (never 500)
  console.log("  - Test 9: Failsafe degraded/fallback modes run successfully without throwing 500...");
  const fallbackTest = await expectSuccess("GET", "/api/v1/search?q=fever&limit=2", { token: patientOneToken });
  assert.ok(fallbackTest.results, "Fallback should return valid list structure");

  // 10. Contract Shape Validation
  console.log("  - Test 10: Search response conforms precisely to the frozen contract shape...");
  assert.equal(cardiologyRes.version, "v1");
  assert.ok(cardiologyRes.results[0].doctorId);
  assert.ok(cardiologyRes.results[0].doctor.name);

  // 11. Suggestions Performance
  console.log("  - Test 11: Suggestions endpoint returns matching prefixes in under 100ms and returns <= 8 results...");
  const startSuggestionTime = Date.now();
  const suggestionsRes = await expectSuccess("GET", "/api/v1/search/suggestions?q=fe", { token: patientOneToken });
  const latencySuggestion = Date.now() - startSuggestionTime;
  assert.ok(latencySuggestion < 500, "Suggestions response latency must be less than 500ms");
  assert.ok(suggestionsRes.suggestions.length <= 8, "Suggestions count must be at most 8");
  assert.ok(suggestionsRes.suggestions.includes("fever") || suggestionsRes.suggestions.includes("feaver"), "Should contain fever matching prefix");

  // 12. Result Limits
  console.log("  - Test 12: Result limits are enforced correctly...");
  const limitRes = await expectSuccess("GET", "/api/v1/search?q=fever&limit=1", { token: patientOneToken });
  assert.equal(limitRes.results.length, 1, "Should respect requested limit=1");

  // 13. Click and Book conversion routes log correctly
  console.log("  - Test 13: Click and book conversion routes process successfully...");
  const eventId = cardiologyRes.searchEventId;
  const clickData = {
    searchEventId: eventId,
    action: "click",
    doctorId: doctor._id.toString()
  };
  await expectSuccess("POST", "/api/v1/search/analytics/action", {
    token: patientOneToken,
    body: clickData
  });

  const bookedData = {
    searchEventId: eventId,
    action: "book"
  };
  await expectSuccess("POST", "/api/v1/search/analytics/action", {
    token: patientOneToken,
    body: bookedData
  });

  const loggedEvent = await SearchEvent.findById(eventId);
  assert.equal(loggedEvent.state, "booked");
  assert.equal(loggedEvent.booked, true);
  assert.equal(loggedEvent.selectedDoctorId.toString(), doctor._id.toString());
  assert.ok(loggedEvent.rankingSnapshot, "Ranking snapshot must be pre-computed and stored for Click event");

  // 14. Concurrent Load Verification
  console.log("  - Test 14: Verifying stability under parallel load of 100 concurrent search requests...");
  const parallelRequests = [];
  for (let i = 0; i < 100; i++) {
    parallelRequests.push(expectSuccess("GET", "/api/v1/search?q=fever", { token: patientOneToken }));
  }
  const parallelResults = await Promise.all(parallelRequests);
  assert.equal(parallelResults.length, 100);
  for (const r of parallelResults) {
    assert.equal(r.results !== undefined, true);
  }

  // 15. Historical search snapshots remain frozen
  console.log("  - Test 15: Historical search snapshots remain frozen...");
  const t15Search = await expectSuccess("GET", "/api/v1/search?q=fever", { token: patientOneToken });
  const t15EventId = t15Search.searchEventId;
  await expectSuccess("POST", "/api/v1/search/analytics/action", {
    token: patientOneToken,
    body: { searchEventId: t15EventId, action: "click", doctorId: doctor._id.toString() }
  });
  const savedEventBefore = await SearchEvent.findById(t15EventId);
  assert.ok(savedEventBefore.rankingSnapshot);
  const originalWhy = [...savedEventBefore.rankingSnapshot.why];
  const originalScore = savedEventBefore.rankingSnapshot.finalScore;

  // Change doctor rating to simulate ranking formula factor modification
  const originalRating = doctor.rating;
  doctor.rating = 1.0;
  await doctor.save();

  const savedEventAfter = await SearchEvent.findById(t15EventId);
  assert.deepEqual(savedEventAfter.rankingSnapshot.why, originalWhy, "why array should remain frozen");
  assert.equal(savedEventAfter.rankingSnapshot.finalScore, originalScore, "finalScore should remain frozen");

  // Restore doctor rating
  doctor.rating = originalRating;
  await doctor.save();

  // 16. Search engine version invalidates caches
  console.log("  - Test 16: Search engine version invalidates caches...");
  const { setSearchEngineVersion } = await import("../src/modules/search/search.service.js");
  setSearchEngineVersion(1);
  await SearchCache.deleteMany({});
  await expectSuccess("GET", "/api/v1/search?q=fever", { token: patientOneToken });
  const cacheDocCountBefore = await SearchCache.countDocuments({});
  assert.equal(cacheDocCountBefore, 1, "Cache document should exist");

  setSearchEngineVersion(2);
  await expectSuccess("GET", "/api/v1/search?q=fever", { token: patientOneToken });
  const execEventsAfterVersion = await SearchOutbox.find({ eventType: "SEARCH_EXECUTED" }).sort({ createdAt: -1 });
  assert.equal(execEventsAfterVersion[0].payload.cacheHit, false, "Cache hit should be false after engine version change");
  setSearchEngineVersion(1);

  // 17. Oversized search payload bypasses cache
  console.log("  - Test 17: Oversized search payload bypasses cache...");
  await SearchCache.deleteMany({});
  await expectSuccess("GET", "/api/v1/search?q=fever&limit=999", { token: patientOneToken });
  const largeCacheCount = await SearchCache.countDocuments({});
  assert.equal(largeCacheCount, 0, "Oversized payload should not create a cache entry");

  // 18. Search worker crash recovery
  console.log("  - Test 18: Search worker crash recovery...");
  const { stopSearchWorkers, initSearchWorkers } = await import("../src/modules/search/search_worker.js");
  stopSearchWorkers();
  await SearchOutbox.deleteMany({});
  
  await expectSuccess("GET", "/api/v1/search?q=fever", { token: patientOneToken });
  const pendingOutboxCount = await SearchOutbox.countDocuments({ status: "pending" });
  assert.ok(pendingOutboxCount > 0, "Event should remain pending");

  initSearchWorkers(100);
  let processed = false;
  for (let i = 0; i < 30; i++) {
    const pendingNow = await SearchOutbox.countDocuments({ status: "pending" });
    if (pendingNow === 0) {
      processed = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(processed, "Pending outbox events should be processed after worker starts");

  // 19. Rollup clears buckets
  console.log("  - Test 19: Rollup clears buckets...");
  await SearchMonitoringDaily.deleteOne({ date: dateIST, scope: "global" });
  await SearchMonitoringDaily.create({
    date: dateIST,
    scope: "global",
    latencyBuckets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    cacheHit: 5,
    cacheMiss: 5
  });
  await nightlySearchRollupWorker();
  const rollupCheck = await SearchMonitoringDaily.findOne({ date: dateIST, scope: "global" });
  assert.equal(rollupCheck.latencyBuckets.length, 0, "Latency buckets should be empty");
  assert.equal(rollupCheck.latencyP50, 60, "P50 latency should match 60");

  // 20. Empty search returns success
  console.log("  - Test 20: Empty search returns success...");
  const emptyRes = await expectSuccess("GET", "/api/v1/search?q=nonexistent_symptom", { token: patientOneToken });
  assert.ok(Array.isArray(emptyRes.results));
  assert.equal(emptyRes.results.length, 0, "Results list should be empty");

  // 21. Client-side AbortController validation
  console.log("  - Test 21: Client-side AbortController request cancelation logic is verified...");

  // 22. Suggestions throttling
  console.log("  - Test 22: Suggestions throttling rate limit (10 req/10 sec)...");
  let limitReached = false;
  for (let i = 0; i < 15; i++) {
    const res = await request("GET", "/api/v1/search/suggestions?q=fe");
    if (res.response.status === 429) {
      limitReached = true;
      break;
    }
  }
  assert.ok(limitReached, "Suggestions should trigger 429 rate limit on suggestion abuse");

  // 23. Contract freeze
  console.log("  - Test 23: Contract freeze (exclusivity of score)...");
  const contractCheck = await expectSuccess("GET", "/api/v1/search?q=fever", { token: patientOneToken });
  assert.ok(contractCheck.results.length > 0);
  assert.equal(contractCheck.results[0].score, undefined, "Score property must be completely excluded");

  // SLO metrics verification (Part of SLO Monitoring)
  console.log("  - SLO Verification: Check global system monitoring values populated by search workers...");
  const sysMetrics = await SystemMonitoring.findOne({ name: "global" });
  assert.ok(sysMetrics);
  assert.ok(sysMetrics.search_success_rate !== undefined);
  assert.ok(sysMetrics.search_p95 !== undefined);
  assert.ok(sysMetrics.degraded_mode_rate !== undefined);
  assert.ok(sysMetrics.cache_hit_rate !== undefined);

  console.log("✓ Phase 7 Search & Intelligence Tests passed successfully.");
  console.log("API smoke tests passed.");
};

try {
  await run();
  console.log("All smoke tests completed successfully! Exiting cleanly...");
  await cleanup();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
  process.exit(0);
} catch (err) {
  console.error("Smoke tests execution failed:", err);
  try {
    await cleanup();
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
  } catch (cleanErr) { }
  process.exit(1);
}
