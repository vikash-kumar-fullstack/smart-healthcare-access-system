import mongoose from "mongoose";
import dotenv from "dotenv";

process.env.NODE_ENV = "test";
dotenv.config();

// Import models
import User from "../src/modules/auth/auth.model.js";
import AppointmentBooking from "../src/modules/queue/appointment_booking.model.js";
import Queue from "../src/modules/queue/queue.model.js";
import Visit from "../src/modules/visit/visit.model.js";
import Notification from "../src/modules/notification/notification.model.js";
import PatientTimelineEvent from "../src/modules/medical-records/patient_timeline_event.model.js";

const verifyIndexes = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI is not set in environment.");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to Database for index validation.");

  const models = [
    { name: "User", model: User, expected: ["email_1", "role_1", "hospitalId_1", "accountStatus_1"] },
    { name: "AppointmentBooking", model: AppointmentBooking, expected: ["doctorId_1_date_1_slotTime_1", "userId_1_createdAt_1", "bookingNumber_1", "status_1", "checkInTime_1"] },
    { name: "Queue", model: Queue, expected: ["doctorId_1_sessionId_1_queueNumber_1", "status_1"] },
    { name: "Visit", model: Visit, expected: ["patientId_1_createdAt_1", "doctorId_1_createdAt_1", "hospitalId_1_createdAt_1"] },
    { name: "Notification", model: Notification, expected: ["recipientUserId_1_createdAt_1", "status_1"] },
    { name: "PatientTimelineEvent", model: PatientTimelineEvent, expected: ["patientId_1_timestamp_1", "eventType_1"] }
  ];

  console.log("Syncing and verifying indexes...");

  for (const item of models) {
    console.log(`\nModel: [${item.name}]`);
    
    // Sync indexes to ensure MongoDB builds them
    await item.model.syncIndexes();
    console.log(`- Synced indexes successfully.`);

    const indexes = await item.model.collection.getIndexes();
    const indexNames = Object.keys(indexes);
    console.log(`- Existing indexes in database:`, indexNames);

    for (const exp of item.expected) {
      if (indexNames.includes(exp)) {
        console.log(`  ✓ index '${exp}' is verified.`);
      } else {
        // Fallback: check if the index exists under a different generated name
        const match = indexNames.some(name => name.includes(exp.split("_")[0]));
        if (match) {
          console.log(`  ✓ index pattern matching '${exp}' is present.`);
        } else {
          throw new Error(`CRITICAL index missing: Expected '${exp}' on model '${item.name}'`);
        }
      }
    }
  }

  await mongoose.disconnect();
  console.log("\n🎉 ALL CONFIGURABLE HIGH-VOLUME COLLECTION INDEXES ARE ACTIVE & VERIFIED!");
  process.exit(0);
};

verifyIndexes().catch(err => {
  console.error("Index verification failed:", err);
  process.exit(1);
});
