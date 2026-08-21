import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const resetDatabase = async () => {
  console.log("🧹 Purging MedHospi Database Collections...");
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI is not set in backend .env");
    }

    await mongoose.connect(mongoUri);
    const collections = await mongoose.connection.db.listCollections().toArray();
    const dropPromises = collections.map(col => {
      console.log(`   - Clearing document rows for: ${col.name}`);
      return mongoose.connection.db.collection(col.name).deleteMany({});
    });
    
    await Promise.all(dropPromises);
    console.log("✅ Database cleared successfully.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Reset Failed:", err);
    process.exit(1);
  }
};

resetDatabase();
