import dotenv from "dotenv";
import mongoose from "mongoose";
import Hospital from "../src/modules/hospital/hospital.model.js";
import User from "../src/modules/auth/auth.model.js";
import {
  BIPatientAggregate,
  BIAppointmentAggregate
} from "../src/modules/analytics/bi_warehouse.models.js";
import { getExecutiveKPIs, exportReport } from "../src/modules/analytics/analytics.controller.js";

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

const verifySnapshots = async () => {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log("Connected to Database for Dashboard Snapshot Verification.");

  // Fetch showcase hospital & super admin user
  const hospital = await Hospital.findOne({});
  const superAdmin = await User.findOne({ role: "super_admin" }) || await User.findOne({ role: "admin" });

  if (!hospital || !superAdmin) {
    throw new Error("Seed data is missing. Please run npm run demo:seed small first.");
  }

  const hospitalIdStr = hospital._id.toString();
  const todayStr = new Date().toISOString().split("T")[0];

  console.log(`\nVerifying snapshot consistency for Hospital: ${hospital.name}`);
  console.log(`- Target Date: ${todayStr}`);

  // 1. Fetch Dashboard Value via Executive KPIs controller
  const reqDashboard = {
    query: { hospitalId: hospitalIdStr, date: todayStr },
    user: { userId: superAdmin._id.toString(), role: superAdmin.role },
    baseUrl: "/api/v1/analytics",
    path: "/kpis"
  };
  const resDashboard = mockRes();
  await getExecutiveKPIs(reqDashboard, resDashboard);

  if (resDashboard.statusCode !== 200) {
    throw new Error(`Failed to fetch executive KPIs. Status: ${resDashboard.statusCode}, Message: ${resDashboard.body?.message}`);
  }
  const dashboardPatients = resDashboard.body.data.totalPatients;
  const dashboardAppointments = resDashboard.body.data.totalAppointments;

  console.log(`\n1. [Dashboard Value] totalPatients = ${dashboardPatients}, totalAppointments = ${dashboardAppointments}`);

  // 2. Fetch Warehouse Value directly from database
  const filter = { hospitalId: hospital._id, date: todayStr };
  const patientAgg = await BIPatientAggregate.findOne(filter);
  const appAgg = await BIAppointmentAggregate.findOne(filter);

  const warehousePatients = patientAgg ? patientAgg.totalPatients : 0;
  const warehouseAppointments = appAgg ? appAgg.totalAppointments : 0;

  console.log(`2. [Warehouse Value] totalPatients = ${warehousePatients}, totalAppointments = ${warehouseAppointments}`);

  // 3. Fetch Exported JSON Value
  const reqJson = {
    query: { format: "json", reportType: "kpis", hospitalId: hospitalIdStr, date: todayStr },
    user: { userId: superAdmin._id.toString(), role: superAdmin.role },
    baseUrl: "/api/v1/analytics",
    path: "/export"
  };
  const resJson = mockRes();
  await exportReport(reqJson, resJson);

  if (resJson.statusCode !== 200) {
    throw new Error(`Failed to export JSON report. Status: ${resJson.statusCode}`);
  }
  const jsonPatients = resJson.body.data.totalPatients;
  const jsonAppointments = resJson.body.data.totalAppointments;

  console.log(`3. [Exported JSON Value] totalPatients = ${jsonPatients}, totalAppointments = ${jsonAppointments}`);

  // 4. Fetch Exported CSV Value and parse
  const reqCsv = {
    query: { format: "csv", reportType: "kpis", hospitalId: hospitalIdStr, date: todayStr },
    user: { userId: superAdmin._id.toString(), role: superAdmin.role },
    baseUrl: "/api/v1/analytics",
    path: "/export"
  };
  const resCsv = mockRes();
  await exportReport(reqCsv, resCsv);

  if (resCsv.statusCode !== 200) {
    throw new Error(`Failed to export CSV report. Status: ${resCsv.statusCode}`);
  }
  
  const csvText = resCsv.body;
  // Simple CSV parser
  const lines = csvText.split("\n").map(l => l.trim()).filter(Boolean);
  const dataHeaderIdx = lines.indexOf("Data Metrics");
  if (dataHeaderIdx === -1) {
    throw new Error("CSV report data metrics section is missing.");
  }
  const headers = lines[dataHeaderIdx + 1].split(",");
  const values = lines[dataHeaderIdx + 2].split(",");
  
  const csvPatients = parseInt(values[headers.indexOf("totalPatients")], 10);
  const csvAppointments = parseInt(values[headers.indexOf("totalAppointments")], 10);

  console.log(`4. [Exported CSV Value] totalPatients = ${csvPatients}, totalAppointments = ${csvAppointments}`);

  // Assert equivalence
  console.log("\nValidating mathematical consistency equivalence equations:");
  console.log(`- Patients Check: Dashboard (${dashboardPatients}) == Warehouse (${warehousePatients}) == JSON (${jsonPatients}) == CSV (${csvPatients})`);
  if (dashboardPatients !== warehousePatients || warehousePatients !== jsonPatients || jsonPatients !== csvPatients) {
    throw new Error("MISMATCH: Patients reporting counts are inconsistent!");
  }

  console.log(`- Appointments Check: Dashboard (${dashboardAppointments}) == Warehouse (${warehouseAppointments}) == JSON (${jsonAppointments}) == CSV (${csvAppointments})`);
  if (dashboardAppointments !== warehouseAppointments || warehouseAppointments !== jsonAppointments || jsonAppointments !== csvAppointments) {
    throw new Error("MISMATCH: Appointments reporting counts are inconsistent!");
  }

  await mongoose.disconnect();
  console.log("\n🎉 DASHBOARD SNAPSHOT CONSISTENCY SCAN COMPLETED SUCCESSFULLY!");
  process.exit(0);
};

verifySnapshots().catch(err => {
  console.error("Dashboard snapshot verification failed:", err);
  process.exit(1);
});
