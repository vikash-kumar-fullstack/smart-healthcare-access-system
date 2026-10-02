import mongoose from "mongoose";
import dotenv from "dotenv";
import assert from "assert";
import { executeSearch } from "../src/modules/search/search.service.js";
import { normalizeQuery, findMatchingSymptom } from "../src/modules/search/symptom.service.js";

dotenv.config();

async function runConcern1Tests() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== RUNNING CONCERN #1 AUTOMATED TEST SUITE ===\n");

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

  // --- PART A: Degraded Mode & High Traffic Behavior ---
  console.log("--- PART A: Degraded Mode & High Traffic Verification ---");

  await test("Normal single-user search returns mode: 'normal' (NOT degraded)", async () => {
    const res = await executeSearch(null, "fever", null, null, null, 10);
    assert.equal(res.mode, "normal", `Expected mode 'normal', but got '${res.mode}'`);
    assert.ok(res.results.length > 0, "Expected doctors to be returned");
  });

  await test("Search for headache returns mode: 'normal'", async () => {
    const res = await executeSearch(null, "headache", null, null, null, 10);
    assert.equal(res.mode, "normal", `Expected mode 'normal', but got '${res.mode}'`);
  });

  await test("Search for cough returns mode: 'normal'", async () => {
    const res = await executeSearch(null, "cough", null, null, null, 10);
    assert.equal(res.mode, "normal", `Expected mode 'normal', but got '${res.mode}'`);
  });

  await test("High candidate threshold condition correctly triggers degraded clinical matchmaking", async () => {
    process.env.SEARCH_DEGRADED_CANDIDATE_THRESHOLD = "3";
    try {
      const res = await executeSearch(null, "headache-high-candidate-test", null, null, null, 10);
      assert.equal(res.mode, "degraded", `Expected mode 'degraded' when candidates exceed threshold, but got '${res.mode}'`);
    } finally {
      delete process.env.SEARCH_DEGRADED_CANDIDATE_THRESHOLD;
    }
  });

  await test("Emergency degraded mode flag correctly triggers degraded fallback", async () => {
    process.env.SEARCH_DEGRADED_MODE = "true";
    try {
      const res = await executeSearch(null, "emergency-degraded-query-test", null, null, null, 10);
      assert.equal(res.mode, "degraded", `Expected mode 'degraded', but got '${res.mode}'`);
    } finally {
      delete process.env.SEARCH_DEGRADED_MODE;
    }
  });

  // --- PART B: Symptom -> Doctor Discovery (Required Core Symptoms) ---
  console.log("\n--- PART B: Core Symptom -> Doctor Discovery ---");

  const coreSymptoms = [
    { query: "fever", expectedDept: "general medicine" },
    { query: "headache", expectedDept: "neurology" },
    { query: "cough", expectedDept: "general medicine" },
    { query: "cold", expectedDept: "general medicine" },
    { query: "chest pain", expectedDept: "cardiology" },
    { query: "stomach pain", expectedDept: "gastroenterology" },
    { query: "skin rash", expectedDept: "dermatology" },
    { query: "eye pain", expectedDept: "ophthalmology" }
  ];

  for (const s of coreSymptoms) {
    await test(`Symptom '${s.query}' maps to department and discovers doctors`, async () => {
      const norm = normalizeQuery(s.query);
      const match = await findMatchingSymptom(norm);
      assert.ok(match, `Symptom dictionary should match '${s.query}'`);

      const res = await executeSearch(null, s.query, null, null, null, 10);
      assert.ok(res.results.length > 0, `Search for '${s.query}' must return at least 1 doctor, got ${res.results.length}`);
      assert.ok(res.results[0].doctorId, "Doctor result must include doctorId");
      assert.ok(res.results[0].doctor.name, "Doctor result must include doctor name");
      assert.ok(res.results[0].doctor.specialization, "Doctor result must include specialization");
    });
  }

  // --- PART C: Query Normalization, Edge Cases & Variations ---
  console.log("\n--- PART C: Normalization, Edge Cases & Variations ---");

  await test("Mixed casing: 'fEvEr' returns fever doctors", async () => {
    const res = await executeSearch(null, "fEvEr", null, null, null, 10);
    assert.equal(res.normalizedQuery, "fever");
    assert.ok(res.results.length > 0);
  });

  await test("Extra surrounding spaces: '   headache   ' normalizes and finds doctors", async () => {
    const res = await executeSearch(null, "   headache   ", null, null, null, 10);
    assert.equal(res.normalizedQuery, "headache");
    assert.ok(res.results.length > 0);
  });

  await test("Combined symptom: 'fever & cough' matches properly", async () => {
    const res = await executeSearch(null, "fever & cough", null, null, null, 10);
    assert.ok(res.results.length > 0);
  });

  await test("Single token: 'stomach' matches stomach pain rather than baby colic", async () => {
    const match = await findMatchingSymptom("stomach");
    assert.ok(match, "Should match a symptom");
    assert.ok(match.name.includes("stomach"), `Expected stomach symptom, got: ${match.name}`);
    const res = await executeSearch(null, "stomach", null, null, null, 10);
    assert.ok(res.results.length > 0);
  });

  await test("Single token: 'skin' matches skin rash/dermatology rather than anemia", async () => {
    const match = await findMatchingSymptom("skin");
    assert.ok(match, "Should match a symptom");
    assert.ok(
      match.specializationIds.includes("dermatology") || match.name.includes("rash"),
      `Expected dermatology/rash, got: ${match.name}`
    );
  });

  await test("Doctor name query: 'Alok' discovers doctor by text search", async () => {
    const res = await executeSearch(null, "Alok", null, null, null, 10);
    assert.ok(res.results.length > 0, "Should find doctor Alok");
  });

  await test("Unrecognized query safely returns unknown_query mode without 500 or false specialty match", async () => {
    const res = await executeSearch(null, "unrecognizedsymptomqueryxyz", null, null, null, 10);
    assert.ok(res.results !== undefined, "Results must be defined");
    assert.equal(res.mode, "unknown_query", "Unrecognized query must safely enter unknown_query mode");
    assert.equal(res.results.length, 0, "Unrecognized query must not fabricate doctor matches");
  });

  // --- PART D: Result Bounds and Pagination Limits ---
  console.log("\n--- PART D: Result Bounds and Pagination ---");

  await test("Limit parameter is bounded (limit=2 returns exactly 2)", async () => {
    const res = await executeSearch(null, "fever", null, null, null, 2);
    assert.equal(res.results.length, 2, `Expected 2 results, got ${res.results.length}`);
    assert.ok(res.nextCursor, "Expected nextCursor to exist when hasMore");
  });

  await test("Over-limit request is clamped to maximum 20", async () => {
    const res = await executeSearch(null, "fever", null, null, null, 100);
    assert.ok(res.results.length <= 20, `Results length ${res.results.length} should be <= 20`);
  });

  console.log("\n=================================");
  console.log(`TOTAL: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log("=================================\n");

  await mongoose.disconnect();
  if (failed > 0) process.exit(1);
}

runConcern1Tests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
