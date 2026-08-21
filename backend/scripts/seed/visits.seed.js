import mongoose from "mongoose";
import Visit from "../../src/modules/visit/visit.model.js";

export const seedVisits = async (hashedPassword, context) => {
  console.log("Seeding Completed Clinical Visits (Optimized Native Bulk Insert)...");

  const bookings = context.seededAppointments.filter(b => b.status === "COMPLETED");
  const outcomes = ["consulted", "follow_up_required", "referred"];
  const bulkVisits = [];

  for (let i = 0; i < bookings.length; i++) {
    const booking = bookings[i];
    const doc = context.seededDoctors.find(d => d._id.toString() === booking.doctorId.toString());
    const patient = context.seededPatients.find(p => p._id.toString() === booking.userId.toString());

    bulkVisits.push({
      publicId: `VISIT-${20000 + i}`,
      patientId: booking.userId,
      doctorId: booking.doctorId,
      hospitalId: booking.hospitalId,
      sessionId: booking.sessionId,
      queueId: new mongoose.Types.ObjectId(), // bypass validation and seed linked context
      appointmentId: booking._id,
      bookingDate: booking.date,
      status: "completed",
      visitOutcome: outcomes[i % outcomes.length],
      doctorSnapshot: {
        name: doc?.name || "Dr. Practitioner",
        specialization: doc?.specialization || "General Care",
        hospitalName: "Partner Hospital"
      },
      patientSnapshot: {
        name: patient?.name || "Patient Name",
        email: patient?.email || "patient@example.com",
        phone: patient?.phone || "9000000000"
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  await Visit.deleteMany({});
  await mongoose.connection.db.collection("visits").insertMany(bulkVisits);
  const created = await Visit.find({});
  
  console.log(`  - Seeded ${created.length} completed clinical visits.`);
  context.seededVisits = created;
};
