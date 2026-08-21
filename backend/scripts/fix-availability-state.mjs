import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/smart-healthcare");

const Doctor = mongoose.model("Doctor", new mongoose.Schema({
  status: String,
  availabilityState: String
}, { strict: false }), "doctors");

// Fix doctors missing availabilityState
const result1 = await Doctor.updateMany(
  { status: "active", availabilityState: { $exists: false } },
  { $set: { availabilityState: "available" } }
);
console.log("Fixed doctors missing availabilityState:", result1.modifiedCount);

const result2 = await Doctor.updateMany(
  { status: "active", availabilityState: null },
  { $set: { availabilityState: "available" } }
);
console.log("Fixed doctors with null availabilityState:", result2.modifiedCount);

// Now recompute ALL availability snapshots by clearing stale data
const SnapshotModel = mongoose.model("DoctorAvailabilitySnapshot", new mongoose.Schema({
  doctorId: mongoose.Schema.Types.ObjectId,
  available: Boolean,
  lastComputedAt: Date
}, { strict: false }), "doctoravailabilitysnapshots");

// Mark all snapshots as stale (force recompute on next search)
const result3 = await SnapshotModel.updateMany(
  {},
  { $set: { lastComputedAt: new Date(0) } }
);
console.log("Marked all snapshots as stale for recompute:", result3.modifiedCount);

await mongoose.disconnect();
console.log("Done.");
