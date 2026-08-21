import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/smart-healthcare");

// Clear stale search caches
const r = await mongoose.connection.db.collection("searchcaches").deleteMany({});
console.log("Cleared search cache entries:", r.deletedCount);

await mongoose.disconnect();
console.log("Done.");
