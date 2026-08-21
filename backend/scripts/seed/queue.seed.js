import mongoose from "mongoose";
import Queue from "../../src/modules/queue/queue.model.js";

export const seedQueues = async (hashedPassword, context) => {
  console.log("Seeding Live Patient Wait Queues (Optimized Native Bulk Insert)...");

  const doctors = context.seededDoctors;
  const sessions = context.seededSessions;
  const patients = context.seededPatients;

  const bulkQueue = [];
  
  // We seed waiting entries for active sessions
  for (let i = 0; i < doctors.length; i++) {
    const doc = doctors[i];
    const session = sessions[i];
    
    // Create 3 waiting patients for each doctor today to mock realistic lines
    for (let pos = 1; pos <= 3; pos++) {
      const patient = patients[(i * 3 + pos) % patients.length];
      
      bulkQueue.push({
        userId: patient._id,
        doctorId: doc._id,
        sessionId: session._id,
        queueNumber: pos,
        status: pos === 1 ? "called" : "waiting",
        isActive: pos === 1,
        bookedAt: new Date(Date.now() - pos * 600000),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  await Queue.deleteMany({});
  await mongoose.connection.db.collection("queues").insertMany(bulkQueue);
  const created = await Queue.find({});
  console.log(`  - Seeded ${created.length} live queue line entries.`);
  context.seededQueues = created;
};
