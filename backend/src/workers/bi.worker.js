import { runIncrementalIngestion } from "../modules/analytics/bi_warehouse_worker.js";

let ingestionRunning = false;

export const runBiWarehouseIngestion = async () => {
  if (process.env.ENABLE_BI_WAREHOUSE_WORKER === "false") {
    console.log("[WORKER] BI warehouse incremental ingestion skipped (ENABLE_BI_WAREHOUSE_WORKER=false).");
    return;
  }

  if (ingestionRunning) {
    console.log("[WORKER] BI warehouse incremental ingestion already in progress, skipping overlapping run.");
    return;
  }

  ingestionRunning = true;
  try {
    console.log("[WORKER] Starting BI warehouse incremental ingestion...");
    await runIncrementalIngestion();
    console.log("[WORKER] BI warehouse incremental ingestion completed successfully.");
  } catch (err) {
    console.error("[WORKER] Failed to run BI warehouse incremental ingestion:", err);
  } finally {
    ingestionRunning = false;
  }
};
