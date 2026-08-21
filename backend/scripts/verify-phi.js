import { redactPHI } from "../src/middlewares/phi-guard.middleware.js";

const verifyPhi = () => {
  try {
    const testPayload = {
      hospitalName: "Apollo Delhi",
      specialization: "Cardiology",
      phone: "9876543210",
      diagnosis: "Acute Bronchitis",
      prescription: "Amoxicillin 500mg",
      nested: {
        email: "test@medhospi.com",
        city: "Delhi"
      }
    };

    const redacted = redactPHI(testPayload);
    console.log("Redacted Output:", redacted);

    // Verify PUBLIC fields are intact
    if (redacted.hospitalName !== "Apollo Delhi" || redacted.specialization !== "Cardiology") {
      console.error("FAIL: PUBLIC fields were incorrectly redacted!");
      process.exit(1);
    }
    console.log("PASS: PUBLIC fields kept intact.");

    // Verify SENSITIVE fields are redacted
    if (redacted.phone !== "[REDACTED_SENSITIVE]" || redacted.nested.email !== "[REDACTED_SENSITIVE]") {
      console.error("FAIL: SENSITIVE fields (phone, email) were not redacted!");
      process.exit(1);
    }
    console.log("PASS: SENSITIVE fields successfully redacted.");

    // Verify PHI fields are redacted
    if (redacted.diagnosis !== "[REDACTED_PHI]" || redacted.prescription !== "[REDACTED_PHI]") {
      console.error("FAIL: PHI fields (diagnosis, prescription) were not redacted!");
      process.exit(1);
    }
    console.log("PASS: PHI fields successfully redacted.");

    console.log("PHI CLASSIFICATION VERIFICATION PASSED SUCCESSFULLY.");
    process.exit(0);
  } catch (err) {
    console.error("PHI verification failure:", err);
    process.exit(1);
  }
};

verifyPhi();
