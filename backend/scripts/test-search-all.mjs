import mongoose from "mongoose";
import dotenv from "dotenv";
import { executeSearch } from "../src/modules/search/search.service.js";

dotenv.config();

const testQueries = [
  "fever",
  "headache",
  "chest pain",
  "acne",
  "stomach pain",
  "asthma",
  "pregnancy",
  "kidney stone",
  "diabetes",
  "cardiology",
  "fracture",
  "dizziness",
  "earache",
  "eye pain",
  "anxiety",
  "thyroid",
  "Alok"
];

async function runTests() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB for Search Diagnostics...\n");

  let passed = 0;
  let failed = 0;

  for (const q of testQueries) {
    try {
      const res = await executeSearch(null, q, null, null, null, 10);
      const count = res.results ? res.results.length : 0;
      if (count > 0) {
        console.log(`✅ Search for "${q}": Found ${count} doctor(s) (Mapped: "${res.normalizedQuery}")`);
        passed++;
      } else {
        console.log(`❌ Search for "${q}": 0 results (Normalized: "${res.normalizedQuery}")`);
        failed++;
      }
    } catch (err) {
      console.error(`❌ Search for "${q}" ERROR:`, err.message);
      failed++;
    }
  }

  console.log(`\n=================================`);
  console.log(`Summary: ${passed} passed, ${failed} failed out of ${testQueries.length} test queries.`);
  console.log(`=================================\n`);

  await mongoose.disconnect();
}

runTests();
