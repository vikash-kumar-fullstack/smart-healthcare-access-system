import mongoose from "mongoose";
import dotenv from "dotenv";
import SecurityIncident from "../src/modules/admin/security_incident.model.js";

dotenv.config();

const verifyIncidents = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB for Incident Verification.");

    // Insert mock incident
    const incident = new SecurityIncident({
      severity: "high",
      category: "ACCESS_DENIED",
      description: "Unauthorized access attempts to clinical EMR files by guest IP 192.168.1.100."
    });
    await incident.save();
    console.log("Mock Security Incident saved.");

    // Assert active
    if (incident.status !== "open") {
      console.error("FAIL: Incident default status is not 'open'.");
      process.exit(1);
    }

    // Resolve incident
    incident.status = "resolved";
    incident.resolvedAt = new Date();
    await incident.save();

    const fetched = await SecurityIncident.findById(incident._id);
    if (fetched.status !== "resolved" || !fetched.resolvedAt) {
      console.error("FAIL: Incident status update to 'resolved' failed.");
      process.exit(1);
    }
    console.log("PASS: Incident resolved successfully. Timestamp:", fetched.resolvedAt);

    // Clean up test document
    await SecurityIncident.deleteOne({ _id: incident._id });

    console.log("SECURITY INCIDENT VERIFICATION PASSED SUCCESSFULLY.");
    process.exit(0);
  } catch (err) {
    console.error("Incidents verification failure:", err);
    process.exit(1);
  }
};

verifyIncidents();
