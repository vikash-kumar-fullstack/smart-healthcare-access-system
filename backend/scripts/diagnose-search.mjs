import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

// Check how many active doctors have availabilityState set correctly
const doctors = await mongoose.connection.db.collection("doctors").find({ status: "active" }).toArray();
const withState = doctors.filter(d => d.availabilityState === "available" || d.availabilityState === "break");
const withoutState = doctors.filter(d => !d.availabilityState);
const withUnavailable = doctors.filter(d => d.availabilityState === "unavailable");

console.log("Total active doctors:", doctors.length);
console.log("With availabilityState=available/break:", withState.length);
console.log("Without availabilityState:", withoutState.length);
console.log("With availabilityState=unavailable:", withUnavailable.length);

// Check availability snapshots
const snapshots = await mongoose.connection.db.collection("doctoravailabilitysnapshots").find({}).toArray();
const available = snapshots.filter(s => s.available === true);
const unavailable = snapshots.filter(s => s.available === false);
const stale = snapshots.filter(s => new Date() - new Date(s.lastComputedAt) > 120000);

console.log("\nTotal snapshots:", snapshots.length);
console.log("Available snapshots:", available.length);
console.log("Unavailable snapshots:", unavailable.length);
console.log("Stale snapshots (>2min):", stale.length);

// Check symptom dictionary  
const symptoms = await mongoose.connection.db.collection("symptomdictionaries").find({ name: "fever" }).toArray();
console.log("\nFever symptom entry:", JSON.stringify(symptoms));

await mongoose.disconnect();
