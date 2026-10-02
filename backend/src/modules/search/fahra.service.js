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
export const DEFAULT_FRESHNESS_LAMBDA = 0.002;
export const CONFIDENCE_THRESHOLD_MIN = 0.50;

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
 * Computes network / communication data reliability
 * N_h = (1 - packet_loss_h) * availability_h * e^(-k * RTT_h)
 * 
 * If hardware telemetry probes are not collected in production,
 * baseline N_h = 1.0 is returned and labeled as baseline.
 * If simulated research telemetry parameters are supplied, they are calculated accordingly.
 */
export const calculateNetworkReliability = (options = {}) => {
  const {
    packetLoss = null,
    availability = null,
    rttMs = null,
    k = 0.005,
    isSimulated = false
  } = options;

  if (isSimulated || packetLoss !== null || rttMs !== null) {
    const pl = packetLoss !== null ? Math.max(0, Math.min(1, packetLoss)) : 0.0;
    const avail = availability !== null ? Math.max(0, Math.min(1, availability)) : 1.0;
    const rtt = rttMs !== null ? Math.max(0, rttMs) : 20.0;
    const reliability = Math.max(0.01, Math.min(1.0, (1 - pl) * avail * Math.exp(-k * rtt)));
    return {
      reliability: Math.round(reliability * 1000) / 1000,
      telemetryType: "simulated",
      packetLoss: pl,
      availability: avail,
      rttMs: rtt,
      description: `Simulated network probe: ${(pl * 100).toFixed(1)}% packet loss, ${rtt}ms RTT`
    };
  }

  return {
    reliability: 1.0,
    telemetryType: "baseline",
    packetLoss: 0,
    availability: 1.0,
    rttMs: null,
    description: "Architectural baseline (Hospital LAN telemetry probe inactive)"
  };
};

/**
 * Computes operational data freshness based on actual age and state volatility
 * F_h(t) = e^{-\lambda * V_h * A_h(t)}
 * 
 * @param {Date|number} lastUpdated - Timestamp of last snapshot computation
 * @param {number|Object} [options] - Volatility decay factor lambda OR options object
 * @returns {{ freshness: number, ageSeconds: number|null, state: 'live'|'recent'|'stale', displayText: string, isUnavailable: boolean, volatility: number, isVolatilityMeasured: boolean }}
 */
export const calculateFreshness = (lastUpdated, options = {}) => {
  let lambda = DEFAULT_FRESHNESS_LAMBDA;
  let volatility = 1.0;
  let isVolatilityMeasured = false;

  if (typeof options === "number") {
    lambda = options;
  } else if (options && typeof options === "object") {
    if (options.lambda !== undefined) lambda = options.lambda;
    if (options.volatility !== undefined) volatility = options.volatility;
    if (options.isVolatilityMeasured !== undefined) isVolatilityMeasured = options.isVolatilityMeasured;
  }

  if (!lastUpdated) {
    return {
      freshness: 0.3,
      ageSeconds: null,
      state: "stale",
      displayText: "Update time unavailable",
      isUnavailable: true,
      patientStatus: "unavailable",
      patientLabel: "Update time unavailable",
      patientDetailExplanation: "Update time is not available for this facility. Please contact the clinic directly to confirm availability.",
      volatility,
      isVolatilityMeasured
    };
  }

  const updateTime = new Date(lastUpdated).getTime();
  if (isNaN(updateTime) || updateTime <= 0) {
    return {
      freshness: 0.3,
      ageSeconds: null,
      state: "stale",
      displayText: "Update time unavailable",
      isUnavailable: true,
      patientStatus: "unavailable",
      patientLabel: "Update time unavailable",
      patientDetailExplanation: "Update time is not available for this facility. Please contact the clinic directly to confirm availability.",
      volatility,
      isVolatilityMeasured
    };
  }

  const now = Date.now();
  const ageMs = Math.max(0, now - updateTime);
  const ageSeconds = Math.round(ageMs / 1000);

  // Candidate Freshness model: F_h(t) = e^(-lambda * V_h * A_h(t))
  const exponent = -lambda * volatility * ageSeconds;
  const freshness = Math.max(0.01, Math.min(1.0, Math.exp(exponent)));

  let state = "live";
  let displayText = "";
  let patientStatus = "fresh";
  let patientLabel = "";
  let patientDetailExplanation = "";
  const mins = Math.floor(ageSeconds / 60);

  if (ageSeconds < 60) {
    state = "live";
    displayText = "Updated just now";
    patientStatus = "fresh";
    patientLabel = "Updated just now";
    patientDetailExplanation = "Hospital information was updated just now. Availability and queue state are current.";
  } else if (ageSeconds < 300) {
    state = "live";
    displayText = `Updated ${mins}m ago`;
    patientStatus = "fresh";
    patientLabel = `Updated ${mins} min ago`;
    patientDetailExplanation = `Hospital information was updated ${mins} minute${mins === 1 ? "" : "s"} ago. Availability is current.`;
  } else if (ageSeconds < 900) {
    state = "recent";
    displayText = `Updated ${mins}m ago`;
    patientStatus = "recent";
    patientLabel = `Updated ${mins} min ago`;
    patientDetailExplanation = `Hospital information was updated ${mins} minutes ago. Queue and availability are reasonably current.`;
  } else if (ageSeconds < 1800) {
    state = "stale";
    displayText = `Information may be outdated (Updated ${mins}m ago)`;
    patientStatus = "aging";
    patientLabel = `Updated ${mins} min ago — may have changed`;
    patientDetailExplanation = `Hospital information was updated ${mins} minutes ago. Queue length and availability may have changed.`;
  } else {
    state = "stale";
    displayText = `Information may be outdated (Updated ${mins}m ago)`;
    patientStatus = "stale";
    patientLabel = "Information may be outdated";
    patientDetailExplanation = "This information has not been updated recently. Please verify availability before visiting.";
  }

  return {
    freshness: Math.round(freshness * 1000) / 1000,
    ageSeconds,
    state,
    displayText,
    patientStatus,
    patientLabel,
    patientDetailExplanation,
    isUnavailable: false,
    volatility,
    isVolatilityMeasured
  };
};

