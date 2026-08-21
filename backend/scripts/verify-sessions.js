import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../src/modules/auth/auth.model.js";
import Session from "../src/modules/auth/session.model.js";
import SecurityIncident from "../src/modules/admin/security_incident.model.js";
import { generateTokens, refreshUserToken } from "../src/modules/auth/auth.service.js";

dotenv.config();

const verifySessions = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB for Session Verification.");

    // Retrieve or create a test user
    let user = await User.findOne({ email: "patient@smarthealth.com" });
    if (!user) {
      user = await User.create({
        name: "Session Patient",
        email: "patient@smarthealth.com",
        phone: "1112223333",
        role: "patient",
        profileCompleted: true
      });
    }

    // Clean any old sessions for this user
    await Session.deleteMany({ userId: user._id });

    // Simulate login by generating tokens with mock request
    const mockReq = {
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      ip: "127.0.0.1"
    };

    const tokens1 = await generateTokens(user, mockReq);
    console.log("Tokens 1 Generated.");

    // Assert session was created
    const hashedToken1 = crypto.createHash("sha256").update(tokens1.refreshToken).digest("hex");
    const session1 = await Session.findOne({ refreshTokenHash: hashedToken1 });
    if (!session1) {
      console.error("FAIL: Session was not created on token generation.");
      process.exit(1);
    }
    if (session1.deviceName !== "Chrome Windows" || session1.browser !== "Chrome" || session1.platform !== "Windows") {
      console.error("FAIL: Parsed session user agent fields are incorrect:", session1);
      process.exit(1);
    }
    console.log("PASS: Session successfully parsed user agent details:", session1.deviceName);

    // Refresh token rotation test: refresh using token1
    const tokens2 = await refreshUserToken(tokens1.refreshToken, mockReq);
    console.log("Tokens 2 Generated via Refresh Rotation.");

    // Assert session1 is now revoked
    const session1Updated = await Session.findOne({ refreshTokenHash: hashedToken1 });
    if (!session1Updated.isRevoked) {
      console.error("FAIL: Old session was not marked revoked after refresh rotation.");
      process.exit(1);
    }
    console.log("PASS: Old session revoked on refresh rotation.");

    // Assert session2 is created and active
    const hashedToken2 = crypto.createHash("sha256").update(tokens2.refreshToken).digest("hex");
    const session2 = await Session.findOne({ refreshTokenHash: hashedToken2 });
    if (!session2 || session2.isRevoked) {
      console.error("FAIL: New active session was not created for rotated token.");
      process.exit(1);
    }
    console.log("PASS: Active session registered for rotated refresh token.");

    // Replay attack / Reuse detection test: attempt to refresh again with token1
    try {
      await refreshUserToken(tokens1.refreshToken, mockReq);
      console.error("FAIL: Token reuse did not throw an error!");
      process.exit(1);
    } catch (err) {
      console.log("PASS: Rotated token reuse rejected as expected:", err.message);
    }

    // Verify a security incident of type TOKEN_REUSE was logged
    const incident = await SecurityIncident.findOne({
      category: "TOKEN_REUSE",
      affectedUserId: user._id
    });
    if (!incident) {
      console.error("FAIL: Security incident was not logged for token reuse!");
      process.exit(1);
    }
    console.log("PASS: Security Incident of type TOKEN_REUSE successfully captured:", incident.description);

    // Clean up test documents
    await Session.deleteMany({ userId: user._id });
    await SecurityIncident.deleteOne({ _id: incident._id });

    console.log("SESSION SECURITY ENGINE VERIFICATION PASSED.");
    process.exit(0);
  } catch (err) {
    console.error("Session verification failure:", err);
    process.exit(1);
  }
};

verifySessions();
