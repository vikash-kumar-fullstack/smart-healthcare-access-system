import dotenv from "dotenv";
import { loginRateLimiter } from "../src/middlewares/rate-limit.middleware.js";

dotenv.config();

const verifyRateLimits = async () => {
  try {
    // Disable demo mode skip for rate limits testing
    process.env.DEMO_MODE = "false";
    process.env.NODE_ENV = "production";

    const ip = "1.2.3.4";
    const req = {
      ip,
      headers: {},
      rateLimit: {},
      app: {
        get: (name) => {
          if (name === "trust proxy") return false;
          return undefined;
        }
      }
    };

    let responseCode = 200;
    let jsonBody = null;

    const res = {
      setHeader: (name, val) => {
        res.headers = res.headers || {};
        res.headers[name.toLowerCase()] = val;
      },
      status: (code) => {
        responseCode = code;
        return res;
      },
      send: (body) => {
        jsonBody = body;
        return res;
      },
      json: (body) => {
        jsonBody = body;
        return res;
      }
    };

    console.log("Simulating 6 rapid requests to rate-limited endpoint...");
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => {
        loginRateLimiter(req, res, () => {
          resolve();
        });
      });
    }

    if (responseCode !== 429) {
      console.error(`FAIL: Limiter did not trigger 429 status code. Code received: ${responseCode}`);
      process.exit(1);
    }

    if (!jsonBody || jsonBody.success !== false) {
      console.error("FAIL: JSON response format is incorrect on 429 trigger.");
      process.exit(1);
    }

    console.log("PASS: 429 rate limit triggered and returned correct error payload.");
    console.log("RATE LIMIT PLATFORM VERIFICATION PASSED SUCCESSFULLY.");
    process.exit(0);
  } catch (err) {
    console.error("Rate limits verification failure:", err);
    process.exit(1);
  }
};

verifyRateLimits();
