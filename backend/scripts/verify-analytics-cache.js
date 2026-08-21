import dotenv from "dotenv";
import mongoose from "mongoose";
import Hospital from "../src/modules/hospital/hospital.model.js";
import User from "../src/modules/auth/auth.model.js";
import { getExecutiveKPIs, clearBICache } from "../src/modules/analytics/analytics.controller.js";

process.env.NODE_ENV = "test";
dotenv.config();

const mockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status: (code) => {
      res.statusCode = code;
      return res;
    },
    json: (data) => {
      res.body = data;
      return res;
    },
    send: (data) => {
      res.body = data;
      return res;
    },
    setHeader: (name, val) => {
      res.headers[name] = val;
    }
  };
  return res;
};

const verifyCache = async () => {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log("Connected to Database for Analytics Cache verification.");

  // Fetch hospital and admin
  const hospital = await Hospital.findOne({});
  const superAdmin = await User.findOne({ role: "super_admin" }) || await User.findOne({ role: "admin" });

  if (!hospital || !superAdmin) {
    throw new Error("Seed data is missing. Please run npm run demo:seed small first.");
  }

  const hospitalIdStr = hospital._id.toString();
  const todayStr = new Date().toISOString().split("T")[0];

  const reqBase = {
    query: { hospitalId: hospitalIdStr, date: todayStr },
    user: { userId: superAdmin._id.toString(), role: superAdmin.role },
    baseUrl: "/api/v1/analytics",
    path: "/kpis"
  };

  console.log("\n1. Requesting KPI Dashboard (First Run)...");
  const res1 = mockRes();
  await getExecutiveKPIs(reqBase, res1);
  const cacheHeader1 = res1.headers["X-Cache"];
  console.log(`- Result: Cache Status = ${cacheHeader1}`);
  if (cacheHeader1 !== "MISS") {
    throw new Error(`Expected Cache MISS on first request, got: ${cacheHeader1}`);
  }

  console.log("\n2. Requesting KPI Dashboard again (Second Run)...");
  const res2 = mockRes();
  await getExecutiveKPIs(reqBase, res2);
  const cacheHeader2 = res2.headers["X-Cache"];
  console.log(`- Result: Cache Status = ${cacheHeader2}`);
  if (cacheHeader2 !== "HIT") {
    throw new Error(`Expected Cache HIT on second request, got: ${cacheHeader2}`);
  }

  console.log("\n3. Requesting KPI Dashboard with refresh=true (Forced Refresh)...");
  const reqRefresh = {
    ...reqBase,
    query: { ...reqBase.query, refresh: "true" }
  };
  const res3 = mockRes();
  await getExecutiveKPIs(reqRefresh, res3);
  const cacheHeader3 = res3.headers["X-Cache"];
  console.log(`- Result: Cache Status = ${cacheHeader3}`);
  if (cacheHeader3 !== "MISS") {
    throw new Error(`Expected Cache MISS when refresh=true is specified, got: ${cacheHeader3}`);
  }

  console.log("\n4. Triggering manual cache invalidation / flush...");
  const resFlush = mockRes();
  await clearBICache({}, resFlush);
  if (resFlush.statusCode !== 200) {
    throw new Error(`Manual cache flush failed with status: ${resFlush.statusCode}`);
  }
  console.log(`- Flush status: ${resFlush.body.message}`);

  console.log("\n5. Requesting KPI Dashboard after cache flush...");
  const res4 = mockRes();
  await getExecutiveKPIs(reqBase, res4);
  const cacheHeader4 = res4.headers["X-Cache"];
  console.log(`- Result: Cache Status = ${cacheHeader4}`);
  if (cacheHeader4 !== "MISS") {
    throw new Error(`Expected Cache MISS after flush, got: ${cacheHeader4}`);
  }

  await mongoose.disconnect();
  console.log("\n🎉 ANALYTICS CACHE VALIDATION SCAFFOLD PASSES CLEANLY!");
  process.exit(0);
};

verifyCache().catch(err => {
  console.error("Cache verification failed:", err);
  process.exit(1);
});
