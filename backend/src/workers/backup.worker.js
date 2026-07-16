import mongoose from "mongoose";
import fs from "fs";
import path from "path";

export const backupDatabase = async () => {
  try {
    console.log("[WORKER] Starting daily database backup...");
    const backupDir = "./backups/daily";
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const collections = await mongoose.connection.db.listCollections().toArray();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    for (const col of collections) {
      const data = await mongoose.connection.db.collection(col.name).find({}).toArray();
      const filePath = path.join(backupDir, `${col.name}-${timestamp}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }

    console.log(`[WORKER] Database backup completed successfully. Backed up ${collections.length} collections.`);
  } catch (err) {
    console.error("[WORKER] Failed to backup database:", err);
  }
};
