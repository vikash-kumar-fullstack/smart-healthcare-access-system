import cron from "node-cron";
import { backupDatabase } from "./backup.worker.js";
import { cleanupRetentionPolicies } from "./retention.worker.js";
import { runBiWarehouseIngestion } from "./bi.worker.js";

export const initializeWorkers = () => {
  console.log("[WORKER MANAGER] Initializing isolated cron workers...");

  // Daily backup at 2:00 AM
  cron.schedule("0 2 * * *", async () => {
    try {
      await backupDatabase();
    } catch (err) {
      console.error("[CRON] Backup database worker crashed:", err);
    }
  });

  // Daily retention policy cleanup at 3:00 AM
  cron.schedule("0 3 * * *", async () => {
    try {
      await cleanupRetentionPolicies();
    } catch (err) {
      console.error("[CRON] Retention policies cleanup worker crashed:", err);
    }
  });

  // Every 30 seconds BI warehouse incremental ingestion
  cron.schedule("*/30 * * * * *", async () => {
    try {
      await runBiWarehouseIngestion();
    } catch (err) {
      console.error("[CRON] BI incremental ingestion worker crashed:", err);
    }
  });
  
  console.log("[WORKER MANAGER] Isolated cron workers successfully scheduled.");
};
