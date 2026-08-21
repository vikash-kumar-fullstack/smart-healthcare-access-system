import mongoose from "mongoose";
import AppointmentBooking from "../../src/modules/queue/appointment_booking.model.js";
import QueueSession from "../../src/modules/queue/queueSession.model.js";

export const seedAppointments = async (hashedPassword, context) => {
  console.log("Seeding Appointments & Telemetry (Optimized Native Bulk Insert)...");

  const patients = context.seededPatients;
  const doctors = context.seededDoctors;
  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Precreate active queue sessions for all doctors today natively to bypass hooks
  const sessionsData = [];
  for (const doc of doctors) {
    sessionsData.push({
      _id: new mongoose.Types.ObjectId(),
      doctorId: doc._id,
      hospitalId: doc.hospitalId,
      date: todayStr,
      sessionStatus: "active",
      sessionState: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  await QueueSession.deleteMany({});
  await mongoose.connection.db.collection("queuesessions").insertMany(sessionsData);
  const seededSessions = await QueueSession.find({});
  context.seededSessions = seededSessions;

  // 2. Seed 1500 appointments across different states
  const totalApps = 1500;
  const timeSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30"];
  const statuses = ["BOOKED", "COMPLETED", "CANCELLED"];
  const arrivalStatuses = ["NOT_ARRIVED", "CHECKED_IN", "CHECK_IN_OPEN", "TRAVEL"];
  
  const bulkBookings = [];
  const dateToShortString = () => {
    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yy}${mm}${dd}`;
  };

  const shortDateStr = dateToShortString();

  for (let i = 0; i < totalApps; i++) {
    const patient = patients[i % patients.length];
    const doc = doctors[i % doctors.length];
    const session = seededSessions[i % seededSessions.length];
    const slot = timeSlots[i % timeSlots.length];
    
    // Status distribution: 1200 Completed, rest Booked / Canceled
    let status = "COMPLETED";
    if (i >= 1200) {
      status = i % 2 === 0 ? "BOOKED" : "CANCELLED";
    }

    let arrival = "NOT_ARRIVED";
    if (status === "COMPLETED") {
      arrival = "CHECKED_IN";
    } else if (status === "BOOKED") {
      arrival = arrivalStatuses[i % arrivalStatuses.length];
    }

    bulkBookings.push({
      bookingNumber: `MH-${shortDateStr}-${String(i).padStart(4, "0")}`,
      userId: patient._id,
      doctorId: doc._id,
      hospitalId: doc.hospitalId,
      sessionId: session._id,
      date: todayStr,
      slotTime: slot,
      status,
      arrivalStatus: arrival,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Set active booking for Vikash Kumar (showcase patient) to allow testing journey flows
  const showcasePatient = patients.find(p => p.email === "patient@medhospi.com");
  if (showcasePatient) {
    const aiimsDoc = doctors[0];
    const aiimsSession = seededSessions.find(s => s.doctorId.toString() === aiimsDoc._id.toString());
    
    bulkBookings.push({
      bookingNumber: `MH-${shortDateStr}-9999`,
      userId: showcasePatient._id,
      doctorId: aiimsDoc._id,
      hospitalId: aiimsDoc.hospitalId,
      sessionId: aiimsSession?._id,
      date: todayStr,
      slotTime: "10:30",
      status: "BOOKED",
      arrivalStatus: "CHECK_IN_OPEN",
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  await AppointmentBooking.deleteMany({});
  await mongoose.connection.db.collection("appointmentbookings").insertMany(bulkBookings);
  const created = await AppointmentBooking.find({});

  console.log(`  - Seeded ${created.length} appointments.`);
  context.seededAppointments = created;
};
