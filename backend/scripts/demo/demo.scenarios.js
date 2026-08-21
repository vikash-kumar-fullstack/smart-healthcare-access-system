import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Doctor from "../../src/modules/doctor/doctor.model.js";
import Appointment from "../../src/modules/appointment/appointment.model.js";
import DoctorAvailabilitySnapshot from "../../src/modules/search/doctor_availability_snapshot.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const runScenario = async (num) => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI not configured in .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log(`🎬 Configuring Database for Scenario ${num}...`);

  try {
    const doctorUser = await mongoose.connection.db.collection("users").findOne({ email: "doctor@medhospi.com" });
    const doctor = await Doctor.findOne({ userId: doctorUser._id });

    if (num === 4) {
      // Scenario 4: Doctor Leave
      console.log(`Setting Doctor ${doctor.name} to "leave" availabilityState...`);
      doctor.availabilityState = "leave";
      await doctor.save();
      await DoctorAvailabilitySnapshot.updateOne({ doctorId: doctor._id }, { available: false });
      console.log("✅ Database updated: Doctor is now on leave. Try searching them to see redirect warning.");

    } else if (num === 6) {
      // Scenario 6: Doctor skips / marks patient No-Show
      const latestAppt = await Appointment.findOne({ doctorId: doctor._id, status: { $ne: "COMPLETED" } });
      if (latestAppt) {
        console.log(`Updating Booking ${latestAppt.bookingNumber} to SKIPPED / NO_SHOW...`);
        latestAppt.status = "CANCELLED";
        latestAppt.arrivalStatus = "NO_SHOW";
        await latestAppt.save();
        console.log("✅ Database updated: Patient marked as No-Show. Check doctor's queue timeline.");
      } else {
        console.log("❌ No active bookings found for Doctor Alok Sen.");
      }

    } else if (num === 7) {
      // Scenario 7: Emergency Triage Prioritization
      const latestAppt = await Appointment.findOne({ doctorId: doctor._id, status: "READY" });
      if (latestAppt) {
        console.log(`Elevating Booking ${latestAppt.bookingNumber} to EMERGENCY Walk-in priority...`);
        latestAppt.notes = "Emergency Walk-in";
        await latestAppt.save();
        console.log("✅ Database updated: Ticket is highlighted in RED and placed at position #1.");
      } else {
        console.log("❌ No upcoming active appointments found to prioritize.");
      }

    } else {
      console.log(`ℹ️ Scenario ${num} is a frontend interactive walkthrough. No database changes required.`);
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Scenario configuration failed:", err);
    process.exit(1);
  }
};

const arg = process.argv[2];
if (arg) {
  runScenario(parseInt(arg));
} else {
  console.log("Usage: node demo.scenarios.js <scenario_number>");
  process.exit(0);
}
