import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "./src/modules/auth/auth.model.js";
import Doctor from "./src/modules/doctor/doctor.model.js";
import Hospital from "./src/modules/hospital/hospital.model.js";

dotenv.config();

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    const users = await User.find({});
    console.log("\n--- USERS ---");
    console.log(JSON.stringify(users, null, 2));

    const doctors = await Doctor.find({});
    console.log("\n--- DOCTORS ---");
    console.log(JSON.stringify(doctors, null, 2));

    const hospitals = await Hospital.find({});
    console.log("\n--- HOSPITALS ---");
    console.log(JSON.stringify(hospitals, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

check();
