import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load modular seeders
import { seedUsers } from "./users.seed.js";
import { seedHospitals } from "./hospitals.seed.js";
import { seedDoctors } from "./doctors.seed.js";
import { seedReceptionists } from "./receptionists.seed.js";
import { seedPatients } from "./patients.seed.js";
import { seedAppointments } from "./appointments.seed.js";
import { seedQueues } from "./queue.seed.js";
import { seedVisits } from "./visits.seed.js";
import { seedPrescriptions } from "./prescriptions.seed.js";
import { seedReports } from "./reports.seed.js";
import { seedAnalytics } from "./analytics.seed.js";
import { seedNotifications } from "./notifications.seed.js";
import { seedDashboardShowcase } from "./dashboard.seed.js";
import { seedSymptoms } from "./symptoms.seed.js";
import { seedFamily } from "./family.seed.js";

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const DEMO_PASSWORD = "Demo@123";

const runMasterSeeder = async () => {
  console.log("🏁 Starting Phase 14.6 Master Enterprise Database Seeder...");

  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not configured in backend .env");
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to Database.");

    // Purge legacy data safely by deleting documents across collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const dropPromises = collections.map(col => {
      return mongoose.connection.db.collection(col.name).deleteMany({});
    });
    await Promise.all(dropPromises);
    console.log("Purged collection documents to ensure clean, consistent seeding without resetting connections.");

    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);
    const context = {};

    // Execute modular seeders in logical order
    await seedUsers(hashedPassword, context);
    await seedHospitals(hashedPassword, context);
    await seedSymptoms(hashedPassword, context);
    await seedDoctors(hashedPassword, context);
    await seedReceptionists(hashedPassword, context);
    await seedPatients(hashedPassword, context);
    await seedAppointments(hashedPassword, context);
    await seedQueues(hashedPassword, context);
    await seedFamily(hashedPassword, context);
    await seedVisits(hashedPassword, context);
    await seedPrescriptions(hashedPassword, context);
    await seedReports(hashedPassword, context);
    await seedAnalytics(hashedPassword, context);
    await seedNotifications(hashedPassword, context);
    await seedDashboardShowcase(hashedPassword, context);

    console.log("Rebuilding search availability versions and snapshots...");
    try {
      const { updateDoctorAvailabilitySnapshot } = await import("../../src/modules/search/availability.service.js");
      const { incrementQueueVersion, incrementAvailabilityVersion } = await import("../../src/modules/search/utils.js");
      await incrementAvailabilityVersion();
      await incrementQueueVersion();
      
      const showcaseDoc = context.seededDoctors?.find(d => d.name.includes("Alok Sen"));
      if (showcaseDoc) {
        await updateDoctorAvailabilitySnapshot(showcaseDoc._id);
      }
      console.log("  - Search indexes refreshed successfully.");
    } catch (indexErr) {
      console.warn("  - Index refresh skipped or encountered warning:", indexErr.message);
    }

    console.log("\n🎉 MASTER SEED COMPLETED SUCCESSFULLY!");
    console.log("-----------------------------------------");
    console.log("Showcase user credentials (password: Demo@123):");
    console.log("- Super Admin:    super@medhospi.com");
    console.log("- District Admin: district@medhospi.com");
    console.log("- Hospital Admin: hospital@medhospi.com");
    console.log("- Receptionist:   reception@medhospi.com");
    console.log("- Doctor:         doctor@medhospi.com");
    console.log("- Patient:        patient@medhospi.com");
    console.log("-----------------------------------------");

    process.exit(0);
  } catch (err) {
    console.error("❌ Master Seeder Failed:", err);
    process.exit(1);
  }
};

runMasterSeeder();
