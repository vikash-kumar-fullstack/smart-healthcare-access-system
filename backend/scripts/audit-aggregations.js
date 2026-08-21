import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";

process.env.NODE_ENV = "test";
dotenv.config();

// Import models
import Doctor from "../src/modules/doctor/doctor.model.js";
import Queue from "../src/modules/queue/queue.model.js";

function findExecutionStats(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (obj.executionStats) return obj.executionStats;
  for (const key of Object.keys(obj)) {
    const res = findExecutionStats(obj[key]);
    if (res) return res;
  }
  return null;
}

const runAudit = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI is not set.");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to database for aggregation explain audit.");

  const reportLines = [];
  reportLines.push("# Aggregation Optimization & Explain Audit Report\n");
  reportLines.push(`Generated on: ${new Date().toISOString()}\n`);
  reportLines.push("This report documents the execution statistics for the primary Mongoose aggregation pipelines used across the application. Each query was audited using `.explain('executionStats')`.\n");

  // 1. Doctor.aggregate in getDoctors
  console.log("Auditing Doctor.aggregate...");
  const docExplain = await Doctor.aggregate([
    { $match: {} },
    {
      $lookup: {
        from: "queuesessions",
        let: { doctorId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$doctorId", "$$doctorId"] },
                  { $eq: ["$date", "2026-07-12"] }
                ]
              }
            }
          }
        ],
        as: "sessions"
      }
    },
    { $addFields: { session: { $arrayElemAt: ["$sessions", 0] } } },
    {
      $lookup: {
        from: "queues",
        let: { sessionId: "$session._id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$sessionId", "$$sessionId"] },
                  { $in: ["$status", ["waiting", "in_progress"]] }
                ]
              }
            }
          },
          { $sort: { queueNumber: 1 } }
        ],
        as: "activeQueue"
      }
    },
    {
      $addFields: {
        queueLoad: { $size: "$activeQueue" },
        sessionStatus: { $ifNull: ["$session.sessionStatus", "inactive"] }
      }
    },
    {
      $project: {
        name: 1,
        specialization: 1,
        hospitalId: 1,
        queueLoad: 1,
        sessionStatus: 1
      }
    }
  ]).explain("executionStats");

  const stats = findExecutionStats(docExplain) || {};
  reportLines.push("## 1. Doctor Enrichment Aggregation (getDoctors)");
  reportLines.push("Enriches doctors with active today session and queue workload counts in a single network roundtrip.");
  reportLines.push("```json");
  reportLines.push(JSON.stringify({
    executionSuccess: stats.executionSuccess,
    nReturned: stats.nReturned,
    executionTimeMillis: stats.executionTimeMillis,
    totalKeysExamined: stats.totalKeysExamined,
    totalDocsExamined: stats.totalDocsExamined
  }, null, 2));
  reportLines.push("```\n");

  // 2. Queue.aggregate in patientsWithMultipleBookings
  console.log("Auditing Queue aggregates...");
  const multipleExplain = await Queue.aggregate([
    { $match: { isActive: false, status: "completed" } },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } }
  ]).explain("executionStats");

  const multStats = findExecutionStats(multipleExplain) || {};
  reportLines.push("## 2. Patients with Multiple Bookings Aggregation (analytics-admin)");
  reportLines.push("Calculates repeat patient visits count for clinic cohort tracking.");
  reportLines.push("```json");
  reportLines.push(JSON.stringify({
    executionSuccess: multStats.executionSuccess,
    nReturned: multStats.nReturned,
    executionTimeMillis: multStats.executionTimeMillis,
    totalKeysExamined: multStats.totalKeysExamined,
    totalDocsExamined: multStats.totalDocsExamined
  }, null, 2));
  reportLines.push("```\n");

  // Write report
  fs.writeFileSync("QUERY_REPORT.md", reportLines.join("\n"));
  console.log("Wrote QUERY_REPORT.md successfully.");
  await mongoose.disconnect();
  process.exit(0);
};

runAudit().catch(err => {
  console.error("Audit run failed:", err);
  process.exit(1);
});
