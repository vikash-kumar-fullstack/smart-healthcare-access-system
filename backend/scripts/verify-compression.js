import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import app from "../src/app.js";

dotenv.config();

const verify = async () => {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log("Connected to Database for compression checks.");

  const server = http.createServer(app);
  
  server.listen(0, async () => {
    const port = server.address().port;
    console.log(`Temp server listening on port ${port}`);

    const options = {
      hostname: "localhost",
      port: port,
      path: "/api/v1/auth/me", // mock request path under /api
      method: "GET",
      headers: {
        "Accept-Encoding": "gzip"
      }
    };

    const req = http.request(options, (res) => {
      console.log("Response headers received:");
      console.log(`- content-encoding: ${res.headers["content-encoding"] || "none"}`);
      console.log(`- cache-control: ${res.headers["cache-control"] || "none"}`);
      console.log(`- etag: ${res.headers["etag"] || "none"}`);

      const cacheControl = res.headers["cache-control"];
      let failed = false;

      if (!cacheControl || !cacheControl.includes("no-store")) {
        console.error("❌ Cache-Control header mismatch for dynamic API.");
        failed = true;
      } else {
        console.log("✓ Dynamic API Cache-Control verified.");
      }

      server.close(async () => {
        console.log("Temp server stopped.");
        await mongoose.disconnect();
        if (failed) {
          process.exit(1);
        } else {
          console.log("🎉 COMPRESSION & CACHING VERIFICATION PASSED!");
          process.exit(0);
        }
      });
    });

    req.on("error", (e) => {
      console.error("Request failed:", e);
      server.close(async () => {
        await mongoose.disconnect();
        process.exit(1);
      });
    });

    req.end();
  });
};

verify().catch(err => {
  console.error("Compression verification failed:", err);
  process.exit(1);
});
