import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

export async function migrateActiveSlotUniqueIndex() {
  console.log("=== MIGRATING TO PARTIAL UNIQUE ACTIVE SLOT INDEX ===");
  await mongoose.connect(process.env.MONGO_URI);
  const collection = mongoose.connection.collection("appointmentbookings");

  const activeStatuses = ["BOOKED", "CONFIRMED", "REMINDER_SENT", "READY", "IN_CONSULTATION"];

  // 1. Read-only verification: Ensure zero active duplicate groups exist
  const activeDupes = await collection.aggregate([
    {
      $match: {
        status: { $in: activeStatuses },
        arrivalStatus: { $ne: "NO_SHOW" }
      }
    },
    {
      $group: {
        _id: {
          doctorId: "$doctorId",
          date: "$date",
          slotTime: "$slotTime"
        },
        count: { $sum: 1 }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    }
  ]).toArray();

  if (activeDupes.length > 0) {
    console.error("MIGRATION BLOCKED: Found active duplicate groups in target database:", activeDupes);
    throw new Error(`Target database contains ${activeDupes.length} active duplicate groups. Cannot proceed.`);
  }

  console.log("✓ Pre-flight audit passed: 0 active duplicate groups exist.");

  // 2. Inspect existing indexes
  const existingIndexes = await collection.indexes();
  const oldIndex = existingIndexes.find(idx => idx.name === "doctorId_1_date_1_slotTime_1");
  const newIndex = existingIndexes.find(idx => idx.name === "uniq_active_doctor_date_slot");

  if (oldIndex && !oldIndex.unique) {
    console.log("Dropping legacy non-unique index 'doctorId_1_date_1_slotTime_1'...");
    await collection.dropIndex("doctorId_1_date_1_slotTime_1");
    console.log("✓ Dropped legacy non-unique index.");
  }

  if (!newIndex) {
    console.log("Creating partial unique index 'uniq_active_doctor_date_slot'...");
    await collection.createIndex(
      {
        doctorId: 1,
        date: 1,
        slotTime: 1
      },
      {
        unique: true,
        partialFilterExpression: {
          status: {
            $in: [
              "BOOKED",
              "CONFIRMED",
              "REMINDER_SENT",
              "READY",
              "IN_CONSULTATION"
            ]
          }
        },
        name: "uniq_active_doctor_date_slot"
      }
    );
    console.log("✓ Partial unique index created successfully.");
  } else {
    console.log("✓ Partial unique index 'uniq_active_doctor_date_slot' already exists.");
  }

  // 3. Verify final index state
  const updatedIndexes = await collection.indexes();
  const verified = updatedIndexes.find(idx => idx.name === "uniq_active_doctor_date_slot");
  if (!verified || !verified.unique || !verified.partialFilterExpression) {
    throw new Error("Index verification failed: 'uniq_active_doctor_date_slot' missing or invalid.");
  }

  console.log("✓ Verification complete: 'uniq_active_doctor_date_slot' is active and unique.");
  await mongoose.disconnect();
}

if (process.argv[1] && process.argv[1].endsWith("migrate_active_slot_unique_index.mjs")) {
  migrateActiveSlotUniqueIndex().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
