import app from "../src/app.js";

const verifyHeaders = async () => {
  try {
    const mockRes = {
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      removeHeader(name) {
        if (this.headers) {
          delete this.headers[name.toLowerCase()];
        }
      },
      getHeader(name) {
        return this.headers ? this.headers[name.toLowerCase()] : undefined;
      },
      status() {
        return this;
      },
      json() {
        return this;
      }
    };

    const mockReq = {
      method: "GET",
      url: "/",
      path: "/",
      headers: {}
    };

    // Run app middleware cycle
    await new Promise((resolve) => {
      app(mockReq, mockRes, () => {
        resolve();
      });
    });

    const headers = mockRes.headers || {};
    console.log("Mock Response Headers:", headers);

    const requiredHeaders = [
      "strict-transport-security",
      "content-security-policy",
      "x-frame-options",
      "x-content-type-options",
      "x-xss-protection"
    ];

    for (const h of requiredHeaders) {
      if (!headers[h]) {
        console.error(`FAIL: Missing security header: ${h}`);
        process.exit(1);
      }
    }

    if (!headers["x-frame-options"].toLowerCase().includes("deny")) {
      console.error(`FAIL: X-Frame-Options value is incorrect: ${headers["x-frame-options"]}`);
      process.exit(1);
    }

    if (!headers["x-content-type-options"].toLowerCase().includes("nosniff")) {
      console.error(`FAIL: X-Content-Type-Options value is incorrect: ${headers["x-content-type-options"]}`);
      process.exit(1);
    }

    console.log("PASS: All critical security headers are present and valid.");
    console.log("SECURITY HEADERS VERIFICATION PASSED SUCCESSFULLY.");
    process.exit(0);
  } catch (err) {
    console.error("Headers verification failure:", err);
    process.exit(1);
  }
};

verifyHeaders();
