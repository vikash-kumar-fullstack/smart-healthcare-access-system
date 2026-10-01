# Concern #2: Research-Grade Smart Healthcare Navigation & Progressive Discovery System

**Document Version:** 1.0  
**Target Subsystem:** Healthcare Discovery, Query Understanding, Resource Allocation (FA-HRA), and Progressive Disclosure  
**Status:** Implemented & Verified (Isolated on branch `research/concern-2-smart-navigation`)

---

## 1. Problem Statement
Traditional healthcare discovery systems operate as naive keyword or CRUD lookup systems:
$$\text{Query} \longrightarrow \text{Direct Doctor Search} \longrightarrow \text{Book Appointment}$$

This approach suffers from fundamental operational and clinical pitfalls:
1. Patients search by lay symptoms (e.g., "headache", "fever & cough", "chest pain"), not technical department nomenclatures.
2. Incompatible specialists are surfaced based purely on keyword substrings.
3. Ordinary CRUD listings display static, unverified, or fabricated metrics (such as fake ratings, fake wait times, or fake "recently updated" badges).
4. Information overload forces patients to parse dense medical metadata before establishing basic comparative suitability.
5. The system risks false medical diagnosis if symptom searches are presented as diagnostic affirmations.

---

## 2. Existing Limitations (Pre-Implementation Audit)
During the initial repository audit, multiple structural deficiencies were identified:
- **Silently Mapping Unknown Queries to General Medicine**: Unrecognized strings (`unknownabc`) triggered an unprincipled fallback in `symptom.service.js` line 248, defaulting to `General Medicine` and misleading patients.
- **Missing Direct Entity Disambiguation**: Queries for doctors ("Dr. Patel"), hospitals ("AIIMS"), or clinical departments ("Neurology") were routed through symptom dictionaries rather than dedicated entity classifiers.
- **Fabricated/Static Telemetry Assumptions**: If telemetry timestamps were missing, systems defaulted to displaying "Recently updated", compromising research validity.
- **Drawer Layout vs. True Progressive Disclosure**: Details were displayed inside a narrow, cramped right-side drawer that clashed with navigation layouts.
- **Dead Alternative Links**: Alternative specialists shown in detail views were non-interactive static `div` containers that could not be clicked to inspect alternative healthcare options.
- **Omitted Distance Signals**: When browser coordinates were not shared, distance was silently omitted rather than transparently indicating location status and providing an explicit "Use my location" trigger.

---

## 3. Research Motivation
MediHospi's navigation architecture introduces **Freshness-Aware Healthcare Resource Allocation (FA-HRA)** combined with **Progressive Healthcare Discovery**:
$$\text{Query Understanding} \longrightarrow \text{Care Pathway} \longrightarrow \text{Eligibility Filter} \longrightarrow \text{FA-HRA Ranking} \longrightarrow \text{Level 1 Comparison} \longrightarrow \text{Level 2 Modal}$$

The objective is to establish an **auditable decision-support and access mechanism** that balances waiting times, geographical proximity, clinic workload, and operational data freshness without performing automated medical diagnosis.

---

## 4. Query Understanding Model
*(Status: **IMPLEMENTED**)*

Implemented in `backend/src/modules/search/query_understanding.service.js`.

The service classifies input queries into distinct deterministic categories:
- `symptom`: Single symptom matching known clinical dictionaries (exact, alias, or fuzzy token match).
- `multi_symptom`: Normalized multi-condition queries (e.g., "fever and headache", "cough & cold").
- `specialty`: Direct medical departments (e.g., "Cardiology", "Neurology", "Dermatology", "Pediatrics").
- `doctor_name`: Natural physician queries (e.g., "Dr. Patel", "Dr. Nair").
- `hospital_name`: Medical center queries (e.g., "AIIMS", "Apollo", "Fortis", "Max Hospital").
- `unknown`: Low-confidence queries that cannot be mapped.

### Confidence Thresholds
- **HIGH CONFIDENCE ($\ge 0.85$)**: Exact name matches, confirmed aliases, validated doctor names, or known hospitals. Surfaces recommended options and specific care pathways.
- **MEDIUM CONFIDENCE ($0.60 - 0.84$)**: Levenshtein spelling corrections ($\le 2$ edit distance) or partial phrase tokens. Surfaces candidate specialties with an explicit uncertainty disclosure banner:
  > *"Mapped likely care pathway for [Condition] with moderate confidence."*
