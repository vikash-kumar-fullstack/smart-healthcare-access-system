import mongoose from "mongoose";
import dotenv from "dotenv";
import AuditLog from "../src/modules/admin/audit_log.model.js";

dotenv.config();

const verifyAudit = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB for Audit Verification.");

    // Create a new audit log entry
    const entry = new AuditLog({
      action: "VERIFICATION_TEST",
      resourceType: "System",
      actorRole: "admin",
      actorRoleSnapshot: "admin",
      permissionSnapshot: ["full"]
    });
    await entry.save();
    console.log("Created test audit log entry.");

    // Try modifying it
    try {
      entry.action = "MODIFIED_TEST";
      await entry.save();
      console.error("FAIL: Audit log allowed modification!");
      process.exit(1);
    } catch (err) {
      console.log("PASS: Immutability verified. Modification threw error:", err.message);
    }

    // Try deleting it
    try {
      await AuditLog.deleteOne({ _id: entry._id });
      // Since Mongoose deleteOne middleware throws error:
      console.error("FAIL: Audit log allowed deleteOne!");
      process.exit(1);
    } catch (err) {
      console.log("PASS: Immutability verified. Deletion threw error:", err.message);
    }

    // Assert snapshots are present
    const fetched = await AuditLog.findById(entry._id);
    if (fetched.actorRoleSnapshot === "admin" && fetched.permissionSnapshot.includes("full")) {
      console.log("PASS: Historical role and permission snapshots verified successfully.");
    } else {
      console.error("FAIL: Snapshots missing or incorrect.");
      process.exit(1);
    }

    // Clean up test document using direct collection delete to bypass Mongoose hook
    await AuditLog.collection.deleteOne({ _id: entry._id });
    console.log("Test log cleaned up directly from DB.");

    console.log("AUDIT VERIFICATION PASSED SUCCESSFULLY.");
    process.exit(0);
  } catch (err) {
    console.error("Unexpected audit verification failure:", err);
    process.exit(1);
  }
};

verifyAudit();
