/**
 * Freshness-Aware Healthcare Resource Allocation (FA-HRA) Service
 * 
 * Research Model Reference:
 * Candidate Cost Score:
 *   S_{p,h} = w_W * \hat{W}_{p,h} + w_D * \hat{D}_{p,h} + w_L * \hat{L}_h + w_C * \hat{C}_h + w_F * (1 - F_h) + w_N * (1 - N_h)
 * 
 * Where:
 *   - \hat{W}_{p,h}: Normalized estimated waiting time in [0, 1]
 *   - \hat{D}_{p,h}: Normalized distance in [0, 1]
 *   - \hat{L}_h: Normalized current clinic queue workload in [0, 1]
 *   - \hat{C}_h: Capacity saturation ratio in [0, 1]
 *   - F_h(t): Information freshness F_h(t) = e^{-\lambda * A_h(t)}, A_h(t) = age in seconds
 *   - N_h: Network reliability. In production, packet-loss/RTT telemetry is not collected from hospitals;
 *          we preserve an architectural extension point with baseline N_h = 1.0.
 * 
 * Lower S_{p,h} represents a more optimal operational candidate.
 * For user-facing display, we convert this into a 0-100 operational suitability score: (1 - S_{p,h}) * 100.
 */

// Decay constant for freshness calculation (lambda = 0.002 implies ~5 min half-life for queue volatility)
const DEFAULT_FRESHNESS_LAMBDA = 0.002;

// Preference weight profiles for patient-driven prioritization
export const PREFERENCE_WEIGHTS = {
  balanced: {
    wW: 0.25, // Waiting time
    wD: 0.20, // Distance
    wL: 0.20, // Workload
    wC: 0.15, // Capacity pressure
    wF: 0.10, // Freshness
    wN: 0.10  // Network reliability baseline
  },
  fastest: {
    wW: 0.45,
    wD: 0.10,
    wL: 0.20,
    wC: 0.15,
    wF: 0.05,
    wN: 0.05
  },
  closest: {
    wW: 0.15,
    wD: 0.45,
    wL: 0.15,
    wC: 0.15,
    wF: 0.05,
    wN: 0.05
  }
};

/**
 * Computes information freshness based on actual age in milliseconds
 * F_h(t) = e^{-\lambda * A_h(t)}
 * @param {Date|number} lastUpdated - Timestamp of last snapshot computation
 * @param {number} [lambda=0.002] - Volatility decay factor
 * @returns {{ freshness: number, ageSeconds: number, state: 'live'|'recent'|'stale', displayText: string }}
 */
export const calculateFreshness = (lastUpdated, lambda = DEFAULT_FRESHNESS_LAMBDA) => {
  if (!lastUpdated) {
    return {
      freshness: 0.5,
      ageSeconds: 300,
      state: "recent",
      displayText: "Telemetry recently updated"
    };
  }

  const updateTime = new Date(lastUpdated).getTime();
  const now = Date.now();
  const ageMs = Math.max(0, now - updateTime);
  const ageSeconds = Math.round(ageMs / 1000);

  // Exponential decay
  const freshness = Math.max(0.01, Math.min(1.0, Math.exp(-lambda * ageSeconds)));

  let state = "live";
  let displayText = "";

  if (ageSeconds < 60) {
    state = "live";
    displayText = `Live · Updated ${ageSeconds}s ago`;
  } else if (ageSeconds < 300) {
    state = "recent";
    const mins = Math.floor(ageSeconds / 60);
    displayText = `Recently updated · ${mins}m ago`;
  } else {
    state = "stale";
    displayText = "Updated earlier today";
  }

  return {
    freshness,
    ageSeconds,
    state,
    displayText
  };
};

/**
 * Calculates FA-HRA candidate allocation score
 * 
 * @param {Object} params
 * @param {number} params.estimatedWaitMinutes - Estimated waiting time
 * @param {number|null} params.distanceKm - Distance to hospital (or null if location disabled)
 * @param {number} params.currentQueue - Active waiting queue count
 * @param {number} [params.maxQueueLimit=50] - Capacity limit
 * @param {Date|number} params.lastComputedAt - Telemetry freshness timestamp
 * @param {string} [params.preference='balanced'] - 'balanced' | 'fastest' | 'closest'
 * @returns {Object} FA-HRA evaluation with normalized metrics and candidate score
 */
export const computeFahraScore = ({
  estimatedWaitMinutes = 0,
  distanceKm = null,
  currentQueue = 0,
  maxQueueLimit = 50,
  lastComputedAt = null,
  preference = "balanced"
}) => {
  const weights = PREFERENCE_WEIGHTS[preference] || PREFERENCE_WEIGHTS.balanced;

  // 1. Normalized Waiting Time \hat{W} (clamp at 120 minutes)
  const normWait = Math.min(1.0, Math.max(0, estimatedWaitMinutes / 120));

  // 2. Normalized Distance \hat{D} (clamp at 50 km; default 0.3 if distance not provided)
  let normDist = 0.3;
  if (distanceKm !== null && distanceKm !== undefined) {
    normDist = Math.min(1.0, Math.max(0, distanceKm / 50));
  }

  // 3. Normalized Workload \hat{L} (current queue ratio to nominal capacity of 30)
  const normWorkload = Math.min(1.0, Math.max(0, currentQueue / 30));

  // 4. Capacity Pressure \hat{C} (queue relative to maxQueueLimit)
  const effectiveMax = Math.max(10, maxQueueLimit);
  const normCapacity = Math.min(1.0, Math.max(0, currentQueue / effectiveMax));

  // 5. Freshness F_h
  const freshnessData = calculateFreshness(lastComputedAt);
  const freshness = freshnessData.freshness;

  // 6. Network Reliability Extension Point N_h
  // In current production telemetry, packet loss and RTT are not collected.
  // We document this limitation and preserve an architectural baseline N_h = 1.0.
  const networkReliability = 1.0;

  // Candidate Cost Score (lower = better)
  const costScore =
    weights.wW * normWait +
    weights.wD * normDist +
    weights.wL * normWorkload +
    weights.wC * normCapacity +
    weights.wF * (1.0 - freshness) +
    weights.wN * (1.0 - networkReliability);

  // Convert to operational suitability score (0-100, higher = better)
  const suitabilityScore = Math.round(Math.max(0, Math.min(100, (1.0 - costScore) * 100)));

  return {
    costScore,
    suitabilityScore,
    freshness: freshnessData,
    metrics: {
      normalizedWait: normWait,
      normalizedDistance: normDist,
      normalizedWorkload: normWorkload,
      normalizedCapacity: normCapacity,
      freshnessValue: freshness,
      networkReliability
    },
    preferenceUsed: preference
  };
};
