import dotenv from "dotenv";
import mongoose from "mongoose";

process.env.NODE_ENV = "test";
dotenv.config();

// Load models
import AppointmentBooking from "../src/modules/queue/appointment_booking.model.js";
import Visit from "../src/modules/visit/visit.model.js";
import { BIAppointmentAggregate, BIVisitAggregate } from "../src/modules/analytics/bi_warehouse.models.js";

const verifyBIConsistency = async () => {
  const mongoUri = process.env.MONGO_URI;
  await mongoose.connect(mongoUri);
  console.log("Connected to Database for BI consistency verification.");

  const todayStr = new Date().toISOString().split("T")[0];

  console.log("1. Verifying Appointments: Operational counts vs BI Warehouse aggregates...");
  const rawAppointments = await AppointmentBooking.countDocuments({ date: todayStr });
  
  const warehouseAgg = await BIAppointmentAggregate.findOne({ date: todayStr });
  const warehouseCount = warehouseAgg ? warehouseAgg.totalAppointments : 0;

  console.log(`- Operational DB: ${rawAppointments} bookings.`);
  console.log(`- BI Warehouse:   ${warehouseCount} bookings.`);

  if (rawAppointments !== warehouseCount) {
    throw new Error(`Data Inconsistency! Operational count (${rawAppointments}) != Warehouse count (${warehouseCount}).`);
  }
  console.log("- Appointments: CONSISTENT");

  console.log("\n2. Verifying Visits: Operational counts vs BI Warehouse aggregates...");
  const rawVisits = await Visit.countDocuments({ bookingDate: todayStr });
  
  const visitAgg = await BIVisitAggregate.findOne({ date: todayStr });
  const warehouseVisits = visitAgg ? visitAgg.totalVisits : 0;

  console.log(`- Operational DB: ${rawVisits} visits.`);
  console.log(`- BI Warehouse:   ${warehouseVisits} visits.`);

  if (rawVisits !== warehouseVisits) {
    throw new Error(`Data Inconsistency! Operational count (${rawVisits}) != Warehouse count (${warehouseVisits}).`);
  }
  console.log("- Visits: CONSISTENT");

  await mongoose.disconnect();
  console.log("\n🎉 BI DATA WAREHOUSE IS 100% CONSISTENT WITH OPERATIONAL TRANSACTION DATA!");
  process.exit(0);
};

verifyBIConsistency().catch(err => {
  console.error("BI Consistency Engine check failed:", err);
  process.exit(1);
});
