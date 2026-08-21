import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

// Reset snapshot lastComputedAt to now (they're already correct - available:true)
const r1 = await mongoose.connection.db.collection("doctoravailabilitysnapshots").updateMany(
  {},
  { $set: { lastComputedAt: new Date() } }
);
console.log("Reset snapshot timestamps:", r1.modifiedCount);

// Clear search cache
const r2 = await mongoose.connection.db.collection("searchcaches").deleteMany({});
console.log("Cleared search cache:", r2.deletedCount);

await mongoose.disconnect();
console.log("Done.");
