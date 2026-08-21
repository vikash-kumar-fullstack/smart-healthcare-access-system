import mongoose from "mongoose";
import dotenv from "dotenv";
import { runRetentionPurge } from "../src/config/audit-retention.policy.js";
import AuditLog from "../src/modules/admin/audit_log.model.js";
import SecurityIncident from "../src/modules/admin/security_incident.model.js";

dotenv.config();

const verifyRetention = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB for Retention Verification.");

    // Cutoff dates for test logs (e.g. 8 years old for audit logs)
    const oldAuditDate = new Date();
    oldAuditDate.setFullYear(oldAuditDate.getFullYear() - 8);

    const oldIncidentDate = new Date();
    oldIncidentDate.setFullYear(oldIncidentDate.getFullYear() - 6);

    // Insert mock old documents bypass hooks
    const mockAudit = {
      action: "RETENTION_TEST",
      resourceType: "System",
      timestamp: oldAuditDate,
      actorRole: "system",
      success: true
    };
    const mockIncident = {
      category: "RATE_LIMIT_TRIGGER",
      description: "Old security incident for retention test",
      detectedAt: oldIncidentDate,
      severity: "low",
      status: "resolved"
    };

    const auditInsert = await AuditLog.collection.insertOne(mockAudit);
    const incidentInsert = await SecurityIncident.collection.insertOne(mockIncident);
    console.log("Inserted old audit log and old security incident.");

    // Run purge
    const purgeResults = await runRetentionPurge();
    console.log("Retention purge executed. Results:", purgeResults);

    // Verify they are deleted
    const foundAudit = await AuditLog.collection.findOne({ _id: auditInsert.insertedId });
    const foundIncident = await SecurityIncident.collection.findOne({ _id: incidentInsert.insertedId });

    if (foundAudit || foundIncident) {
      console.error("FAIL: Old documents were not purged by retention policy!");
      process.exit(1);
    }
    console.log("PASS: Old logs successfully purged by retention policy.");

    console.log("RETENTION VERIFICATION PASSED SUCCESSFULLY.");
    process.exit(0);
  } catch (err) {
    console.error("Retention verification failure:", err);
    process.exit(1);
  }
};

verifyRetention();
