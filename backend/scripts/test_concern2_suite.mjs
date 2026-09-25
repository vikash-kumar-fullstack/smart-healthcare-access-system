import mongoose from "mongoose";
import dotenv from "dotenv";
import assert from "assert";
import { executeSearch, getDoctorHealthcareDetails } from "../src/modules/search/search.service.js";
import { getCarePathwayForQuery } from "../src/modules/search/symptom.service.js";
import { computeFahraScore, calculateFreshness, PREFERENCE_WEIGHTS } from "../src/modules/search/fahra.service.js";
import Doctor from "../src/modules/doctor/doctor.model.js";

dotenv.config();

async function runConcern2Tests() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("=== RUNNING CONCERN #2 AUTOMATED TEST SUITE ===\n");

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

  // --- PART A: Care Pathway & Query Understanding ---
  console.log("--- PART A: Care Pathway & Query Understanding ---");

  await test("Single symptom 'fever' maps to General Medicine care pathway without diagnosis", async () => {
    const pathway = await getCarePathwayForQuery("fever");
    assert.ok(pathway.primarySpecialties.includes("General Medicine"), "Expected General Medicine primary specialty");
    assert.equal(pathway.isEmergency, false, "Fever should not trigger acute emergency");
    assert.ok(pathway.disclaimer.includes("not provide clinical diagnosis"), "Expected clinical diagnosis disclaimer");
  });

  await test("Symptom 'headache' maps to primary specialty Neurology with related General Medicine", async () => {
    const pathway = await getCarePathwayForQuery("headache");
    assert.ok(pathway.primarySpecialties.includes("Neurology"), "Expected Neurology primary specialty");
    assert.ok(
      pathway.primarySpecialties.includes("General Medicine") || pathway.relatedSpecialties.includes("General Medicine"),
      "Expected General Medicine in relevant specialties"
    );
  });

  await test("Multi-symptom query 'fever & cough' identifies care pathways for both complaints", async () => {
    const pathway = await getCarePathwayForQuery("fever & cough");
    assert.ok(pathway.primarySpecialties.includes("General Medicine"), "Expected General Medicine for fever & cough");
    assert.ok(pathway.symptoms.length > 0, "Expected matched symptoms array");
  });

  await test("Acute symptom 'chest pain' triggers isEmergency and emergency advice", async () => {
    const pathway = await getCarePathwayForQuery("chest pain");
    assert.equal(pathway.isEmergency, true, "Expected isEmergency to be true for chest pain");
    assert.ok(pathway.emergencyMessage && pathway.emergencyMessage.includes("call 108"), "Expected 108 emergency advice");
    assert.ok(pathway.primarySpecialties.includes("Cardiology"), "Expected Cardiology primary specialty");
  });

  // --- PART B: FA-HRA Algorithm & Freshness Telemetry ---
  console.log("\n--- PART B: FA-HRA Algorithm & Freshness Telemetry ---");

  await test("calculateFreshness computes exponential decay and user-friendly states", () => {
    const now = Date.now();
    const liveFreshness = calculateFreshness(new Date(now - 15 * 1000)); // 15 sec ago
    assert.equal(liveFreshness.state, "live");
    assert.ok(liveFreshness.displayText.includes("Live"));
    assert.ok(liveFreshness.freshness > 0.9, "Freshness value should be close to 1.0");

    const recentFreshness = calculateFreshness(new Date(now - 120 * 1000)); // 2 min ago
    assert.equal(recentFreshness.state, "recent");
    assert.ok(recentFreshness.displayText.includes("Recently updated"));

    const staleFreshness = calculateFreshness(new Date(now - 600 * 1000)); // 10 min ago
    assert.equal(staleFreshness.state, "stale");
  });

  await test("computeFahraScore evaluates normalized metrics and candidate cost score", () => {
    const scoreObj = computeFahraScore({
      estimatedWaitMinutes: 15,
      distanceKm: 4.5,
      currentQueue: 3,
      maxQueueLimit: 50,
      lastComputedAt: new Date(Date.now() - 30 * 1000),
      preference: "balanced"
    });

    assert.ok(typeof scoreObj.costScore === "number", "Expected numeric costScore");
    assert.ok(scoreObj.suitabilityScore >= 0 && scoreObj.suitabilityScore <= 100, "Suitability score should be 0-100");
    assert.ok(scoreObj.metrics.normalizedWait <= 1.0, "Wait time must be normalized <= 1.0");
    assert.ok(scoreObj.metrics.normalizedDistance <= 1.0, "Distance must be normalized <= 1.0");
    assert.equal(scoreObj.metrics.networkReliability, 1.0, "Network reliability preserved at baseline 1.0");
  });

  await test("Patient preference profiles adjust ranking weights without exposing formulas", () => {
    const balanced = computeFahraScore({
      estimatedWaitMinutes: 60,
      distanceKm: 2,
      preference: "balanced"
    });

    const fastest = computeFahraScore({
      estimatedWaitMinutes: 60,
      distanceKm: 2,
      preference: "fastest"
    });

    const closest = computeFahraScore({
      estimatedWaitMinutes: 60,
      distanceKm: 2,
      preference: "closest"
    });

    assert.equal(fastest.preferenceUsed, "fastest");
    assert.equal(closest.preferenceUsed, "closest");
    assert.notEqual(fastest.costScore, closest.costScore, "Different preferences should yield distinct candidate scores");
  });

  // --- PART C: Level 1 Progressive Disclosure Search Contract ---
  console.log("\n--- PART C: Level 1 Progressive Disclosure Search Contract ---");

  await test("Search returns carePathway, recommendedOptions, and alternativeOptions", async () => {
    const res = await executeSearch(null, "headache", 28.53, 77.28, null, 10, "balanced");
    assert.ok(res.carePathway, "Expected carePathway in response");
    assert.ok(Array.isArray(res.relevantSpecialties), "Expected relevantSpecialties array");
    assert.ok(Array.isArray(res.recommendedOptions), "Expected recommendedOptions array");
    assert.ok(Array.isArray(res.alternativeOptions), "Expected alternativeOptions array");
    assert.ok(Array.isArray(res.results), "Expected results array for backward compatibility");
    assert.equal(res.metadata.preference, "balanced");
  });

  await test("Search result cards contain essential comparison data without leaking raw formulas", async () => {
    const res = await executeSearch(null, "fever", null, null, null, 5);
    assert.ok(res.results.length > 0, "Expected search results");
    const first = res.results[0];

    assert.ok(first.doctor && first.doctor.name, "Doctor name is required");
    assert.ok(first.doctor.specialization, "Specialty is required");
    assert.ok(first.hospital, "Hospital summary is required");
    assert.ok(first.availability, "Availability status is required");
    assert.ok(typeof first.estimatedWaitMinutes === "number", "Numeric estimatedWaitMinutes is required");
    assert.ok(first.freshness && first.freshness.displayText, "Freshness displayText is required");
    assert.ok(Array.isArray(first.why), "Human-readable why reasons required");

    // Ensure raw technical weights and internal equations are NOT exposed in client response
    assert.equal(first.wW, undefined, "Raw weight wW must not be leaked");
    assert.equal(first.wD, undefined, "Raw weight wD must not be leaked");
    assert.equal(first.costScore, undefined, "Raw cost score equation must not be leaked to client");
  });

  // --- PART D: Level 2 Detail View Endpoint ---
  console.log("\n--- PART D: Level 2 Detail View Endpoint ---");

  await test("getDoctorHealthcareDetails returns structured Doctor, Hospital, Telemetry, and Alternatives", async () => {
    const anyDoctor = await Doctor.findOne({ status: { $in: ["active", "approved", "verified"] } });
    assert.ok(anyDoctor, "Precondition: At least one doctor must be registered");

    const details = await getDoctorHealthcareDetails(anyDoctor._id.toString(), { lat: 28.53, lng: 77.28 }, "headache");
    assert.ok(details, "Expected doctor healthcare details");

    // A. Doctor section
    assert.equal(details.doctor._id, anyDoctor._id.toString());
    assert.ok(details.doctor.name);
    assert.ok(details.doctor.specialization);

    // B. Hospital section
    assert.ok(details.hospital);
    assert.ok(details.hospital.name);

    // C. Operational Telemetry
    assert.ok(details.operational);
    assert.ok(typeof details.operational.estimatedWaitMinutes === "number");
    assert.ok(typeof details.operational.currentQueue === "number");

    // D. Freshness & Reliability
    assert.ok(details.freshness);
    assert.ok(details.freshness.displayText);
    assert.ok(details.freshness.reliabilityExplanation);

    // E. Explainability ("Why this option?")
    assert.ok(Array.isArray(details.why) && details.why.length > 0);

    // F. Alternatives
    assert.ok(Array.isArray(details.alternatives));
  });

  await test("getDoctorHealthcareDetails handles non-existent doctor with null", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const details = await getDoctorHealthcareDetails(fakeId);
    assert.equal(details, null, "Expected null for non-existent doctor");
  });

  console.log(`\n=================================`);
  console.log(`TOTAL: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
  console.log(`=================================\n`);

  await mongoose.disconnect();
  if (failed > 0) process.exit(1);
}

runConcern2Tests().catch(err => {
  console.error("Test execution fatal error:", err);
  process.exit(1);
});
