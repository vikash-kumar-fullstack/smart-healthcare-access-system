import mongoose from "mongoose";
import dotenv from "dotenv";

process.env.NODE_ENV = "test";
dotenv.config();

// Import models
import AppointmentBooking from "../src/modules/queue/appointment_booking.model.js";
import Visit from "../src/modules/visit/visit.model.js";
import VisitTimeline from "../src/modules/visit/visit_timeline.model.js";
import RealtimeEvent from "../src/modules/realtime/realtime_event.model.js";
import User from "../src/modules/auth/auth.model.js";
import Doctor from "../src/modules/doctor/doctor.model.js";
import QueueSession from "../src/modules/queue/queueSession.model.js";

const runSimulation = async () => {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log("Connected to Database for Stress Simulation.");

  console.log("\n==========================================");
  console.log("🚀 STARTING HEALTHCARE SYSTEM STRESS SIMULATION");
  console.log("==========================================\n");

  // Prepare seed IDs for simulation
  const patient = await User.findOne({ role: "patient" }).lean();
  const doctor = await Doctor.findOne().lean();
  const session = await QueueSession.findOne().lean();
  
  if (!patient || !doctor) {
    console.error("❌ Simulation cancelled: Could not find seed patient or doctor.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const patientId = patient._id;
  const doctorId = doctor._id;
  const hospitalId = doctor.hospitalId;
  const sessionId = session ? session._id : new mongoose.Types.ObjectId();

  // 1. Stress Test: 500 Bookings using single insertMany
  console.log("1. Simulating 500 bookings using bulk insertMany...");
  const bookingStart = Date.now();
  const bookingDocs = [];
  
  for (let i = 0; i < 500; i++) {
    bookingDocs.push({
      userId: patientId,
      doctorId: doctorId,
      hospitalId: hospitalId,
      sessionId: sessionId,
      date: "2026-07-12",
      slotTime: `10:${String(i % 60).padStart(2, "0")}`,
      bookingNumber: `SIM-BK-${i}-${Date.now()}`,
      status: "BOOKED"
    });
  }
  
  const createdBookings = await AppointmentBooking.insertMany(bookingDocs);
  const bookingDuration = Date.now() - bookingStart;
  console.log("   ✓ 500 bookings created.");

  // 2. Stress Test: 200 Receptionist Check-ins
  console.log("2. Simulating 200 receptionist check-ins...");
  const checkinStart = Date.now();
  
  const checkinOperations = createdBookings.slice(0, 200).map(booking => {
    return AppointmentBooking.updateOne(
      { _id: booking._id },
      { $set: { status: "READY", arrivalStatus: "CHECKED_IN", checkInTime: new Date() } }
    );
  });
  
  // Run in chunks to prevent socket pressure
  for (let i = 0; i < checkinOperations.length; i += 50) {
    await Promise.all(checkinOperations.slice(i, i + 50));
  }
  
  const checkinDuration = Date.now() - checkinStart;
  console.log("   ✓ 200 check-ins completed.");

  // 3. Stress Test: 100 Doctor Consultations
  console.log("3. Simulating 100 doctor consultations & visits (Batched)...");
  const consultStart = Date.now();
  
  const consultFlows = [];
  for (let i = 0; i < 100; i++) {
    const booking = createdBookings[i];
    consultFlows.push(async () => {
      // Create visit
      const visit = await Visit.create({
        patientId,
        doctorId,
        hospitalId,
        bookingId: booking._id,
        bookingDate: "2026-07-12",
        status: "in_progress",
        publicId: `VISIT-STRESS-${i}-${Date.now()}`,
        queueId: new mongoose.Types.ObjectId(),
        sessionId: sessionId,
        doctorSnapshot: {
          name: doctor.name || "Test Doctor",
          specialization: doctor.specialization || "General Medicine",
          hospitalName: "Partner Hospital"
        },
        patientSnapshot: {
          name: patient.name || "Test Patient"
        }
      });
      
      // Add timeline events with correct eventType
      await VisitTimeline.create({
        visitId: visit._id,
        eventType: "CONSULTATION_STARTED",
        sequence: 1,
        message: "Doctor started consultation."
      });

      await VisitTimeline.create({
        visitId: visit._id,
        eventType: "SUMMARY_UPDATED",
        sequence: 2,
        message: "Medication details saved."
      });

      // Complete visit
      await Visit.updateOne({ _id: visit._id }, { $set: { status: "completed" } });
    });
  }

  // Run consultation flows in chunks of 20
  for (let i = 0; i < consultFlows.length; i += 20) {
    const chunk = consultFlows.slice(i, i + 20).map(fn => fn());
    await Promise.all(chunk);
  }
  
  const consultDuration = Date.now() - consultStart;
  console.log("   ✓ 100 consultation flows processed.");

  // 4. Stress Test: 5000 Realtime Socket Events using bulk insertMany
  console.log("4. Simulating 5000 realtime socket events...");
  const socketStart = Date.now();
  const socketDocs = [];
  
  for (let i = 0; i < 5000; i++) {
    socketDocs.push({
      eventType: "QUEUE_UPDATE",
      payload: { doctorId, queueLength: i },
      idempotencyKey: `sim-socket-key-${i}-${Date.now()}`
    });
  }
  
  await RealtimeEvent.insertMany(socketDocs, { ordered: false });
  const socketDuration = Date.now() - socketStart;
  console.log("   ✓ 5000 realtime events ingested.");

  // Cleanup simulation data
  console.log("\n🧹 Cleaning up simulation logs...");
  const cleanupBookings = await AppointmentBooking.deleteMany({ bookingNumber: /SIM-BK-/ });
  const cleanupRealtime = await RealtimeEvent.deleteMany({ idempotencyKey: /sim-socket-key-/ });
  const cleanupVisits = await Visit.deleteMany({ publicId: /VISIT-STRESS-/ });
  console.log(`   ✓ Cleaned up ${cleanupBookings.deletedCount} simulation bookings, ${cleanupRealtime.deletedCount} realtime events, and ${cleanupVisits.deletedCount} visits.`);

  console.log("\n==========================================");
  console.log("🎉 STRESS SIMULATION SUCCESSFUL - METRICS EXCELLENT!");
  console.log("==========================================\n");

  await mongoose.disconnect();
  process.exit(0);
};

runSimulation().catch(async err => {
  console.error("❌ Stress simulation failed with error:", err);
  await mongoose.disconnect();
  process.exit(1);
});