/**
 * Calculates FA-HRA candidate allocation score with Confidence C_h(t) = F_h(t) * N_h(t)
 * 
 * @param {Object} params
 * @param {number} params.estimatedWaitMinutes - Estimated waiting time
 * @param {number|null} params.distanceKm - Distance to hospital (or null if location disabled)
 * @param {number} params.currentQueue - Active waiting queue count
 * @param {number} [params.maxQueueLimit=50] - Capacity limit
 * @param {Date|number} params.lastComputedAt - Telemetry freshness timestamp
 * @param {number} [params.volatility=1.0] - State volatility V_h
 * @param {boolean} [params.isVolatilityMeasured=false] - Whether V_h is from DB logs
 * @param {Object} [params.networkOptions] - Network reliability simulation options
 * @param {string} [params.preference='balanced'] - 'balanced' | 'fastest' | 'closest'
 * @returns {Object} FA-HRA evaluation with normalized metrics, confidence, and candidate score
 */
export const computeFahraScore = ({
  estimatedWaitMinutes = 0,
  distanceKm = null,
  currentQueue = 0,
  maxQueueLimit = 50,
  lastComputedAt = null,
  volatility = 1.0,
  isVolatilityMeasured = false,
  networkOptions = {},
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

  // 5. Freshness F_h(t) = e^{-\lambda * V_h * A_h(t)}
  const freshnessData = calculateFreshness(lastComputedAt, { volatility, isVolatilityMeasured });
  const freshness = freshnessData.freshness;

  // 6. Network Reliability N_h
  const networkData = calculateNetworkReliability(networkOptions);
  const networkReliability = networkData.reliability;

  // 7. Overall Operational Confidence C_h(t) = F_h(t) * N_h(t)
  const confidenceScore = Math.round(freshness * networkReliability * 1000) / 1000;
  const isUncertain = confidenceScore < CONFIDENCE_THRESHOLD_MIN;
  const confidenceState = isUncertain ? "low_confidence" : "reliable";
  const confidenceMessage = isUncertain
    ? `Operational telemetry confidence (${confidenceScore}) below threshold (C_min = ${CONFIDENCE_THRESHOLD_MIN}). Operational state is uncertain.`
    : `Operational telemetry within acceptable confidence threshold (C_h = ${confidenceScore}).`;

  // Candidate Cost Score S(p,h) (lower = better)
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
    network: networkData,
    confidence: {
      score: confidenceScore,
      threshold: CONFIDENCE_THRESHOLD_MIN,
      isUncertain,
      state: confidenceState,
      message: confidenceMessage
    },
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
