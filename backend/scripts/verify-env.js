import dotenv from "dotenv";
import { validateEnvironment } from "../src/config/environment.validator.js";

dotenv.config();

const verifyEnv = () => {
  try {
    console.log("Starting env check tests...");

    // Store original env keys
    const originalEnv = { ...process.env };

    // Set all mock environment keys
    process.env.VALIDATE_ENV_TEST = "true";
    process.env.JWT_SECRET = "test";
    process.env.JWT_REFRESH_SECRET = "test";
    process.env.MONGO_URI = "test";
    process.env.CLOUDINARY_API_SECRET = "test";
    process.env.SMTP_PASSWORD = "test";

    // Test 1: Should pass when all are present
    try {
      validateEnvironment();
      console.log("PASS: Environment check succeeded with all secrets present.");
    } catch (err) {
      console.error("FAIL: Environment validation failed unexpectedly:", err.message);
      process.exit(1);
    }

    // Test 2: Should fail when a required key is missing
    delete process.env.SMTP_PASSWORD;
    let failedAsExpected = false;
    try {
      validateEnvironment();
    } catch (err) {
      failedAsExpected = true;
      console.log("PASS: Environment check failed as expected when SMTP_PASSWORD was missing:", err.message);
    }

    if (!failedAsExpected) {
      console.error("FAIL: Validator did not refuse startup when SMTP_PASSWORD was missing!");
      process.exit(1);
    }

    // Restore original env state
    process.env = originalEnv;

    console.log("SECRET VALIDATION ENGINE VERIFICATION PASSED.");
    process.exit(0);
  } catch (err) {
    console.error("Env verification script failure:", err);
    process.exit(1);
  }
};

verifyEnv();
