import assert from "node:assert/strict";
import { formatEstimatedTravelTime } from "../../frontend/src/utils/formatters.js";

console.log("=== TRAVEL TIME FORMATTER UNIT TESTS ===\n");

const cases = [
  { input: 45, expected: "~45 min" },
  { input: 60, expected: "~1 hr" },
  { input: 75, expected: "~1 hr 15 min" },
  { input: 120, expected: "~2 hr" },
  { input: 3253, expected: "~54 hr 13 min" },
  // Edge cases
  { input: 1, expected: "~1 min" },
  { input: 59, expected: "~59 min" },
  { input: 61, expected: "~1 hr 1 min" },
  { input: 180, expected: "~3 hr" },
  { input: 0, expected: null },
  { input: -5, expected: null },
  { input: null, expected: null },
  { input: undefined, expected: null },
  { input: "invalid", expected: null }
];

let passed = 0;
let failed = 0;

for (const { input, expected } of cases) {
  const result = formatEstimatedTravelTime(input);
  try {
    assert.equal(result, expected, `Input: ${input} expected "${expected}", got "${result}"`);
    console.log(`✓ [PASS] Input ${input} -> "${result}"`);
    passed++;
  } catch (err) {
    console.error(`✗ [FAIL] Input ${input}:`, err.message);
    failed++;
  }
}

console.log(`\nTravel Formatter Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
