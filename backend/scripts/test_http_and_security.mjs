import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import assert from "assert";
import app from "../src/app.js";

dotenv.config();

const makeRequest = (server, method, path, headers = {}, body = null) => {
  const address = server.address();
  const port = address.port;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: {
        ...headers,
        ...(body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  console.log("Test HTTP server listening on port:", server.address().port);

  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  };

  try {
    // 1. Core Health Check Endpoints
    await test("Root GET /health returns 200 healthy", async () => {
      const res = await makeRequest(server, "GET", "/health");
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "healthy");
      assert.ok(res.body.timestamp);
      assert.ok(res.body.env);
      // Ensure no internal infrastructure leakage
      assert.equal(res.body.MONGO_URI, undefined);
      assert.equal(res.body.JWT_SECRET, undefined);
    });

    await test("API GET /api/v1/health returns 200 healthy", async () => {
      const res = await makeRequest(server, "GET", "/api/v1/health");
      assert.equal(res.status, 200);
      assert.equal(res.body.status, "healthy");
      assert.ok(res.body.timestamp);
      assert.ok(res.body.env);
      assert.equal(res.body.MONGO_URI, undefined);
    });

    // 2. Security: Unauthorized Search Attempt
    await test("GET /api/v1/search without authorization returns 401 Unauthorized", async () => {
      const res = await makeRequest(server, "GET", "/api/v1/search?q=fever");
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
      assert.equal(res.body.message, "Unauthorized");
    });

    // 3. Security: Input Validation Constraints
    await test("GET /api/v1/search?q= (empty query) returns 401 or 400", async () => {
      const res = await makeRequest(server, "GET", "/api/v1/search?q=");
      assert.ok(res.status === 400 || res.status === 401);
    });

    // 4. Public suggestions endpoint input handling
    await test("GET /api/v1/search/suggestions?q=fe returns matching prefixes", async () => {
      const res = await makeRequest(server, "GET", "/api/v1/search/suggestions?q=fe");
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.data?.suggestions));
      assert.ok(res.body.data.suggestions.length <= 8);
    });

    await test("GET /api/v1/search/suggestions without q returns empty suggestions array", async () => {
      const res = await makeRequest(server, "GET", "/api/v1/search/suggestions");
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.data?.suggestions, []);
    });

    // 5. Security: Detail endpoint authorization protection
    await test("GET /api/v1/search/details/:doctorId without token returns 401 Unauthorized", async () => {
      const res = await makeRequest(server, "GET", "/api/v1/search/details/609c12345678901234567890");
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log("\n=================================");
  console.log(`HTTP & SECURITY TESTS: ${passed} passed, ${failed} failed`);
  console.log("=================================\n");

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