- **LOW CONFIDENCE ($< 0.60$)**: Unrecognized queries (e.g., `unknownabc`).
  - **Zero Fabrication Rule**: Does **NOT** fallback to General Medicine.
  - Returns `mode: "unknown_query"`, `results: []`.
  - Displays safe structured options (Search by specialty, doctor, hospital, or browse clinic departments).

### Acute Emergency Red Flags
Explicit reviewable rules detect life-threatening indicators (e.g., `chest pain`, `difficulty breathing`, `shortness of breath`, `stroke`, `unconscious`, `severe bleeding`). Surfaces an immediate, high-priority emergency banner directing the patient to emergency facilities or national ambulance lines (108/112).

---

## 5. Specialty Mapping Model
*(Status: **IMPLEMENTED**)*

Maintains controlled clinical pathways distinguishing:
- **Primary Starting Specialties**: Direct clinical departments indicated for initial assessment.
- **Related Specialist Options**: Cross-departmental referrals (e.g., `Neurology` $\to$ Related: `General Medicine`, `Psychiatry`; `Orthopedics` $\to$ Related: `Physical Therapy`, `General Medicine`).
- **Non-Diagnostic Framing**: All UI outputs communicate *"Relevant Starting Specialties"* rather than disease diagnosis.

---

## 6. Smart Candidate Filtering (Hard Constraints)
*(Status: **IMPLEMENTED**)*

Before any mathematical ranking is computed, candidates pass through strict operational gates:
1. **Clinical Specialization Compatibility**: Candidate doctor must match the mapped care pathway.
2. **Physician Account Verification**: `status: { $in: ["active", "verified", "approved"] }`, `profileCompleted: { $ne: false }`.
3. **Hospital Operating Status**: Affiliated hospital must have `isActive: true`.
4. **Shift & Clinic Schedule**: Walk-in availability is determined by real-time queue sessions and calendar shift tables.

---

## 7. Distance Calculation
*(Status: **CALCULATED & DERIVED**)*

Geographic distance is computed using the **Haversine spherical formula**:
$$d = 2 R \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos\phi_1 \cos\phi_2 \sin^2\left(\frac{\Delta \lambda}{2}\right)} \right)$$
where $R = 6,371 \text{ km}$.

- When patient coordinates $(\text{lat}, \text{lng})$ are provided:
  - Distance is calculated against hospital GeoJSON `[lng, lat]`.
  - Displayed as `X.X km`.
  - Influences ranking score.
- When patient coordinates are absent:
  - `distance: null`, `locationProvided: false`.
  - UI displays: `"Distance unavailable — location not provided"` with an active `"Use my location"` trigger.
  - Zero distance fabrication.

---

## 8. Information Freshness Model
*(Status: **IMPLEMENTED**)*

Information age is derived from snapshot update timestamps:
$$A(h,t) = t - t_{\text{update}}(h)$$

Operational data freshness decays exponentially:
$$F(h,t) = e^{-\lambda \cdot A(h,t)}$$
where $\lambda = 0.002 \text{ s}^{-1}$ (representing ~5 minute half-life for walk-in clinic queue fluctuations).

### User-Facing Freshness Representation
- $A < 60\text{s}$: 🟢 **Live · Updated Xs ago**
- $A < 300\text{s}$: 🟢 **Updated Xm ago**
- $A < 900\text{s}$: 🟡 **Updated Xm ago**
- $A \ge 900\text{s}$: 🟠 **Operational data may be outdated (Updated Xm ago)**
- Missing timestamp: ⚪ **Operational timestamp unavailable** (zero fake "recent" claims).

---

## 9. Information Confidence Model
*(Status: **IMPLEMENTED**)*

Composite confidence is defined as:
$$C(h) = F(h) \times N(h) \times \text{QueryConfidence}$$

Signals are transparently disclosed:
- **Active Signals**: Specialty Match, Live Queue Telemetry, Shift Operational State, Geographic Distance (if shared).
- **Unavailable Signals**: Direct Hospital Network RTT / Packet Loss Telemetry Probe (clearly labeled as baseline).

---

## 10. Multi-Factor Healthcare Access Ranking (FA-HRA)
*(Status: **IMPLEMENTED**)*

Candidate cost score:
$$S(p,h) = w_W \hat{W}(p,h) + w_D \hat{D}(p,h) + w_L \hat{L}(h) + w_C \hat{C}(h) + w_F (1 - F(h)) + w_N (1 - N(h))$$

