import { runIncrementalIngestion } from "../modules/analytics/bi_warehouse_worker.js";

export const runBiWarehouseIngestion = async () => {
  try {
    console.log("[WORKER] Starting BI warehouse incremental ingestion...");
    await runIncrementalIngestion();
    console.log("[WORKER] BI warehouse incremental ingestion completed successfully.");
  } catch (err) {
    console.error("[WORKER] Failed to run BI warehouse incremental ingestion:", err);
  }
};
