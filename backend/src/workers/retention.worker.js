import { runRetentionPurge } from "../config/audit-retention.policy.js";

export const cleanupRetentionPolicies = async () => {
  try {
    console.log("[WORKER] Starting retention policies cleanup...");
    const stats = await runRetentionPurge();
    console.log("[WORKER] Retention policies cleanup completed successfully:", stats);
  } catch (err) {
    console.error("[WORKER] Failed to run retention policies cleanup:", err);
  }
};