Where:
- $\hat{W}(p,h) = \min(1.0, \text{estWaitMinutes} / 120)$
- $\hat{D}(p,h) = \min(1.0, \text{distanceKm} / 50)$ (neutral 0.3 if coordinates unavailable)
- $\hat{L}(h) = \min(1.0, \text{currentQueue} / 30)$
- $\hat{C}(h) = \min(1.0, \text{currentQueue} / \max(10, \text{maxQueueLimit}))$
- $F(h) = e^{-\lambda A(h,t)}$
- $N(h) = 1.0$ (documented architectural baseline)

### Patient Preference Profiles
- **Balanced**: $w_W=0.25, w_D=0.20, w_L=0.20, w_C=0.15, w_F=0.10, w_N=0.10$
- **Fastest Care**: $w_W=0.45, w_D=0.10, w_L=0.20, w_C=0.15, w_F=0.05, w_N=0.05$
- **Closest Facility**: $w_W=0.15, w_D=0.45, w_L=0.15, w_C=0.15, w_F=0.05, w_N=0.05$

Selection:
$$h^* = \arg\min S(p,h)$$

---

## 11. Explainable Ranking Model
*(Status: **IMPLEMENTED**)*

Backend outputs a structured, auditable explanation object with every candidate:
```json
{
  "summary": "Recommended option based on balanced allocation criteria.",
  "factors": [
    { "factor": "specialty", "label": "Matches General Medicine", "positive": true },
    { "factor": "availability", "label": "Currently accepting walk-ins", "positive": true },
    { "factor": "waitTime", "label": "Estimated wait: ~10 min", "positive": true },
    { "factor": "distance", "label": "2.4 km away (Nearby)", "positive": true },
    { "factor": "freshness", "label": "Live operational telemetry", "positive": true }
  ],
  "scoreBreakdown": { ... },
  "signals": {
    "available": [ ... ],
    "unavailable": [ ... ]
  }
}
```
Factors are only included if verified system data supports them.

---

## 12. Progressive Disclosure UX Design
*(Status: **IMPLEMENTED**)*

### Level 1: Concise Comparison Card (`SearchResultCard.jsx`)
Exposes only essential comparative fields:
- Doctor name, primary specialty, hospital campus
- Walk-in operational status badge
- Verified waiting time (~X min)
- Distance (or explicit "Distance unavailable")
- Freshness telemetry badge
- Concisely summarized "Why this option" tags
- Primary CTAs: **[ View Details ]** and **[ Book Appointment ]**

