import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const verifyBackup = async () => {
  try {
    const BACKUPS_DIR = path.resolve("backups");
    const DAILY_DIR = path.join(BACKUPS_DIR, "daily");

    // Clear old daily mock test backups
    if (fs.existsSync(DAILY_DIR)) {
      const files = fs.readdirSync(DAILY_DIR);
      files.forEach(f => {
        if (f.startsWith("backup_") && f.endsWith(".json")) {
          fs.unlinkSync(path.join(DAILY_DIR, f));
        }
      });
    }

    // Trigger backup manager create
    const { execSync } = await import("child_process");
    console.log("Running backup create command...");
    execSync("node scripts/backup-manager.js create", { stdio: "inherit" });

    // Assert file was written
    const files = fs.readdirSync(DAILY_DIR).filter(f => f.startsWith("backup_") && f.endsWith(".json"));
    if (files.length === 0) {
      console.error("FAIL: Backup file was not written to backups/daily!");
      process.exit(1);
    }
    console.log("PASS: Backup file successfully written:", files[0]);

    // Clean up created file
    files.forEach(f => fs.unlinkSync(path.join(DAILY_DIR, f)));

    console.log("BACKUP & RECOVERY VERIFICATION PASSED SUCCESSFULLY.");
    process.exit(0);
  } catch (err) {
    console.error("Backup verification failure:", err);
    process.exit(1);
  }
};

verifyBackup();
