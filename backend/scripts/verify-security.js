import { execSync } from "child_process";

const runVerifyScript = (name, cmd) => {
  console.log(`\n======================================================`);
  console.log(`RUNNING VERIFICATION: ${name}`);
  console.log(`======================================================`);
  try {
    execSync(cmd, { stdio: "inherit" });
    console.log(`[SUCCESS] ${name} Verification Passed.`);
    return true;
  } catch (err) {
    console.error(`[FAILURE] ${name} Verification Failed:`, err.message);
    return false;
  }
};

const verifyAll = () => {
  const suites = [
    { name: "Environment secret validator check", cmd: "node scripts/verify-env.js" },
    { name: "Immutable Audit Log validation", cmd: "node scripts/verify-audit.js" },
    { name: "Clinical Prescription Signatures validation", cmd: "node scripts/verify-signatures.js" },
    { name: "Database Retention Purging checks", cmd: "node scripts/verify-retention.js" },
    { name: "PHI classifications filter validation", cmd: "node scripts/verify-phi.js" },
    { name: "Field AES-256-GCM Encryption check", cmd: "node scripts/verify-encryption.js" },
    { name: "Device session rotation and replay checks", cmd: "node scripts/verify-sessions.js" },
    { name: "Failed attempts lockouts checking", cmd: "node scripts/verify-auth-protection.js" },
    { name: "Rate limit headers checking", cmd: "node scripts/verify-ratelimits.js" },
    { name: "File upload size and extensions blocking", cmd: "node scripts/verify-uploads.js" },
    { name: "HTTP secure helmet headers checking", cmd: "node scripts/verify-headers.js" },
    { name: "Simulated Database Backup dump checks", cmd: "node scripts/verify-backup.js" },
    { name: "Security incidents tracker validation", cmd: "node scripts/verify-incidents.js" }
  ];

  let allPassed = true;
  for (const suite of suites) {
    const passed = runVerifyScript(suite.name, suite.cmd);
    if (!passed) {
      allPassed = false;
    }
  }

  // Compile compliance documents at the end
  if (allPassed) {
    console.log("\nAll security checks passed. Generating certification markdown files...");
    try {
      execSync("node scripts/generate-compliance.js", { stdio: "inherit" });
    } catch (err) {
      console.error("Failed to generate compliance documents:", err.message);
    }
    console.log("\n======================================================");
    console.log("CONGRATULATIONS: ENTERPRISE SECURITY PLATFORM CERTIFIED!");
    console.log("======================================================");
    process.exit(0);
  } else {
    console.error("\n======================================================");
    console.error("FAIL: One or more security certification suites failed.");
    console.error("======================================================");
    process.exit(1);
  }
};

verifyAll();