### Level 2: Centered Healthcare Detail Modal (`HealthcareDetailView.jsx`)
Replaces the former right-side drawer with an accessible centered modal (`max-w-4xl`, `max-h-[90vh]`) featuring:
1. Recommendation Summary & Suitability Status
2. Doctor Profile (Verified Registration, Specialty, Consultation Time)
3. Hospital Campus (Address, Affiliated Departments, Booking Rules)
4. Operational Queue State (Live Queue Count, Estimated Wait, Shift Schedule)
5. Geographic Distance & Access (Haversine Distance or "Use My Location" trigger)
6. Information Freshness (Telemetry age in seconds, state, reliability notice)
7. Auditable Recommendation Explanation
8. Data Confidence & Active Signal Transparency
9. **Interactive Alternative Specialists** (Clicking any alternative immediately transitions to inspecting that doctor's research-grade detail view!)
10. Modal Actions (Close, Proceed to Booking, Keyboard ESC support)

---

## 13. Safety Boundaries & Non-Diagnostic Principles
- **No Automated Clinical Diagnoses**: Symptoms are matched to medical departments, never specific illnesses.
- **No Medication Recommendations**: Pure navigation and resource access.
- **No Uncontrolled LLM Inferences**: Query understanding is deterministic and auditable.
- **Emergency Priority**: Severe red-flag queries immediately surface emergency routing before routine clinic matching.

---

## 14. Security Controls & Audit
*(Status: **VERIFIED**)*
- **Authentication**: Level 2 detail route (`GET /api/v1/search/details/:doctorId`) requires active session token; unauthenticated calls return `401 Unauthorized`.
- **IDOR / BOLA Prevention**: ObjectIds validated with `mongoose.isValidObjectId`; nonexistent or invalid IDs return clean 404/null responses without leaking internal errors.
- **Input Sanitization**: Search queries stripped of special operators, bounded to 100 characters; pagination limits strictly clamped to $[1, 20]$.
- **Data Minimization**: Passwords, refresh tokens, user PII, and internal weight coefficients are excluded from public API projections.
- **Location Privacy**: Coordinate values are kept transient in-memory for Haversine computation; user location coordinates are never permanently persisted.

---

## 15. Performance Considerations
- Database queries use indexed fields (`Doctor.specialization`, `Hospital.location`, `Queue.doctorId`).
- Avoids N+1 queries: availability snapshots are fetched in batches using `$in: [doctorIds]`.
- Frontend bundle builds cleanly via Vite in 1.33s.

---

## 16. Verification & Automated Test Matrix
Total Test Cases Executed: **23 Automated Unit/Algorithm Tests** + **22 Concern #1 Regression Tests** + **7 HTTP & Security Tests**.

| # | Test Scenario | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Query `fever` | High confidence $\to$ General Medicine | Mapped to General Medicine | **PASS** |
| 2 | Query `headache` | High confidence $\to$ Neurology & General Medicine | Mapped to Neurology & Gen Med | **PASS** |
| 3 | Query `skin rash` | High confidence $\to$ Dermatology | Mapped to Dermatology | **PASS** |
| 4 | Query `joint pain` | High confidence $\to$ Orthopedics | Mapped to Orthopedics | **PASS** |
| 5 | Query `chest pain` | Emergency red flag triggered | Red flag triggered with alert message | **PASS** |
| 6 | Query `neurology` | Direct specialty recognized | QueryType: specialty | **PASS** |
| 7 | Query `dermatology` | Direct specialty recognized | QueryType: specialty | **PASS** |
| 8 | Query `Dr. Patel` | Doctor name recognized | QueryType: doctor_name | **PASS** |
| 9 | Query `AIIMS` | Hospital name recognized | QueryType: hospital_name | **PASS** |
| 10 | Query `unknownabc` | Low confidence unknown query (NOT General Medicine) | Mode: unknown_query, 0 results | **PASS** |
| 11 | Empty query `""` | Safe fallback without 500 | QueryType: empty, 0 results | **PASS** |
| 12 | Query with punctuation | Normalization without error | Stripped and mapped properly | **PASS** |
| 13 | Search `unknownabc` | 0 doctors returned, safe suggestions | Mode: unknown_query, safe options | **PASS** |
| 14 | Search with location | Real Haversine distance calculated | Distance calculated, locationProvided: true | **PASS** |
| 15 | Search without location | Distance is null, no fake distance | Distance: null, locationProvided: false | **PASS** |
| 16 | Stale telemetry (>15m) | Freshness labeled 'stale' | Stale warning displayed | **PASS** |
| 17 | Null telemetry timestamp | Timestamp marked unavailable | isUnavailable: true, no fake text | **PASS** |
| 18 | Wait time monotonicity | Higher wait $\to$ higher cost score | Confirmed monotone cost penalty | **PASS** |
| 19 | Preference weighting | 'closest' prioritizes short distance | Confirmed preference profile shifts | **PASS** |
| 20 | Explainability factors | Structured explanation object | Contains factors, breakdown & signals | **PASS** |
| 21 | Detail view endpoint | 10-section structured data | Comprehensive doctor/hospital model | **PASS** |
| 22 | Alternatives interactivity | Valid alternatives with doctor IDs | Interactive doctor targets returned | **PASS** |
| 23 | Non-existent doctor ID | Returns null without exception | Handled cleanly with null | **PASS** |

---

## 17. Known Limitations
1. **Physical Network Telemetry ($N_h$)**: In production, hospital networks do not yet expose hardware RTT / packet-loss telemetry probes. Baseline $N_h = 1.0$ is maintained as an auditable architectural extension point.
2. **Transit Routing API**: Estimated transit travel time uses urban velocity heuristics (~30 km/h) rather than commercial paid routing API keys.

---

## 18. Future Research Opportunities
- **Physical Network Probing**: Integration of IoT edge probes at hospital registration desks to collect real-time LAN latency.
- **Dynamic Demand-Shifting Simulator**: Multi-agent simulation of patient routing under sudden regional epidemic surges.
- **Explainable AI Fairness Audits**: Formally verifying demographic neutrality in multi-hospital candidate allocation.
