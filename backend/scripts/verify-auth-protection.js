import mongoose from "mongoose";
import dotenv from "dotenv";
import { loginUser } from "../src/modules/auth/auth.service.js";
import LoginAttempt from "../src/modules/auth/login_attempt.model.js";

dotenv.config();

const verifyAuthProtection = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB for Lockout Verification.");

    const email = "lockout-test@smarthealth.com";

    // Clean up past attempts
    await LoginAttempt.deleteMany({ email });

    // Set environment to enable lockouts (bypass demo modes)
    process.env.DEMO_DISABLE_LOCKOUT = "false";
    process.env.DEMO_MODE = "false";

    console.log("Simulating 5 failed login attempts...");
    let lockedOut = false;
    let message = "";

    for (let i = 0; i < 6; i++) {
      try {
        await loginUser({ email, password: "wrong-password" }, null);
      } catch (err) {
        message = err.message;
        if (err.message.includes("locked due to excessive failed attempts")) {
          lockedOut = true;
          break;
        }
      }
    }

    if (!lockedOut) {
      console.error("FAIL: 5 failed attempts did not trigger account lockout! Message received:", message);
      process.exit(1);
    }
    console.log("PASS: Lockout successfully triggered. Error message:", message);

    // Test Demo Mode Lockout Bypass
    process.env.DEMO_MODE = "true";
    console.log("Enabling DEMO_MODE=true to verify lockout bypass...");

    let bypassPassed = false;
    try {
      await loginUser({ email, password: "wrong-password" }, null);
    } catch (err) {
      // It should throw "Invalid credentials", NOT "Account temporarily locked"
      if (err.message === "Invalid credentials") {
        bypassPassed = true;
      } else {
        console.error("FAIL: Locked out even in Demo Mode. Message received:", err.message);
      }
    }

    if (!bypassPassed) {
      console.error("FAIL: Lockout was not bypassed in Demo Mode.");
      process.exit(1);
    }
    console.log("PASS: Lockout bypass verified successfully in Demo Mode.");

    // Clean up test data
    await LoginAttempt.deleteMany({ email });

    console.log("LOGIN PROTECTION VERIFICATION PASSED.");
    process.exit(0);
  } catch (err) {
    console.error("Login protection verification failure:", err);
    process.exit(1);
  }
};

verifyAuthProtection();
