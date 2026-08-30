# Staged Build Reference — SIH PS 26143
## Satellite-Based Oil Spill Detection, Drift Modelling & AIS-Correlated Vessel Attribution

This document is the execution companion to the locked project scope document (v4). The scope document defines *what the system is and what tier each feature sits in*. This document takes that locked scope and decomposes it into discrete, self-contained build stages, ordered by dependency, so that any one stage can be opened in isolation and understood completely — what it is, why it exists, what it consumes, what it emits, what "finished" means for it, and what is most likely to go quietly wrong inside it.

Nothing here re-opens, re-tiers, or re-scopes anything in the scope document. Where this document appears to add something, it is making an existing implicit requirement explicit — for example, the interface-contract freeze named in the scope document's Risk Register is promoted here into a first-class stage, because every other stage depends on it. Where the scope document is silent on a tier, this document says so plainly rather than inventing one.

---

## 0. Conventions used throughout this document

### 0.1 Ordering is dependency order, not schedule order

Stages are numbered in **dependency order**: the order in which things must conceptually exist, not the order in which anyone works on them, and not a calendar. A stage's number means only that everything it depends on carries a lower number. Several stages that sit adjacent in this document have no relationship to each other at all and could be built in either order, or at the same time; where that is true, the Dependencies field says so explicitly.

**This ordering deliberately departs from the scope document's A–E lettering, and the departure is load-bearing.** The scope document labels Source-Type Triage as Stage B and Drift Modelling as Stage C, but Section 6 of that document specifies that triage works by checking *the hindcasted origin point* against known platform and pipeline locations. The hindcast is produced by Stage C. Triage therefore cannot be built, and certainly cannot be tested, until backward drift modelling already produces an origin estimate. In this document, drift modelling is decomposed and presented before source-type triage, and triage's dependency on it is stated in full. The A–E letters are retained as cross-references throughout so the mapping back to the scope document is never ambiguous, but the letters are not the build order.

The true dependency spine of the system is:

```
Foundational contracts and data
        |
        v
Detection & Characterization   (scope Stage A)
        |
        v
Drift Modelling - backward     (scope Stage C, hindcast half)
        |
        v
Source-Type Triage             (scope Stage B) --> non-vessel outcomes route straight to reporting
        |
        |  (only on a vessel hypothesis)
        v
AIS Correlation & Attribution  (scope Stage D)
        |
        v
Reporting                      (scope Stage E)
        |
        v
Presentation Layer             (scope Frontend)
```

Forward drift forecasting — the other half of scope Stage C — sits outside this spine. It consumes the detection record and forcing data, and it feeds reporting and the presentation layer, but nothing in triage or attribution waits on it. That is why the forward and backward halves of the same simulation engine appear as separate stages here despite sharing one codebase: they have genuinely different dependents.

### 0.2 Tier labels

Tier labels are reproduced **exactly** as the scope document assigns them — `[MVP]`, `[WORTH ADDING]`, `[STRETCH]` — and are treated strictly as priority and necessity labels describing how essential a capability is to the system, never as scheduling markers. A stage tagged `[STRETCH]` is not "later"; it is "genuinely optional, and first to be cut under pressure."

Some stages in this document correspond to work the scope document requires but never tags with a tier: the interface-contract freeze (scope Section 12), the detection and attribution evaluation harnesses (scope Sections 11.1 and 11.2), and the REST service layer (scope Section 10.4). For those, the Tier field reads **"Untagged in source"** together with the sentence from the scope document that establishes the obligation. This document does not assign them a tier, because re-tiering is explicitly outside its remit; if the team wants them tiered, that is an amendment to the scope document, not to this one.

A few stages carry a **mixed tier** — an `[MVP]` core with a `[WORTH ADDING]` or `[STRETCH]` extension named in the same scope-document bullet list. Where the extension is substantial enough to be its own unit of work, it has been split into its own stage. Where it is a single configuration change on top of machinery that already exists, it is noted inside the stage and the Tier field lists both labels with the boundary between them stated exactly.

Note also the scope document's standing default rule, which applies to anything encountered during building that this document does not cover: if the tier of something is unclear, **it defaults to `[STRETCH]` until explicitly reclassified.**

### 0.3 Canonical vocabulary

The largest failure mode for a document of this length is one object acquiring three different names in three different places. The largest failure mode for a system built by several people working in parallel is one object acquiring three different *shapes*. The terms below are defined once, here, and every stage uses them in exactly this sense. If a stage appears to use one of these terms differently, that is a defect in this document — flag it rather than guessing which usage was meant.

| Term | Meaning in this project |
| --- | --- |
| **case** | One curated, pre-verified demo scenario: a specific SAR scene over a specific region at a specific time, together with everything needed to run the full pipeline over it. The scope document (Section 10.1) requires 2–3 of these, at least one of which must be a real documented historical spill. |
| **scene** | A single SAR satellite acquisition — the image raster plus its acquisition timestamp and its geographic footprint. One case has one scene. |
| **detection mask** | The raster output of the segmentation model: one of five class labels per pixel — `oil-spill`, `look-alike`, `land`, `ship`, `sea surface`. |
| **spill polygon** | The vectorized geographic boundary of the detected oil-spill region, in WGS84 (EPSG:4326) longitude/latitude, expressed as GeoJSON. This is the most widely shared object in the system and its exact schema is frozen in Stage 1. |
| **look-alike confidence** | An **indicative, uncalibrated** score expressing how strongly a detection is a genuine oil spill rather than a look-alike (biogenic slick, low-wind zone, rain cell). Derived from the segmentation model's own class probabilities. Never stated as a precise statistical percentage — see Stage 8. |
| **geometric property set** | Area, perimeter, elongation/aspect ratio, centroid, and distance-to-nearest-coastline for the spill polygon. |
| **detection record** | The complete frozen output object of scope Stage A: spill polygon, geometric property set, look-alike confidence, detection timestamp, and scene identity. Everything downstream consumes this object, not the raw imagery. |
| **forcing data** (or **forcing fields**) | Gridded ocean surface current and wind fields covering a case's region and time window, used to drive drift simulation. |
| **hindcast** | A drift simulation run *backward* in time from the detected spill, to estimate where the oil was earlier — that is, where it came from. The word means a backward-looking simulation, as opposed to a forecast, which looks forward. |
| **origin estimate** | The complete output object of the hindcast: an estimated origin point (longitude/latitude), an estimated origin time window, and an associated spatial tolerance. |
| **origin window** | The space-time extent of the origin estimate — a bounded geographic area paired with a bounded time interval. This is the object that AIS tracks are filtered against, and the object that triage tests against fixed infrastructure. |
| **forecast track** | The forward-in-time drift prediction: the spill's predicted position and extent at successive future times. |
| **origin probability field** | The `[WORTH ADDING]` ensemble product: instead of a single origin point, a spatial probability distribution over possible origins, aggregated from many perturbed simulations. Rendered visually as a **probability cone**. Both terms name the same object — "field" for the data structure, "cone" for its visual form. |
| **source hypothesis** | The output of scope Stage B: a label drawn from exactly `{likely-vessel, likely-platform, likely-pipeline, possible-natural-seep, insufficient-evidence}`, with an associated confidence and the evidence that produced it. |
| **AIS track** | The time-ordered sequence of position reports transmitted by one vessel, keyed by its vessel identifier. AIS is the Automatic Identification System — the transponder-based position-broadcast system ships use. |
| **candidate vessel** | An AIS track that survived space-time filtering against the origin window and is therefore eligible for scoring. |
| **feature score** | One named, individually visible component of the evidence concerning a candidate vessel — proximity, trajectory alignment, dark-gap, behavioral anomaly, track integrity, historical base rate. Each is computed independently and each remains separately inspectable all the way through to the dossier. |
| **suspicion score** | The single transparent weighted combination of feature scores, per candidate vessel. Never a black-box output: the contributing feature scores travel with it everywhere it goes. |
| **confidence tier** | A coarse `High` / `Medium` / `Low` banding of a suspicion score, introduced in Stage 36 and consumed by both the dossier and the map. |
| **suspect list** | The ranked list of candidate vessels with their suspicion scores and full feature-score breakdowns. The output object of scope Stage D. |
| **dossier** | The auto-generated investigator's report — the output of scope Stage E — compiling the detection record, source hypothesis, origin estimate, forecast track, and suspect list into one structured document. |
| **positioning statement** | The verbatim decision-support disclaimer from scope Section 2: this system produces investigative leads for human review, not automated legal determinations. Required verbatim in every dossier. |
| **case artifact** | The serialized, precomputed result of running the full pipeline over one case, stored so that the demo never depends on live computation. |
| **interface contract** | The frozen, written specification of coordinate system, timestamp format, spill-polygon schema, and every inter-stage payload shape. Defined in Stage 1. |

### 0.4 The four differentiators, and why they keep reappearing

The scope document's Positioning & Novelty section is explicit that segmentation accuracy is not this project's contribution — published models already reach high accuracy on the same public datasets. The contribution is four specific properties of the *integrated* system:

1. **Uncertainty-awareness** — the system reports a distribution over possible origins rather than a confident point, and reports detection confidence as indicative rather than as truth.
2. **Explainable attribution** — every vessel's score decomposes into named, individually visible evidence components, never a single opaque number.
3. **Multi-hypothesis source triage** — the system considers stationary sources (platforms, pipelines, natural seeps) before it considers ships, so an innocent passing vessel is not force-fitted as the culprit.
4. **Narrative UI** — the investigation is communicated as a guided sequence that walks a user through the reasoning, not as a static dashboard of panels.

These four are the reason this project is not "another segmentation paper." Each stage below states which of the four it serves, or which of the four it exists to keep honest. If a stage cannot be connected to at least one of them, that is worth questioning.

---
## Table of Contents

**[Part I — Foundational Contracts](#part-i--foundational-contracts)**
*Everything that must be agreed, fixed, or fetched before any modelling code can be written against it.*

- [Stage 1 — Interface Contract Freeze](#stage-1--interface-contract-freeze) · *Untagged in source*
- [Stage 2 — Demo Case Curation & Ground-Truth Anchor Selection](#stage-2--demo-case-curation--ground-truth-anchor-selection) · *[MVP]*
- [Stage 3 — SAR Corpus Acquisition & Preprocessing](#stage-3--sar-corpus-acquisition--preprocessing) · *[MVP]*
- [Stage 4 — Forcing-Data Acquisition & Regional Caching](#stage-4--forcing-data-acquisition--regional-caching) · *[MVP]*
- [Stage 5 — Static Geospatial Reference Layer](#stage-5--static-geospatial-reference-layer) · *[MVP] with [STRETCH] extension*

**[Part II — Detection Pipeline (scope Stage A)](#part-ii--detection-pipeline-scope-stage-a)**
*Turning a SAR image into a trustworthy, characterized, confidence-annotated spill polygon.*

- [Stage 6 — Multi-Class SAR Segmentation Model](#stage-6--multi-class-sar-segmentation-model) · *[MVP]*
- [Stage 7 — Inference & Mask-to-Polygon Vectorization](#stage-7--inference--mask-to-polygon-vectorization) · *[MVP]*
- [Stage 8 — Look-Alike Confidence Extraction & Propagation](#stage-8--look-alike-confidence-extraction--propagation) · *[MVP]*
- [Stage 9 — Geometric Property Extraction](#stage-9--geometric-property-extraction) · *[MVP]*
- [Stage 10 — Detection Evaluation Harness](#stage-10--detection-evaluation-harness) · *Untagged in source*
- [Stage 11 — Historical Benchmark Validation of the Detector](#stage-11--historical-benchmark-validation-of-the-detector) · *[WORTH ADDING]*
- [Stage 12 — Indicative Age Estimation](#stage-12--indicative-age-estimation) · *[STRETCH]*

**[Part III — Drift Modelling (scope Stage C)](#part-iii--drift-modelling-scope-stage-c)**
*The physics engine, run backward to find where the oil came from and forward to find where it is going — and the uncertainty layer that keeps both honest.*

- [Stage 13 — Drift Engine Integration](#stage-13--drift-engine-integration) · *[MVP]*
- [Stage 14 — Backward Hindcast & Origin Estimate](#stage-14--backward-hindcast--origin-estimate) · *[MVP]*
- [Stage 15 — Forward Forecast & Predicted Spread](#stage-15--forward-forecast--predicted-spread) · *[MVP]*
- [Stage 16 — Landfall & Sensitive-Zone Timing Metric](#stage-16--landfall--sensitive-zone-timing-metric) · *[MVP]*
- [Stage 17 — Weathering-Enabled Forward Forecast](#stage-17--weathering-enabled-forward-forecast) · *[WORTH ADDING]*
- [Stage 18 — Perturbed Ensemble Execution](#stage-18--perturbed-ensemble-execution) · *[WORTH ADDING]*
- [Stage 19 — Origin Probability Field & Cone Aggregation](#stage-19--origin-probability-field--cone-aggregation) · *[WORTH ADDING]*
- [Stage 20 — Hand-Rolled Advection Cross-Check](#stage-20--hand-rolled-advection-cross-check) · *[STRETCH]*
- [Stage 21 — Drift Accuracy Evaluation Against the Ground-Truth Anchor](#stage-21--drift-accuracy-evaluation-against-the-ground-truth-anchor) · *[MVP, required]*

**[Part IV — Source-Type Triage (scope Stage B)](#part-iv--source-type-triage-scope-stage-b)**
*Asking what kind of thing spilled the oil before assuming it was a ship.*

- [Stage 22 — Origin Proximity Testing Against Fixed Infrastructure](#stage-22--origin-proximity-testing-against-fixed-infrastructure) · *[MVP]*
- [Stage 23 — Source Hypothesis Labelling & the Routing Gate](#stage-23--source-hypothesis-labelling--the-routing-gate) · *[MVP]*
- [Stage 24 — Natural Seep Zone Check](#stage-24--natural-seep-zone-check) · *[STRETCH]*
- [Stage 25 — Repeated-Origin Pattern Detection](#stage-25--repeated-origin-pattern-detection) · *[STRETCH]*

**[Part V — Source Attribution Logic (scope Stage D)](#part-v--source-attribution-logic-scope-stage-d)**
*Building the evidence base, the individual feature scores, and the transparent scoring engine that ranks candidate vessels.*

- [Stage 26 — AIS Schema Study & Canonical Track Representation](#stage-26--ais-schema-study--canonical-track-representation) · *[MVP]*
- [Stage 27 — Synthetic AIS Scenario Generator](#stage-27--synthetic-ais-scenario-generator) · *[MVP]*
- [Stage 28 — Space-Time Candidate Filtering](#stage-28--space-time-candidate-filtering) · *[MVP]*
- [Stage 29 — Proximity Feature Score](#stage-29--proximity-feature-score) · *[MVP]*
- [Stage 30 — Trajectory Alignment Feature Score](#stage-30--trajectory-alignment-feature-score) · *[MVP]*
- [Stage 31 — Baseline Weighted Scorer & Ranked Suspect List](#stage-31--baseline-weighted-scorer--ranked-suspect-list) · *[MVP]*
- [Stage 32 — Track Integrity Layer & Implausible-Track Injection](#stage-32--track-integrity-layer--implausible-track-injection) · *[WORTH ADDING]*
- [Stage 33 — Dark-Gap Feature & Dead-Reckoning Interpolation](#stage-33--dark-gap-feature--dead-reckoning-interpolation) · *[WORTH ADDING]*
- [Stage 34 — Behavioral Fingerprinting & Self-Anomaly Score](#stage-34--behavioral-fingerprinting--self-anomaly-score) · *[WORTH ADDING]*
- [Stage 35 — Historical Base-Rate Prior](#stage-35--historical-base-rate-prior) · *[STRETCH]*
- [Stage 36 — Extended Scorer, Confidence Tiers & Evidence Breakdown](#stage-36--extended-scorer-confidence-tiers--evidence-breakdown) · *[WORTH ADDING]*
- [Stage 37 — Attribution Evaluation Harness](#stage-37--attribution-evaluation-harness) · *Untagged in source*

**[Part VI — Integration & Service Layer](#part-vi--integration--service-layer)**
*The seam where five independently built stages become one callable system.*

- [Stage 38 — REST API Surface](#stage-38--rest-api-surface) · *Untagged in source*
- [Stage 39 — End-to-End Orchestration & the Case Artifact Store](#stage-39--end-to-end-orchestration--the-case-artifact-store) · *Untagged in source*

**[Part VII — Reporting (scope Stage E)](#part-vii--reporting-scope-stage-e)**
*Compiling everything already computed into the investigator's dossier. No new modelling happens here.*

- [Stage 40 — Dossier Assembly](#stage-40--dossier-assembly) · *[MVP]*
- [Stage 41 — Full Evidence Breakdown & Alternative Hypotheses](#stage-41--full-evidence-breakdown--alternative-hypotheses) · *[WORTH ADDING]*
- [Stage 42 — Polished Dossier Export](#stage-42--polished-dossier-export) · *[WORTH ADDING]*

**[Part VIII — Presentation Layer (scope Frontend)](#part-viii--presentation-layer-scope-frontend)**
*The guided narrative interface that sequences the reveal of everything the backend already computed.*

- [Stage 43 — Map Shell, Sidebar & Wizard State Machine](#stage-43--map-shell-sidebar--wizard-state-machine) · *[MVP]*
- [Stage 44 — Curated Case Selection & Guided Camera Transition](#stage-44--curated-case-selection--guided-camera-transition) · *[MVP]*
- [Stage 45 — Detection Layer & Look-Alike Confidence Display](#stage-45--detection-layer--look-alike-confidence-display) · *[MVP]*
- [Stage 46 — Source-Hypothesis Step & UI Routing Gate](#stage-46--source-hypothesis-step--ui-routing-gate) · *[MVP]*
- [Stage 47 — AIS Candidate Vessel Layer](#stage-47--ais-candidate-vessel-layer) · *[MVP]*
- [Stage 48 — Dossier Report View](#stage-48--dossier-report-view) · *[MVP]*
- [Stage 49 — Dual-Mode Attribution / Forecast Drift View](#stage-49--dual-mode-attribution--forecast-drift-view) · *[WORTH ADDING]*
- [Stage 50 — Suspicion-Tier Visual Encoding](#stage-50--suspicion-tier-visual-encoding) · *[WORTH ADDING]*
- [Stage 51 — Arbitrary SAR Upload Path](#stage-51--arbitrary-sar-upload-path) · *[STRETCH]*
- [Stage 52 — Time-Scrubbed Ensemble Animation](#stage-52--time-scrubbed-ensemble-animation) · *[STRETCH]*

**[Part IX — Verification & Evidence](#part-ix--verification--evidence)**
*The stages that answer "how do we know this isn't just working on the one example you're showing me."*

- [Stage 53 — Consolidated Evaluation Section](#stage-53--consolidated-evaluation-section) · *Untagged in source*
- [Stage 54 — Disclosed-Limitations Ledger & Rehearsed Framing](#stage-54--disclosed-limitations-ledger--rehearsed-framing) · *Untagged in source*

**[How to read this doc](#how-to-read-this-doc)**

**[Part X — Consolidated List of Human Decision Gates](#part-x--consolidated-list-of-human-decision-gates)**

---
# Part I — Foundational Contracts

Nothing in this part produces a model, a prediction, or a pixel of user interface. Every stage here exists so that the stages after it can be built independently of one another without silently drifting apart. The scope document's Risk Register names this directly: five stages built in parallel means coordinate systems, timestamp formats, and the shape of shared objects can diverge without anyone noticing until integration, at which point the cost is measured in rebuilt code rather than in a conversation. This part is the answer to that risk. It is also where every piece of external data the system depends on gets pulled in and pinned down, because external data access is the one class of blocker that cannot be solved by working harder on it.

---

### Stage 1 — Interface Contract Freeze

This is the first stage in the system and it depends on nothing, because everything else depends on it. It exists to make the phrase "the spill polygon" mean exactly one thing across every other stage in this document.

**Tier:** Untagged in source. The scope document's Risk Register (Section 12) lists this as the mitigation for integration risk across parallel stage-owners, in the strongest terms it uses anywhere: *"Freeze interface contracts (coordinate system, timestamp format, spill-polygon schema, and all inter-stage payloads) ... Written down, not verbal."* It is not tagged with a tier because it is not a feature; it is the precondition for every `[MVP]` feature being buildable in parallel. This document does not assign it a tier.

**What this stage is.** A written specification — a schema document plus machine-checkable schema definitions — that fixes the exact shape of every object that crosses a boundary between two stages. Concretely, it must pin down at minimum:

- **Coordinate reference system.** WGS84, EPSG:4326, with longitude first and latitude second in all GeoJSON coordinate arrays, because that is what the GeoJSON specification mandates and what Mapbox GL JS expects. Any place in the system that needs a *projected* coordinate system — computing an area in square kilometres, for instance, cannot be done meaningfully in degrees — must declare which projection it uses locally and must convert back to EPSG:4326 before emitting anything. This is written down here rather than decided ad hoc inside each stage.
- **Timestamp format.** ISO 8601, UTC, with an explicit timezone designator, everywhere, with no exceptions. Satellite acquisition times, AIS position report times, drift simulation step times, and origin window boundaries are all compared against one another repeatedly throughout the system; a single component storing local time is the kind of error that produces a plausible-looking but wrong answer rather than a crash.
- **The spill polygon schema.** GeoJSON `Polygon` or `MultiPolygon` — the contract must state which, and must state what happens when a detection produces several disconnected patches of oil, because that is common and the answer determines whether downstream code loops or not.
- **The detection record, origin estimate, source hypothesis, and suspect list schemas.** Each of these is named in the canonical vocabulary in Section 0.3 and each is produced by one stage and consumed by several others. Their field names, types, units, and null-handling behaviour are fixed here.
- **Units, explicitly.** Kilometres versus metres, hours versus seconds, degrees versus radians, knots versus metres per second. Every numeric field in every schema carries a declared unit in the contract.
- **Identity.** How a case is identified, how a scene is identified, and how a vessel is identified, so that the same vessel referenced in a feature score, in the suspect list, in the dossier, and on the map is provably the same vessel.

**Why this stage exists.** The system's four differentiators all depend on objects surviving intact across stage boundaries. Explainable attribution means the individual feature scores computed in Stages 29–35 have to arrive in the dossier and on the map *still individually identifiable* — that is a schema property before it is a design property. Uncertainty-awareness means the look-alike confidence produced in Stage 8 and the origin probability field produced in Stage 19 have to survive several hops without being flattened into a bare number by an intermediate stage that did not know it was supposed to carry them. Without a frozen contract, each stage invents its own shapes, and the integration cost is paid at exactly the point in the project where there is least room to absorb it.

**Inputs.** The scope document itself, which names most of the objects that need schemas. No data and no code. This is the only stage in the system with no upstream stage.

**Outputs.** A written interface-contract document, plus schema definitions in a form the code can validate against (JSON Schema, Pydantic models, TypeScript types, or equivalent — the choice matters less than that a machine can check conformance and that frontend and backend derive from the same source). Consumed by every subsequent stage in this document, without exception.

**Dependencies.** None. This is the root of the dependency graph.

**What "done" looks like.** Every object listed in the canonical vocabulary table in Section 0.3 has a written schema with field names, types, units, and null-handling specified; a validation function exists that will accept a conforming object and reject a non-conforming one; and a round-trip test passes in which a hand-constructed example of each object is serialized, deserialized, and validated without loss. Two people reading the contract independently must produce the same JSON for the same hypothetical spill — if they do not, the contract is not finished.

**Human Decision Gate.**

- **Show a human:** the written interface contract, plus the same hypothetical spill independently hand-encoded to JSON by two people working only from it — both files, side by side.
- **The judgment:** whether the two encodings actually match, and whether any object a later stage will need is missing or still only reserved. This is a judgment about whether the contract is unambiguous to a *reader*: a schema can be internally valid and still admit two honest readings, and a validator cannot detect that.
- **Proceed if:** the two encodings agree field for field, and the fields still marked provisional are ones no stage is blocked on.
- **If not:** resolve the divergence in the contract before parallel building starts. This is the enforcement point for the Risk Register's mitigation for integration risk across parallel stage-owners — the mitigation's whole value is that the contract is agreed in advance, in writing, rather than discovered later.

**Known limitations & caveats.** The contract can only freeze what is known at the time it is written. Some fields genuinely cannot be specified until the stage that produces them exists — the exact shape of the origin probability field (Stage 19), for instance, depends on choices made about aggregation. The contract should therefore mark such fields as provisional and reserved rather than omitting them, so that adding them later is an extension rather than a breaking change.

**Where this could silently go wrong.** Coordinate order. Latitude/longitude versus longitude/latitude is the single most common geospatial bug and it does not throw an error — it produces a spill in the wrong hemisphere, or, worse, a spill a few hundred kilometres from where it should be, which still looks like a plausible ocean location on a zoomed-in map. The second-most-likely silent failure is the contract existing as a document that nobody validates against in code, at which point it degrades into a suggestion and drift resumes.

---

### Stage 2 — Demo Case Curation & Ground-Truth Anchor Selection

With the interface contract fixed, the next thing the system needs is something concrete to run on. This stage chooses the specific real-world scenarios the entire pipeline will be built, tested, and demonstrated against, and it is where the project's one quantified drift-accuracy number is secured.

**Tier:** `[MVP]`. Scope Section 10.1 requires a dropdown of 2–3 curated, pre-verified demo cases, and states that at least one must be a real, documented historical spill with a known origin location and time.

**What this stage is.** The selection and hand-verification of the 2–3 cases the system will support. A case here means a specific SAR scene over a specific region at a specific time, chosen because the full pipeline can actually be run over it: SAR imagery exists for it, ocean current and wind forcing data can be obtained for its region and time window, and the region has usable offshore infrastructure coverage.

One of these cases carries a special role and is referred to throughout this document as the **ground-truth anchor**: a real, documented historical spill sourced from a public spill-incident database (ITOPF or NOAA ERMA, per scope Section 13) whose true origin location and true origin time are independently known. This case exists specifically so that Stage 21 can compare the pipeline's hindcast origin estimate against a documented real origin and report an actual distance error in kilometres and time error in hours. The scope document is unusually direct that this is not for demo variety — it is the mechanism that produces the one drift accuracy number that must appear in the evaluation regardless of what else is built.

**Why this stage exists.** Two reasons, and they are different in kind. The first is demo robustness: scope Section 12 flags that a segmentation model may behave unpredictably on an arbitrary uploaded SAR image outside its training distribution, and the pre-agreed answer to that risk is that the default demo path uses curated, pre-verified cases only. The second is evidentiary: without the ground-truth anchor, drift modelling ships with zero quantified accuracy while detection and attribution are both fully measured, which is precisely the kind of asymmetric gap that draws a question nobody has an answer to. Selecting and hand-verifying this case early, rather than discovering late that no suitable case can be sourced, is what turns that risk into a non-event.

**Inputs.** Public historical spill incident records (ITOPF spill database, NOAA ERMA). Public SAR imagery archives and the public SAR oil spill datasets named in scope Section 13. Coverage maps for the ocean current and wind data sources. This is the first stage that touches real-world incident records; no earlier stage has consulted them.

**Outputs.** A case manifest: for each of the 2–3 cases, its identifier, its geographic bounding box, its scene acquisition timestamp, its scene source, and — for the ground-truth anchor only — the documented real origin coordinates and documented real origin time, together with the citation they came from. Consumed by Stage 3 (which fetches imagery for these regions), Stage 4 (which fetches forcing data for these exact region/time windows), Stage 5 (which needs to know which regions require infrastructure coverage), Stage 21 (which compares against the anchor's documented origin), Stage 27 (which generates synthetic vessel traffic for these regions and windows), and Stage 44 (which renders the case dropdown).

**Dependencies.** Stage 1, because the case manifest is itself an inter-stage object and its coordinate and timestamp fields must conform to the frozen contract from the moment it is written. This is a light dependency in effort terms but a real one: a case manifest written in local time, or with the anchor's coordinates in the wrong order, poisons every stage that reads it.

**What "done" looks like.** Two to three cases are recorded in the manifest. At least one is a real documented historical spill whose origin coordinates and origin time have been independently traced to a named public source and hand-checked — not copied from a secondary summary. For every case, it has been positively confirmed (not assumed) that SAR imagery, ocean current data, and wind data all exist covering that region and that time window; the check is that a specific file or specific query for each has been identified, not that the data source "generally covers" that ocean.

**Human Decision Gate.**

- **Show a human:** for the ground-truth anchor, the documented origin coordinates and origin time set beside the source record they were traced from, plus the confirmation that SAR imagery, ocean current data and wind data all exist for that region and window.
- **The judgment:** whether the anchor's documented origin is a surveyed fact or is itself an estimate. Many historical spill records list an inferred or reported position rather than a measured one, and nothing about the record's appearance reveals which it is. Stage 21's entire accuracy figure rests on this call.
- **Proceed if:** the origin traces to a primary record and reads as a real position → this case becomes the anchor.
- **If not:** either select a different documented incident, or keep this one and state explicitly that Stage 21 measures agreement between two estimates rather than accuracy against truth — the caveat this stage already carries. Section 11.3's `[STRETCH]` extension, one or two additional real historical cases from the same sources, is the existing path to a stronger result.

**Known limitations & caveats.** Scope Section 11.3 and its v3 edit apply directly and should be read as part of this stage: the ground-truth anchor is a single case, n=1. It is sufficient as a demo anchor and as a concrete accuracy figure, but it is not statistically meaningful on its own, and the team is expected to be ready to say "n=1, here is why" rather than let it look like an oversight. Scope Section 11.3 also carries a `[STRETCH]` item to add one or two additional real historical cases to strengthen that result beyond a single data point.

**Where this could silently go wrong.** Selecting an anchor case whose "documented origin" is itself an estimate rather than a fact — many historical spill records list an inferred or reported position, not a surveyed one. If the anchor's origin is itself uncertain, the distance error computed in Stage 21 is measuring agreement between two estimates rather than accuracy against truth, and nothing about the number's appearance reveals this. The second risk is choosing a case that is beautiful on a map but sits in a region with no offshore infrastructure coverage, which quietly guts Stage 22.

---

### Stage 3 — SAR Corpus Acquisition & Preprocessing

The case manifest names which scenes the system must handle; this stage assembles the imagery to train on and the imagery to run on, and puts both into one consistent form. It is the first stage that touches raw SAR data.

**Tier:** `[MVP]`. The scope document's core segmentation requirement (Section 5.1) is `[MVP]` and specifies training on the public SAR Oil Spill dataset; that dataset has to be acquired and prepared before it can be trained on.

**What this stage is.** Two related jobs that share one output format. First, obtaining the labelled training corpus: the public Zenodo/Kaggle SAR Oil Spill Detection dataset (5-class) or the Deep-SAR Oil Spill (SOS) dataset, per scope Section 13, together with its official train/test split — the split matters and is preserved rather than re-drawn, because Stage 10 must report metrics on the dataset's *official held-out test split* for those metrics to mean anything comparable. Second, obtaining the SAR scenes for the demo cases named in Stage 2's manifest.

Preprocessing then puts everything into one consistent form: consistent pixel value scaling, consistent handling of the SAR image's characteristic speckle noise, consistent tiling or resizing to the input dimensions the model expects, and — critically — retention of the geospatial referencing metadata that maps pixel coordinates back to real longitude and latitude. That last item is easy to lose during preprocessing and is required by Stage 7, which cannot place a polygon on the Earth without it.

**Why this stage exists.** SAR imagery is not ordinary photography: it measures radar backscatter, oil suppresses the small surface waves that produce backscatter, and so a slick appears as a dark patch against a brighter sea. So do several other things — hence look-alikes, and hence the five-class labelling scheme rather than a binary one. Getting the corpus into a consistent, correctly-referenced form is the unglamorous precondition for the entire detection pipeline, and the georeferencing requirement in particular is what connects the model's pixel-space output to every geographic stage that follows.

**Inputs.** Public SAR datasets and imagery archives (first stage to touch these). The case manifest from Stage 2, which determines which specific scenes are needed beyond the training corpus.

**Outputs.** A prepared training set and held-out test set in a consistent format with their five-class labels intact and the official split preserved; prepared per-case scenes with their georeferencing metadata attached. Consumed by Stage 6 (training), Stage 7 (inference), Stage 10 (evaluation on the held-out split), and Stage 51 if the `[STRETCH]` upload path is built, since an uploaded image must be pushed through the same preprocessing to be handled at all.

**Dependencies.** Stage 1, for the georeferencing and coordinate conventions the prepared scenes must carry. Stage 2, because the set of scenes to acquire is defined by the case manifest. Stage 3 does not depend on Stage 4 or Stage 5 and can be built alongside them.

**What "done" looks like.** The labelled corpus is downloaded, its five classes are confirmed present and correctly named, and the official train/test split is preserved as-is and identifiable in the prepared output. Every demo case named in the manifest has its scene prepared. A round-trip georeferencing check passes: a chosen pixel in a prepared scene converts to a longitude/latitude that lands where it should on an independent map, and back again. Class distribution across the corpus has been counted and recorded — needed as context for reading the per-class metrics in Stage 10.

**Known limitations & caveats.** The scope document's Risk Register flags that segmentation training is wall-clock time rather than typing speed, and recommends a pretrained backbone or transfer learning to reduce it; that pressure lands on Stage 6, but it constrains this stage too, since preprocessing choices (input dimensions, normalization) must match whatever pretrained backbone is chosen. Deciding preprocessing entirely independently of that choice will force rework.

**Where this could silently go wrong.** Preprocessing applied inconsistently between the training corpus and the demo-case scenes. If training images are normalized one way and the demo scene another, the model will still run and still emit a segmentation mask — it will simply be a worse one, with no error raised and no obvious symptom other than results being mysteriously weaker on the case that matters most. The second silent failure is georeferencing metadata dropped during tiling, which surfaces much later as a spill polygon in the wrong place.

---

### Stage 4 — Forcing-Data Acquisition & Regional Caching

Where Stage 3 fetches what the detector sees, this stage fetches what the drift engine feels. It is the second half of external data acquisition and is separated because it has a different failure mode: not size, but access latency outside the team's control.

**Tier:** `[MVP]`. Drift modelling using ocean surface current data and wind data is `[MVP]` per scope Section 7.1; the data it consumes is therefore `[MVP]` too.

**What this stage is.** Obtaining, subsetting, and locally caching the gridded ocean surface current and wind fields — collectively, the **forcing data** — covering each demo case's region and time window. Sources are named in scope Section 13: ocean currents from NOAA OSCAR, HYCOM, or Copernicus Marine Service; wind from ECMWF ERA5 via the Copernicus Climate Data Store, or NOAA GFS.

The word "forcing" is the oceanographic term for the external fields that drive a simulation — the drift model does not itself know anything about weather or ocean circulation; it is pushed around by these fields. Their spatial resolution, temporal resolution, and coverage window place a hard ceiling on what drift modelling can resolve, which is why this stage is a foundational contract rather than a detail inside Stage 13.

The time window matters in a way that is easy to under-scope: hindcasting runs *backward* from the detection time, so the cached window must extend backward far enough to cover the full hindcast duration, and forward far enough to cover the forecast horizon. A window that only covers the detection moment is useless for both.

**Why this stage exists.** The Risk Register names external oceanographic and wind data access as a distinct risk with a specific character: registration approval and large downloads for current and wind sources are blockers that working harder does not clear. Some of these sources gate access behind registration and approval; some require large downloads. No amount of effort compresses an approval queue. The pre-agreed mitigation is to register for access and download and cache the specific region and time window for each demo case early, well before the pipeline needs it — not to discover the gate exists at the point of first use. Separating this into its own stage is what makes that risk visible instead of buried inside a modelling stage.

**Inputs.** External oceanographic and meteorological data services (first stage to touch these). The case manifest from Stage 2, which supplies the exact regions and time windows to subset.

**Outputs.** Locally cached, subsetted current and wind fields per case, in a format the drift engine can read directly, with their native spatial and temporal resolution recorded alongside them. Consumed by Stage 13 (engine integration), Stages 14 and 15 (the hindcast and forecast runs), Stage 18 (which perturbs these fields to build the ensemble), Stage 20 (whose hand-rolled advection routine interpolates the same gridded fields), and Stage 33, where dead-reckoning interpolation across an AIS dark gap may use current fields to make an interpolated position current-consistent.

**Dependencies.** Stage 1, for coordinate and timestamp conventions — forcing data commonly arrives in longitude ranges of 0–360 rather than −180–180, and reconciling that against the frozen contract belongs here rather than inside the drift engine. Stage 2, for the regions and windows. Independent of Stages 3 and 5.

**What "done" looks like.** For every case in the manifest, both current and wind fields are cached locally, cover the case's full region with margin, and cover a time window that extends both backward past the intended hindcast horizon and forward past the intended forecast horizon. Each cached dataset's spatial resolution, temporal resolution, and coordinate convention are recorded. A load test passes: the cached files open with the intended reader and return plausible values at a known point and time, verified against an independent source for at least one sample.

**Known limitations & caveats.** Forcing-field resolution is a hard limit on drift realism, and it is inherited by everything downstream. A current field on a coarse grid cannot represent fine-scale eddies or nearshore circulation, so a hindcast driven by it has an irreducible error floor regardless of how good the drift engine is. This matters directly for how the Stage 21 accuracy number is interpreted and how the ensemble spread in Stage 18 is set — perturbation bounds that ignore the resolution limit will understate uncertainty.

**Where this could silently go wrong.** A cached window that does not actually cover the hindcast period. The drift engine may run to completion anyway, silently extrapolating or holding the boundary value once it runs past the end of the data, producing a trajectory that looks smooth and physical but is driven by nothing after a certain point. The second silent failure is the 0–360 versus −180–180 longitude convention: it does not error, it just puts the simulation in the wrong ocean, or worse, subtly offsets it.

---

### Stage 5 — Static Geospatial Reference Layer

The last of the foundational stages assembles the fixed geography the system reasons against: where the land is, where the protected areas are, and — the part the scope document treats as a named risk — where the offshore platforms and pipelines are.

**Tier:** `[MVP]`, with a `[STRETCH]` extension. Checking the origin against known platform locations and mapped pipeline routes is `[MVP]` (scope Section 6), as is distance-to-coastline (scope Section 5.3) and the sensitive-zone boundary used for landfall timing (scope Section 7.2). The natural seep zone dataset is `[STRETCH]`, tied to the `[STRETCH]` seep check in Stage 24; the boundary is that this stage's `[MVP]` obligation is coastline, protected zones, platforms, and pipelines, and seep zones are added only if that `[STRETCH]` feature is pursued.

**What this stage is.** Assembling one coherent reference layer of fixed geographic features for each demo case's region, comprising: coastline geometry, protected or environmentally sensitive zone boundaries, offshore oil and gas platform locations (from public infrastructure datasets such as Global Energy Monitor, or OpenStreetMap), and offshore pipeline routes (OpenStreetMap). All of it in the frozen coordinate system from Stage 1, all of it queryable by "what fixed features lie within radius R of this point."

This stage also owns the scope document's named fallback. Public infrastructure datasets may have thin coverage for a given region, and scope Section 6 and the Risk Register both prescribe the same answer: verify coverage for the specific chosen demo region, and if coverage is thin, hand-seed a small static list of verified real platform and pipeline coordinates for that region instead of relying on a live dataset query. That fallback list, if used, is part of this stage's output and is marked as hand-verified so that later stages and the dossier can be honest about its provenance.

**Why this stage exists.** This layer is the entire evidential basis for the multi-hypothesis source triage differentiator. Stage 22's ability to say "this origin sits within a defined radius of a known platform" is only as good as the platform dataset behind it, and a triage step that silently has no platforms to check against will confidently report `likely-vessel` for every case — the exact failure the differentiator exists to prevent. The coastline component separately serves detection characterization (distance from spill to nearest coastline, scope Section 5.3) and forecasting (time-until-landfall, scope Section 7.2), which is why coastline and infrastructure are assembled together rather than in two places.

**Inputs.** Public offshore infrastructure datasets, OpenStreetMap, coastline and protected-area datasets (first stage to touch these). The case manifest from Stage 2, which defines which regions need coverage.

**Outputs.** A per-region reference layer containing coastline geometry, sensitive-zone boundaries, platform point locations, and pipeline route geometry, each feature carrying a provenance marker distinguishing dataset-sourced from hand-verified entries. Consumed by Stage 9 (distance to coastline), Stage 16 (coastline and sensitive-zone crossing for landfall timing), Stage 22 (proximity testing against platforms and pipelines), Stage 24 if the `[STRETCH]` seep check is built, and Stage 43 onward for map rendering context.

**Dependencies.** Stage 1, for the coordinate contract — this layer is compared geometrically against outputs from several different stages, so a mismatch here contaminates all of them. Stage 2, for the regions. Independent of Stages 3 and 4.

**What "done" looks like.** For every case region in the manifest, a coverage verification has been performed and its result recorded: either the public datasets provide usable platform and pipeline coverage for that region, or the hand-verified static fallback list has been created and each of its coordinates independently checked against a second source. A spatial query returns correct results for a known test point — a point placed deliberately near a known platform returns that platform within the expected radius, and a point in open water far from infrastructure returns nothing. Distance-to-coastline returns a plausible, independently sanity-checked value for at least one known location.

**Human Decision Gate.**

- **Show a human:** a rendered map of the demo region with every platform and pipeline the public datasets return plotted on it, and the count of features found.
- **The judgment:** whether that coverage is *usable* for this specific region — the scope document's own word. It cannot be reduced to a count: a region can return a plausible number of features and still be missing the ones near the origin, and this is the judgment the Risk Register asks for by name.
- **Proceed if:** coverage is judged usable → the live dataset query stands as the source.
- **If not:** invoke the fallback already named in scope Section 6 and the Risk Register — hand-seed a small static list of verified real platform and pipeline coordinates for that region — and mark those entries with the hand-verified provenance this stage already carries, so Stage 23 can weigh them accordingly.

**Known limitations & caveats.** Scope Section 14 states this openly as a disclosed limitation: platform, pipeline, and seep datasets may have incomplete public coverage in some regions, and the static-list fallback is used where this applies. This means an absence of infrastructure near an origin is weaker evidence than a presence of it — "no platform found" may mean "no platform" or may mean "not in the dataset." Stage 23's confidence assignment has to reflect that asymmetry rather than treating absence as proof.

**Where this could silently go wrong.** An empty or near-empty infrastructure dataset that returns zero results without raising an error. Every proximity query succeeds, every query returns "nothing nearby," and triage cheerfully routes every case to vessel attribution — the pipeline runs end-to-end and looks correct while the multi-hypothesis differentiator has quietly stopped functioning. The specific defence is a positive test asserting that a known platform *is* found, not merely that queries do not crash.

---
# Part II — Detection Pipeline (scope Stage A)

With the contract frozen, the cases chosen, and the data cached, the system can start producing its first real object. This part covers everything the scope document groups under Stage A: turning a SAR scene into a **detection record** — a spill polygon with measured geometric properties and an honest statement of how confident the model is that the thing it found is oil rather than a look-alike.

It is worth restating the framing from the scope document's Positioning & Novelty section before starting, because it sets the right level of ambition for this whole part: pure SAR segmentation is a solved, commoditized academic task, and many published models already reach high accuracy on these exact public datasets. Nothing in Part II is where the project wins. What Part II must do is produce a detection that is *correct enough to build on* and, more importantly, *honest enough to build on* — carrying its own uncertainty forward rather than presenting itself as ground truth. That honesty is the first appearance of the uncertainty-awareness differentiator, and it is set up here and cashed out in the dossier much later.

---

### Stage 6 — Multi-Class SAR Segmentation Model

The prepared corpus from Stage 3 is the input to the first modelling work in the system. This stage trains the detector that every subsequent stage's output ultimately traces back to.

**Tier:** `[MVP]`. Scope Section 5.1: a multi-class semantic segmentation CNN (U-Net or similar) trained on the public SAR Oil Spill dataset, classifying every pixel as one of `oil-spill`, `look-alike`, `land`, `ship`, `sea surface`.

**What this stage is.** Training a semantic segmentation convolutional neural network to assign one of five class labels to every pixel of a SAR scene. "Semantic segmentation" means per-pixel classification rather than a single label for the whole image or a bounding box around an object — the model outputs a label map the same size as the input. U-Net is the named architecture family; it is an encoder-decoder design that compresses the image down to capture context and then expands it back to full resolution while reusing detail from the compression path, which is why it suits tasks where the output has to be spatially precise.

The five-class scheme is doing real work and is not an arbitrary choice. A binary oil/not-oil model cannot distinguish an oil spill from a biogenic slick, a low-wind zone, or a rain cell — all of which also appear as dark patches in SAR. By giving `look-alike` its own class, the model is forced to learn the distinction, and its relative confidence between `oil-spill` and `look-alike` becomes directly usable downstream. That is the mechanism Stage 8 depends on, and it is the reason no separate look-alike classifier is needed anywhere in this system.

**Why this stage exists.** Without a detector there is no pipeline: every downstream stage — drift seeding, triage, attribution, reporting, the entire guided interface — begins from a spill polygon that this model produces. Its role in the differentiators is indirect but essential: it is the source of the look-alike confidence that makes uncertainty-awareness possible at the very first step, and it is the reason the system can claim to run end-to-end from raw satellite imagery rather than from a hand-drawn polygon.

**Inputs.** The prepared five-class labelled training corpus from Stage 3, with the dataset's official train/test split preserved. Optionally a pretrained backbone, if transfer learning is used.

**Outputs.** Trained model weights, together with the exact preprocessing configuration they were trained under and a record of the training regime. Consumed by Stage 7 (inference), Stage 10 (evaluation on the held-out split), and Stage 51 if the `[STRETCH]` upload path is built.

**Dependencies.** Stage 3, for the prepared corpus and the preserved split — training against a re-drawn split would make Stage 10's numbers non-comparable to published results on the same dataset, quietly removing their main value. Stage 1 only weakly, since this stage works in pixel space; the coordinate contract binds at Stage 7, not here.

**What "done" looks like.** Training has converged (a stable loss curve, no ongoing improvement on a validation split), the model produces a five-class mask for an unseen scene, and per-class metrics on the official held-out test split have been computed — the numbers themselves belong to Stage 10, but this stage is not finished until those numbers exist and are not degenerate. Specifically, the `oil-spill` and `look-alike` classes must both be genuinely learned rather than one collapsing entirely into the other or into `sea surface`; a model achieving good overall accuracy by never predicting `look-alike` is not done, because it has destroyed the mechanism Stage 8 relies on.

**Human Decision Gate.**

- **Show a human:** the per-class IoU and Dice table from Stage 10 alongside the class distribution recorded in Stage 3, and predicted masks overlaid on several unseen scenes, including at least one containing a look-alike.
- **The judgment:** whether `oil-spill` and `look-alike` were genuinely learned as distinct classes, or one has collapsed into the other or into `sea surface`. An aggregate metric can look strong while this has happened, and if it has, the look-alike confidence in Stage 8 is measuring nothing. This is the call on whether the detector is fit to be the thing every downstream stage builds on.
- **Proceed if:** both classes are visibly learned in the masks and neither per-class figure is degenerate.
- **If not:** retrain. The Risk Register's named levers are the ones to reach for — a pretrained backbone or transfer learning to cut training time, and starting training early rather than deferring it behind other work.

**Known limitations & caveats.** The scope document's Risk Register flags that segmentation training is wall-clock time, not typing speed — AI-assisted coding does not make GPU training faster — and prescribes starting training early rather than deferring it, and using a pretrained backbone or transfer learning to cut training time where available. Separately, scope Section 12 flags that model behaviour on arbitrary imagery outside the training distribution is unknown, which is why curated cases are the default demo path (Stage 44) and arbitrary upload stays `[STRETCH]` (Stage 51).

**Where this could silently go wrong.** Severe class imbalance producing a model that looks strong on aggregate metrics while being useless on the classes that matter. `sea surface` will dominate the pixel count by a wide margin in most scenes; a model that predicts it almost everywhere can post a high overall accuracy while barely detecting oil at all. This is why Stage 10 reports per-class IoU and Dice rather than a single number — and why this stage's done-condition names the `oil-spill`/`look-alike` distinction explicitly rather than relying on an aggregate.

---

### Stage 7 — Inference & Mask-to-Polygon Vectorization

Stage 6 produces a model that labels pixels. Everything downstream — drift seeding, distance-to-coast, map rendering — needs geography, not pixels. This stage is the bridge, and it is where the frozen coordinate contract from Stage 1 first binds to real output.

**Tier:** `[MVP]`. Implied directly by scope Section 5.3, which requires geometric properties computed "from the mask," and by the frontend's `[MVP]` requirement (Section 10.1) that the detected spill polygon be overlaid as a GeoJSON layer.

**What this stage is.** Running the trained model over a case's prepared scene to produce a detection mask, then converting the `oil-spill` region of that mask into a **spill polygon**: a georeferenced GeoJSON geometry in WGS84, conforming exactly to the schema frozen in Stage 1. Concretely this involves isolating the oil-spill class pixels, cleaning the raster result — removing specks too small to be real detections, closing small holes, deciding how disconnected patches are handled — then tracing the region boundary into vector form and transforming those pixel coordinates into longitude and latitude using the georeferencing metadata Stage 3 preserved.

Several decisions here are contract decisions rather than technical ones, and they should be resolved against Stage 1 rather than invented locally: whether multiple disconnected oil patches become a `MultiPolygon` or several separate detections; what minimum area threshold a patch must exceed to be kept; how much boundary simplification is applied, since an unsimplified per-pixel boundary produces an enormous polygon that will slow map rendering later.

**Why this stage exists.** This is the transition from the machine-learning half of the system to the geospatial half, and it is the single point where a pixel-space error becomes a geographic error. Every stage after this treats the spill polygon as a real place in the ocean. The stage also matters for the narrative UI differentiator in a mundane but real way: the polygon rendered on the map in Stage 45 is this exact object, so its vertex count and cleanliness directly determine whether the map step looks like a considered detection or a jagged raster artifact.

**Inputs.** Trained model weights from Stage 6. A prepared, georeferenced scene from Stage 3. The frozen spill-polygon schema and coordinate conventions from Stage 1.

**Outputs.** A detection mask (retained, because Stage 8 needs the underlying class probabilities and Stage 10 needs the mask itself), and a spill polygon in GeoJSON conforming to the Stage 1 schema. The polygon is consumed by Stage 9 (geometric properties), Stage 14 (which seeds drift particles from it), Stage 15 (forward forecast from its current shape), Stage 40 (the dossier), and Stage 45 (map rendering).

**Dependencies.** Stage 6, for the model. Stage 3, for the georeferenced scene — without preserved georeferencing this stage cannot produce geography at all. Stage 1, for the polygon schema and coordinate order, which is the contract this stage most directly implements.

**What "done" looks like.** Running inference on a demo case scene produces a valid GeoJSON spill polygon that passes the Stage 1 schema validator, and that polygon, when plotted on an independent basemap, lands over water in the expected region at the expected location. Ring winding order and coordinate order conform to the GeoJSON specification. A scene containing no oil produces an empty or explicitly-null result rather than a degenerate polygon. Vertex count is bounded to a level that renders without lag.

**Human Decision Gate.**

- **Show a human:** the produced spill polygon plotted on an independent basemap at the case's real location, next to the detection mask it was traced from, with its vertex count.
- **The judgment:** whether the polygon is in the right place and is the right *shape* — specifically whether morphological cleaning has merged two genuinely separate slicks into one, or dissolved a real detection into specks. A coordinate transposition and an over-cleaned mask both produce schema-valid GeoJSON, so validation sees neither, and both change the seeding region for the hindcast in Stage 14.
- **Proceed if:** the polygon lands over water in the expected region and its outline corresponds to the mask it came from.
- **If not:** revisit the cleaning and simplification parameters together with the contract decisions Stage 1 fixed — whether disconnected patches become a `MultiPolygon` or separate detections, and the minimum area threshold — rather than adjusting thresholds locally here and letting the contract drift.

**Known limitations & caveats.** The polygon inherits every limitation of the model behind it — it is the model's *belief* about where oil is, not a measurement of oil. This is exactly why Stage 8's look-alike confidence must travel with it rather than being discarded here, and why the dossier states an indicative confidence rather than presenting the polygon as fact.

**Where this could silently go wrong.** Coordinate transposition, again, and this is the stage where it actually happens — a latitude/longitude swap during the pixel-to-geographic transform produces a perfectly valid polygon in the wrong place, and every downstream stage will process it without complaint. The drift engine will happily simulate it, triage will check it against infrastructure, attribution will filter vessels against it, and the map will render it; nothing errors. The second, subtler failure is over-aggressive morphological cleaning that merges two genuinely separate slicks into one polygon, which changes the seeding region for the hindcast and therefore the origin estimate.

---

### Stage 8 — Look-Alike Confidence Extraction & Propagation

The polygon from Stage 7 says where the model thinks the oil is. This stage extracts how strongly it believes that, and — the more important half — establishes the discipline by which that belief travels intact all the way to the dossier instead of being quietly dropped.

**Tier:** `[MVP]`. Scope Section 5.2 tags both the per-detection confidence score and the requirement to feed it downstream as `[MVP]`.

**What this stage is.** Two things. First, extracting a per-detection **look-alike confidence** from the segmentation model's own class probabilities — specifically, how strongly the model favours `oil-spill` over `look-alike` across the detected region. The scope document is explicit that no separate model is needed for this: the five-class scheme means the discrimination is already inside the network's output, and this stage simply reads it out and aggregates it over the detection.

Second, and equally part of this stage: establishing that this score is carried through every subsequent stage and surfaces in the final report, *so that the report states an indicative confidence that this is a real spill rather than assuming detection is ground truth*. That propagation is a design obligation, not an afterthought, and it is the reason this is a stage rather than a line inside Stage 7.

The wording matters as much as the number. Scope Section 5.2's v3 edit is unambiguous: raw softmax class probabilities are **not** calibrated confidence — CNNs are typically overconfident. The score must be reported as an *indicative, uncalibrated* value, and stating it as a precise statistical "X% confident" figure is specifically to be avoided. Calibration methods (temperature scaling, Platt scaling) are named in the scope document as a disclosed, not-yet-implemented improvement — the answer if a judge asks, not something to claim.

**Why this stage exists.** This is the first and most visible instance of the uncertainty-awareness differentiator. A system that hands a spill polygon downstream with no confidence attached is asserting that its detector is right, and every conclusion built on top of it inherits that unstated assumption. By propagating an explicit, honestly-labelled confidence, the pipeline can say "this is probably a spill, and here is how probably" — which is what distinguishes a decision-support tool from an automated determination, and which connects directly to the positioning statement in Stage 40.

**Inputs.** The per-pixel class probability output from the model, and the detection mask from Stage 7. Note this stage needs the *probabilities*, not just the final labels — which is why Stage 7 retains them rather than emitting only a hardened mask.

**Outputs.** A single look-alike confidence value per detection, plus the aggregation method used to produce it, attached to the detection record. Consumed by Stage 40 (the dossier's spill summary), Stage 45 (the map's confidence indicator), and Stage 53 (which reports it as part of the evaluation narrative). Stage 23 may also reference it when assigning triage confidence, since a weak detection should not produce a strongly-stated source hypothesis.

**Dependencies.** Stage 7, for the mask and probability output. Stage 1, for where this field lives in the detection record schema — this is precisely the kind of field an intermediate stage drops if the contract does not carry it.

**What "done" looks like.** Every detection record carries a look-alike confidence value with a documented aggregation method, and that exact value can be traced end-to-end: it appears in the detection record, it survives every intermediate stage, and it appears in the rendered dossier and on the map. The phrasing used wherever it is displayed says "indicative" and avoids a precise statistical claim — the words are part of the done-condition, not a presentation detail. A test case with a deliberately ambiguous detection produces a visibly lower value than a clear one.

**Human Decision Gate.**

- **Show a human:** the look-alike confidence values for a clear detection and for a deliberately ambiguous one side by side, and the exact wording used wherever the value is displayed.
- **The judgment:** whether the score visibly separates the two cases, and whether the displayed wording reads as indicative rather than as a precise statistical claim. Both are judgments about meaning rather than correctness — a score identical for both cases is still a valid number, and "94% confident" is still a valid string.
- **Proceed if:** there is clear separation between the two cases and the wording is indicative everywhere the value appears.
- **If not:** the score is still propagated, but reported with the disclosure already named in scope Section 5.2's v3 edit and Section 14 — calibration by temperature or Platt scaling is a disclosed, not-yet-implemented improvement, stated as such rather than claimed.

**Known limitations & caveats.** Stated openly in scope Section 14 and repeated here in full because it applies to every place this number appears: detection confidence scores come from uncalibrated model class probabilities and are reported as indicative, not statistically precise. A neural network reporting 0.95 does not mean it is right 95% of the time; it typically means rather less than that. The correct framing when challenged is that calibration is a known, straightforward improvement that has been identified and not implemented, not that the number is precise.

**Where this could silently go wrong.** The score being computed correctly and then quietly lost. It passes through several stage boundaries before it reaches the dossier, and any intermediate stage that reconstructs the detection record without carrying this field will drop it without error — the report then simply omits confidence, or worse, displays a default. The second failure is presentational rather than numerical: displaying it as "95% confident" somewhere in the interface, which contradicts the scope document's explicit instruction and hands a judge exactly the objection the uncertainty-awareness framing exists to pre-empt.

---

### Stage 9 — Geometric Property Extraction

The polygon exists and it carries its confidence. This stage measures it — turning a shape into the numbers the dossier reports and later stages reason with.

**Tier:** `[MVP]`. Scope Section 5.3 tags both the geometric property set and distance-to-nearest-coastline as `[MVP]`.

**What this stage is.** Computing the **geometric property set** for the spill polygon: area, perimeter, elongation or aspect ratio, and centroid, computed from the mask with standard image and geometry libraries (OpenCV, scikit-image, or an equivalent geometry toolkit), plus the distance from the spill to the nearest coastline.

Each of these carries meaning beyond being a number. Area is the headline magnitude of the incident. Perimeter combined with area gives a shape-complexity signal — a long thin slick and a compact blob of the same area behave very differently. Elongation is the most diagnostically interesting: a strongly elongated slick is characteristic of a discharge from a moving source, which is soft supporting evidence for the vessel hypothesis, while a compact roughly-circular slick is more consistent with a stationary point source. Centroid is the polygon's geometric centre and is used repeatedly downstream as the spill's representative single location. Distance to coastline is the immediate answer to "does this matter urgently," and it is the static counterpart to the dynamic landfall timing computed in Stage 16.

Area, in particular, cannot be computed in degrees. Latitude and longitude are angular units and the ground distance covered by a degree of longitude varies with latitude, so area must be computed in an appropriate projected coordinate system and converted, per the projection discipline established in Stage 1.

**Why this stage exists.** These properties are the substance of the dossier's spill summary — without them the report can say a spill was found but nothing about what kind or how serious. Elongation additionally feeds the multi-hypothesis triage differentiator as corroborating shape evidence alongside the geographic evidence Stage 22 produces. Centroid and area are the inputs to the `[STRETCH]` age estimation in Stage 12, which uses spreading physics that is fundamentally a function of area over time.

**Inputs.** The spill polygon and detection mask from Stage 7. The coastline geometry from Stage 5's reference layer.

**Outputs.** The geometric property set, with declared units per Stage 1's contract, attached to the detection record. Consumed by Stage 12 (`[STRETCH]` age estimation), Stage 23 (elongation as corroborating triage evidence), Stage 40 (the dossier's spill summary), and Stage 45 (map display).

**Dependencies.** Stage 7, for the polygon. Stage 5, for coastline geometry — distance-to-coast cannot be computed without it, and this is the first stage where the reference layer is actually exercised. Stage 1, for units and the projection convention.

**What "done" looks like.** All five properties are computed and attached to the detection record with correct declared units. Area for a hand-constructed test polygon of known real-world size matches the expected value within a small tolerance — this is the specific check that catches degree-based area computation, because the error it produces is large and obvious once measured against a known shape. Distance-to-coast for a test point of known offshore distance matches an independently measured value. Elongation is 1.0 (or the defined circular value) for a circular test polygon and clearly greater for a deliberately elongated one.

**Known limitations & caveats.** Every property is a property of the *detected* polygon, not of the real slick — it inherits the detection's boundary errors directly. An over-cleaned or under-cleaned mask from Stage 7 changes area and perimeter substantially, and perimeter especially is sensitive to boundary simplification, since a smoothed boundary is systematically shorter than a jagged one. Any shape-complexity reasoning built on perimeter should be understood as approximate for that reason.

**Where this could silently go wrong.** Area computed in the wrong units or the wrong coordinate space, producing a number that is internally consistent and completely wrong — degrees-squared rendered as square kilometres yields a value that is plausible-looking on a report page and off by orders of magnitude. The second silent failure is a centroid that falls outside its own polygon, which happens legitimately for crescent-shaped or multi-part geometries; any downstream stage treating the centroid as "a point inside the spill" — including drift seeding and landfall timing — needs to know that is not guaranteed.

---

### Stage 10 — Detection Evaluation Harness

Stages 6 through 9 produce detections. This stage answers the question the evaluation methodology insists must be answered with a number rather than an assertion: how good are they.

**Tier:** Untagged in source. Scope Section 11 states the governing rule for all evaluation work: *"every one of them must be reported as an actual number in the final presentation — not asserted qualitatively."* Section 11.1 specifies the detection metrics precisely. This document does not assign a tier to evaluation stages.

**What this stage is.** A repeatable harness that runs the trained model over the dataset's **official held-out test split** and reports Intersection-over-Union (IoU) and the Dice coefficient, **per class** — `oil-spill`, `look-alike`, `land`, `ship`, `sea surface` — and as an overall mean.

Both metrics measure overlap between predicted and true regions. IoU is the area of intersection divided by the area of union: perfect overlap is 1, no overlap is 0. Dice is twice the intersection divided by the sum of the two areas; it is closely related to IoU and is consistently the more forgiving of the two for the same prediction, which is why reporting both is standard practice and why they must never be compared against each other or quoted interchangeably. Per-class reporting is the load-bearing requirement: as noted in Stage 6, a model can post a strong mean while performing poorly on `oil-spill` specifically, because the mean is dominated by the easy, abundant classes.

The word "harness" is deliberate. This is a rerunnable evaluation, not a one-off measurement — retraining the model must produce updated numbers without manual work, otherwise the reported figures drift out of date relative to the model actually shipping.

**Why this stage exists.** Scope Section 11 opens by stating why the whole evaluation section exists: a working demo on one case proves nothing by itself. Detection is the cheapest part of the system to evaluate rigorously, because the labelled test split provides ground truth for free, and it establishes the credibility baseline that makes the harder claims in Stages 21 and 37 believable. It also supports the honesty theme running through this part: the detection metrics quantify exactly how much trust the look-alike confidence from Stage 8 deserves.

**Inputs.** Trained model weights from Stage 6. The official held-out test split from Stage 3, unmodified.

**Outputs.** A per-class table of IoU and Dice values plus overall means, in a form that can be pasted directly into the evaluation section assembled in Stage 53. Consumed by Stage 53, and by Stage 11 as the baseline the historical benchmark is read against.

**Dependencies.** Stage 6, for the model. Stage 3, for the preserved official split — if the split was re-drawn, the numbers are not comparable to published results on the same dataset and lose most of their value as a credibility anchor.

**What "done" looks like.** IoU and Dice are reported for all five classes individually and as overall means, computed on the official held-out split with no training data leakage. The numbers are reproducible: rerunning the harness on the same weights produces identical values. The `oil-spill` class figure specifically is non-degenerate, and the class distribution recorded in Stage 3 is reported alongside the metrics so a reader can interpret the mean in light of the imbalance.

**Known limitations & caveats.** These metrics describe performance on the dataset's own test distribution, which is not the same as performance on arbitrary real SAR imagery — a caveat that connects directly to the Risk Register's note on live upload robustness and to why arbitrary upload (Stage 51) is `[STRETCH]` and never the primary demo path.

**Where this could silently go wrong.** Data leakage between train and test — the classic version being tiles from the same source scene appearing in both splits, which inflates every metric while looking entirely normal. The defence is to preserve the dataset's official split exactly rather than re-splitting. The second failure is quoting the overall mean as "the" accuracy figure and letting the weak per-class number go unmentioned, which is a reporting failure rather than a computational one but does more damage under questioning.

---

### Stage 11 — Historical Benchmark Validation of the Detector

Stage 10 measures the detector against the dataset it was trained on. This stage asks a different and harder question: would it have caught real, documented spills that actually happened.

**Tier:** `[WORTH ADDING]`. Scope Section 5.4: cross-check the detector against a public historical spill incident database and report how many known past events would have been correctly flagged — explicitly framed as a validation and credibility step, not a new model.

**What this stage is.** Assembling a set of real, documented historical spill incidents from a public database (ITOPF, NOAA ERMA — the same sources as the ground-truth anchor in Stage 2), obtaining SAR imagery covering those incidents where available, running the existing detector over that imagery, and reporting how many of the known events the detector would have correctly flagged.

Two things this stage is explicitly not. It is not a new model, and it is not a re-training exercise: the detector is used exactly as Stage 6 produced it. And it is not a replacement for Stage 10's metrics — it is a complement that tests generalization to imagery the model has never seen, drawn from real incidents rather than from a curated dataset.

**Why this stage exists.** It closes the gap between "performs well on its own test split" and "would have been useful in reality," which is the gap a sceptical evaluator will probe first. Because it uses the same historical databases as Stage 2's ground-truth anchor, the incident sourcing work compounds rather than duplicating — an argument for treating these two stages as related even though they sit in different parts of this document.

**Inputs.** Public historical spill incident records (ITOPF, NOAA ERMA). SAR imagery covering those incidents. The trained model from Stage 6 and the inference pipeline from Stage 7, used unchanged.

**Outputs.** A count and rate of known historical events correctly flagged, with the incident list and the per-incident outcome recorded so the number is auditable rather than asserted. Consumed by Stage 53.

**Dependencies.** Stages 6 and 7, for a working, frozen detector and inference path — running this against a model that is still changing produces a figure that expires immediately. Stage 2 only in the sense that it shares historical-database sourcing; the case manifest itself is not required.

**What "done" looks like.** A specific, named list of historical incidents has been assembled; each has been run through the unchanged detector; each outcome is recorded as flagged or not flagged against a stated criterion for what counts as correctly flagged; and the aggregate rate is reported alongside the total. The criterion must be written down in advance, because "correctly flagged" is ambiguous for a segmentation model and two people will otherwise disagree about the same result.

**Human Decision Gate.**

- **Show a human:** the list of historical incidents fixed *before* the run, the stated criterion for what counts as correctly flagged, and the per-incident outcome.
- **The judgment:** whether each outcome genuinely counts as a hit under that criterion. Historical records give a location and an approximate time, not a labelled mask, so "correctly flagged" is a coarser call than Stage 10's pixel-level metrics and a person has to make it incident by incident. The second thing to confirm is that the incident list really was fixed in advance — choosing incidents after seeing results converts a validation into a demonstration and leaves no trace in the output.
- **Proceed if:** the outcomes are agreed against the pre-stated criterion → the aggregate rate is reportable.
- **If not:** this is `[WORTH ADDING]`. If the incidents cannot be judged consistently, the claim is dropped and Stage 10's held-out-split metrics remain the primary detection evidence.

**Known limitations & caveats.** Historical incident records give an incident location and approximate time, not a labelled ground-truth mask, so "correctly flagged" here is a coarser judgement than the pixel-level IoU of Stage 10 and should be reported as such. SAR coverage for any given historical incident may simply not exist, which biases the achievable sample toward well-observed incidents. Scope Section 5.4 also carries a `[STRETCH]` extension using the same historical database as a minor base-rate prior in vessel scoring — that is Stage 35, not this stage, and the two should not be conflated.

**Where this could silently go wrong.** Choosing which incidents to include after seeing the results, which converts a validation into a demonstration and cannot be detected from the output. Fixing the incident list before running the detector is what keeps the number meaningful. The second risk is scoring a detection as a hit because the detector flagged *something* in roughly the right area — without a stated spatial and temporal tolerance defined in advance, the hit rate silently measures the tolerance rather than the detector.

---

### Stage 12 — Indicative Age Estimation

The final detection stage adds an optional characteristic to the detection record: roughly how old the slick appears to be, inferred from its shape.

**Tier:** `[STRETCH]`. Scope Section 5.5, which specifies a rough, explicitly-labelled "indicative" estimate presented as an approximation and never as a precise figure.

**What this stage is.** Deriving an approximate age for the detected slick from its shape and area using simplified oil-spreading physics — the scope document names Fay's spreading model as the example. The underlying idea is that oil released on water spreads over time in a way that is broadly predictable from physical principles, so an observed area, run backward through a spreading relationship, implies an elapsed time since release. Fay's model is the classic formulation describing spreading through successive regimes governed by gravity, viscosity, and surface tension.

The scope document's framing constraints are part of the stage, not caveats around it: the estimate is "indicative," is presented as an approximation, and is never stated as a precise figure. An age reported as "roughly 6–18 hours" is a correct use of this stage; "7.3 hours" is not.

**Why this stage exists.** Age is investigatively useful in a way that is easy to underrate: it constrains the origin time window independently of the drift model. If the slick is roughly a day old, vessels present two hours before detection are less interesting than vessels present a day before. In principle this is corroborating evidence for the origin window from Stage 14, arrived at through entirely different physics — which is exactly the kind of independent cross-check that strengthens an explainable investigation. It is `[STRETCH]` because the physics is simplified enough that the estimate is coarse, and because nothing else in the system is blocked on it.

**Inputs.** The geometric property set from Stage 9, principally area, and the spill polygon shape. Optionally the estimated environmental conditions from the cached forcing data in Stage 4, since spreading depends on them.

**Outputs.** An indicative age range, explicitly labelled as an approximation, attached to the detection record. Consumed by Stage 40 (the dossier's spill summary) if built. Optionally referenced by Stage 14 as a sanity check on hindcast duration, though nothing in Stage 14 depends on it.

**Dependencies.** Stage 9, for area and shape. Stage 7, for the polygon. As a `[STRETCH]` item, nothing depends on this stage in turn, which is what makes it cleanly cuttable — a property worth preserving deliberately rather than by accident.

**What "done" looks like.** An age estimate is produced for each demo case detection and is expressed as a range or an explicitly approximate value, never a single precise number. The estimate is physically plausible: it does not imply a slick older than the interval that the forcing data and drift modelling can support, and it does not return negative or absurdly large values for edge-case geometries. The label "indicative" or equivalent appears wherever the value is displayed.

**Known limitations & caveats.** Scope Section 14 lists this explicitly: age estimation and weathering, if built, are approximations based on simplified physics, not precise forensic timing. Fay-type spreading models assume a single instantaneous release of known volume onto calm water — a continuous discharge from a moving vessel, which is precisely the scenario this system is most interested in, violates that assumption substantially. The estimate is a rough indicator, not a measurement.

**Where this could silently go wrong.** Producing a confident-looking single number that contradicts the drift-derived origin window without anyone noticing the contradiction — two parts of the same dossier quietly disagreeing about when the spill started is worse than not reporting age at all. If this stage is built, a consistency check against the Stage 14 origin window belongs with it, and a disagreement should be surfaced rather than silently displayed side by side.

---
# Part III — Drift Modelling (scope Stage C)

Part II ended with a detection record: a georeferenced spill polygon, measured, with an honest confidence attached. That record answers *where the oil is now*. This part answers the two questions that follow from it — *where did it come from*, and *where is it going* — using one simulation engine run in two directions.

This is the part of the document where the ordering departs most visibly from the scope document's lettering, and the reason bears repeating because everything in Part IV depends on it: source-type triage (scope Stage B) works by testing the hindcasted origin point against known infrastructure, so the backward half of drift modelling must exist and produce an **origin estimate** before triage can be built or tested at all. Drift modelling is therefore presented here, before triage, and the origin estimate is the object that connects them.

This part is also where the **uncertainty-awareness** differentiator does its heaviest lifting. Stages 13 through 16 build a single deterministic answer — one origin point, one forecast track. Stages 18 and 19 replace that single answer with a distribution: the **origin probability field**, rendered as a **probability cone**. The scope document is explicit that the ensemble is the single biggest technical and logistics risk in the project, and equally explicit about the fallback: the single deterministic run is the guaranteed baseline, and the ensemble is attempted only once the core pipeline works end-to-end and data access is confirmed. That risk boundary is why the deterministic and ensemble stages are separated here rather than merged.

---

### Stage 13 — Drift Engine Integration

Before any hindcast or forecast can be run, the simulation engine has to be standing up, reading the cached forcing fields from Stage 4, and producing trajectories that can be trusted at all. This stage is that scaffolding, separated from the runs themselves because it is genuinely a distinct body of work and because both the backward and forward stages depend on it identically.

**Tier:** `[MVP]`. Scope Section 7.1 specifies the engine choice as `[MVP]` and is unusually emphatic that it is *"a working-engine decision, not a stretch feature."*

**What this stage is.** Standing up OpenDrift's **OpenOil** module as the project's drift engine, wired to read the cached ocean current and wind fields from Stage 4, configured for the demo regions, and verified to produce physically sensible particle trajectories.

Some vocabulary, since the scope document uses these terms without defining them. A **Lagrangian** drift model simulates transport by following individual particles as they move with the flow, rather than by solving for a concentration field on a fixed grid — the model releases many notional particles and advects each one according to the local current and wind. OpenDrift is an open-source framework for exactly this. **OpenOil** is its oil-specific module, and the scope document's choice of it over the generic `OceanDrift` module is deliberate and load-bearing: OpenOil already carries oil-specific physics including a built-in interface to an oil-property and weathering library. That built-in capability is what Stage 17 later switches on, and the scope document's v3 edit is pointed about why this matters — hand-building a weathering formula would duplicate a capability the chosen engine already has, and would look like the team did not know its own tool.

Concretely this stage covers: installing and configuring the engine; writing the readers that expose the cached current and wind fields to it in the form it expects; establishing the seeding interface by which a spill polygon becomes a cloud of particles; setting the time-stepping and horizon parameters; and confirming on a simple test that particles move in the direction the forcing fields say they should.

**Why this stage exists.** Every drift result in the system — origin estimate, forecast track, landfall timing, and the entire ensemble — comes out of this engine. Isolating integration from the actual scientific runs means that when a hindcast later produces a surprising result, the question "is the engine wired up correctly" has already been answered separately, rather than being tangled up with "is the physics right for this case."

**Inputs.** Cached ocean current and wind fields from Stage 4, with their recorded resolutions and coordinate conventions. The spill polygon schema from Stage 1, since seeding consumes that geometry.

**Outputs.** A configured, callable drift engine harness that accepts a seed geometry, a start time, a direction, and a duration, and returns particle trajectories. Consumed by Stage 14 (backward), Stage 15 (forward), Stage 18 (which calls it many times with perturbed forcing), and Stage 20, whose hand-rolled routine is cross-checked against this engine's output.

**Dependencies.** Stage 4, for the forcing fields — this stage cannot be meaningfully verified without real forcing data, since "did the particles move correctly" is a question about the fields as much as the engine. Stage 1, for coordinate and timestamp conventions at the engine boundary, which is where the 0–360 versus −180–180 longitude reconciliation flagged in Stage 4 actually bites.

**What "done" looks like.** The engine runs to completion on a demo case's cached forcing data, in both directions, without falling back to internal defaults or synthetic forcing. A directional sanity test passes: with a known current field, particles seeded at a known point move in the direction and roughly the distance that field implies over the simulated interval, checked by hand. Particle positions are returned in the frozen coordinate system. The engine is confirmed to be reading the cached files rather than silently substituting anything else — this specific check matters more than it sounds, and is repeated in the failure note below.

**Human Decision Gate.**

- **Show a human:** the hand-worked directional sanity test — a known current field, particles seeded at a known point, and the direction and distance they actually travelled — together with positive evidence of which files the engine read and what non-trivial values those files returned.
- **The judgment:** whether the engine is genuinely being driven by the cached forcing for this case. This is the most consequential silent failure in the drift work: a run on default, zero, or fallback forcing completes normally and returns a smooth, plausible trajectory that encodes no oceanography whatsoever, and no downstream stage can detect it.
- **Proceed if:** particles move as the field implies, and the intended data source is confirmed read with real values.
- **If not:** nothing further in Part III is trustworthy until this resolves. Re-check the cached window and coordinate convention from Stage 4; Stage 20's `[STRETCH]` hand-rolled advection routine exists precisely as the independent check on this question, and is worth building early if this gate is difficult to clear.

**Known limitations & caveats.** The engine inherits the forcing-data resolution limits recorded in Stage 4 entirely: it cannot resolve circulation finer than the fields driving it. Its accuracy near coastlines is additionally weaker than in open water, because nearshore circulation is both more complex and more poorly resolved in the global products this project uses — relevant to Stage 16's landfall timing, which is a nearshore quantity by definition.

**Where this could silently go wrong.** The engine running successfully on default or fallback forcing rather than the cached case data. Drift frameworks generally handle missing forcing gracefully, and a run driven by a default or a zero field completes normally and returns a smooth, plausible-looking trajectory that encodes no real oceanography whatsoever. This is the most important silent failure in the entire drift part, and the defence is an explicit assertion that the intended data source was read and that the values it returned are non-trivial — not merely that the run completed.

---

### Stage 14 — Backward Hindcast & Origin Estimate

With the engine standing up, the first real run is the one the rest of the system depends on: running the simulation backward from the detected spill to estimate where the oil came from. This stage produces the **origin estimate**, which is consumed by triage and by all of vessel attribution.

**Tier:** `[MVP]`. Scope Section 7.1: a single deterministic Lagrangian drift simulation backward in time using ocean surface current and wind data, to estimate the most likely origin point and time window.

**What this stage is.** Seeding particles from the detected spill polygon at the detection timestamp, running the drift simulation backward in time, and reducing the resulting backward particle cloud into an **origin estimate**: an estimated origin point in longitude and latitude, an estimated origin **time window**, and an associated spatial tolerance.

A hindcast, again, is simply a simulation run backward — reversing the sense of the current and wind forcing so that particles retrace where they plausibly came from. It is not a different model from the forecast; it is the same engine with the time direction reversed, which is exactly why Stage 13 exposes direction as a parameter.

The reduction step is where the real design decisions live and deserves to be treated as the substance of this stage rather than a formality. A backward run does not produce "an origin"; it produces a spreading cloud of particle positions that grows more diffuse the further back it goes. Turning that into a reportable origin estimate requires deciding: how far back to run at all; how to summarize the cloud into a representative point; how to express the time window rather than a single instant; and what spatial tolerance to attach. Every one of these choices propagates directly into Stage 22's infrastructure proximity test and Stage 28's candidate filtering, so they belong to the frozen contract as much as to this stage.

The `[MVP]` version of this is explicitly a **single deterministic run** producing one origin point with a tolerance. The ensemble version that replaces the point with a distribution is Stages 18 and 19, and the deterministic run remains the guaranteed baseline underneath it per the Risk Register.

**Why this stage exists.** The origin estimate is the hinge of the entire investigation. Triage tests it against fixed infrastructure to decide what kind of source is plausible; attribution filters and scores vessels against it. Nothing downstream of detection works without it. It also carries the uncertainty-awareness differentiator in its `[MVP]` form: even before the ensemble exists, the origin is reported as a *window with a tolerance* rather than a point, which is a meaningfully more honest object than a single coordinate.

**Inputs.** The spill polygon and detection timestamp from the detection record (Stages 7 and 8). The configured engine from Stage 13 and, through it, the cached forcing fields from Stage 4.

**Outputs.** An origin estimate — origin point, origin time window, spatial tolerance — conforming to the Stage 1 schema. Consumed by Stage 22 (infrastructure proximity testing), Stage 23 (hypothesis labelling), Stage 28 (space-time candidate filtering), Stage 29 (proximity feature), Stage 30 (trajectory alignment, which also needs the backward path itself, not only the endpoint), Stage 40 (the dossier's drift summary), Stage 21 (accuracy evaluation), and Stage 49's attribution-mode view. This is the most widely consumed object produced anywhere in Part III.

**Dependencies.** Stage 13, for the engine. Stage 7, for the polygon to seed from. Stage 4, transitively, for forcing that covers the backward window — a cached window that stops at the detection time makes this stage impossible, which is why Stage 4's done-condition names the backward extent explicitly.

**What "done" looks like.** For every demo case, a backward run produces an origin estimate conforming to the schema, with a point, a bounded time window, and a stated tolerance. The estimate is physically plausible: it is over water, not inland; it is reachable from the detection location given the forcing field magnitudes and the elapsed interval — an origin implying a drift speed far above realistic surface currents is a failure, not a result. For the ground-truth anchor case specifically, the estimate is produced and recorded so Stage 21 can score it, though the accuracy figure itself belongs to Stage 21.

**Human Decision Gate.**

- **Show a human:** the estimated origin point and its time window plotted on a map alongside the detection location, with the implied mean drift speed between the two.
- **The judgment:** whether the origin is physically reachable — over water rather than inland or inside a harbour, and at a distance the forcing magnitudes actually support over the elapsed interval. A backward run returns a coordinate regardless of whether it means anything, and that coordinate then flows into triage and candidate filtering with complete confidence.
- **Proceed if:** the origin is plausible on both counts → it becomes the origin estimate that Stages 22, 28, 29 and 30 all test against.
- **If not:** revisit the hindcast horizon and the seeding from the spill polygon. The Risk Register's single deterministic run remains the guaranteed baseline, and a persistently implausible origin on the anchor case puts the Stage 2 case selection itself back in question rather than being a drift problem to tune around.

**Known limitations & caveats.** Backward drift is inherently more uncertain than forward drift, and the uncertainty grows with the length of the hindcast: small errors in the forcing fields compound over time, so the further back the run goes the wider the true uncertainty, regardless of how tight the deterministic point looks. This is the central argument for the ensemble in Stages 18 and 19 and the reason the scope document treats that work as where the real technical depth lives. Resolution limits from Stage 4 apply in full.

**Where this could silently go wrong.** An origin point that is physically implausible but not obviously so — placed on land, inside a harbour, or at a distance from the detection that would require drift speeds no real current supports. A backward run will produce a coordinate regardless, and if nobody checks reachability, that coordinate flows straight into triage and attribution, where it will be tested against infrastructure and used to filter vessels with complete confidence. A cheap explicit plausibility assertion here — is it over water, and is the implied mean drift speed realistic — prevents an entire downstream investigation being built on a nonsense location.

---

### Stage 15 — Forward Forecast & Predicted Spread

Where Stage 14 ran the engine backward to serve the investigation, this stage runs it forward to serve the response. It uses the same engine, the same forcing, and the same seeding interface, and it is separated because its dependents are entirely different: nothing in triage or attribution waits on it.

**Tier:** `[MVP]`. Scope Section 7.2: the same drift engine run forward from the current detected location and shape, to predict the slick's position over the next several hours to days.

**What this stage is.** Seeding particles from the detected spill polygon at the detection timestamp — the same seeding as Stage 14 — and running the simulation forward to produce a **forecast track**: the predicted position and extent of the slick at successive future times over a horizon of hours to days.

The output shape matters and is a contract decision. A forecast is not a single future polygon; it is a sequence of predicted states at successive times. That sequence is what Stage 16 scans for a coastline crossing, what Stage 49's forecast-mode view renders, and what Stage 52's `[STRETCH]` time-scrubbing animation steps through. Emitting only a final position would make all three of those either impossible or require re-running the engine, so the time series is the output, not a summary of it.

In the `[MVP]` form, the forward run treats the oil as a conserved quantity being pushed around — the slick moves and disperses under the forcing, but its material properties are not evolving. Stage 17 upgrades this by switching on OpenOil's weathering physics so the slick's changing composition is accounted for.

**Why this stage exists.** Everything in the system up to this point is retrospective — it explains what happened. The forward forecast is the only part that is operationally actionable: it is what tells a response analyst where to be. The scope document's positioning as a decision-support tool for a pollution-response analyst is thin without it, because "where is it heading" is the question a responder asks first. It also gives the narrative UI its second axis: the "where did it come from" versus "where is it going" duality that Stage 49 builds on.

**Inputs.** The spill polygon and detection timestamp from the detection record. The configured engine from Stage 13 and the cached forcing from Stage 4, which must extend forward past the forecast horizon.

**Outputs.** A forecast track — a time-indexed sequence of predicted positions and extents, in the frozen coordinate and timestamp format. Consumed by Stage 16 (landfall timing), Stage 17 (which extends rather than replaces it), Stage 40 (the dossier's drift summary), Stage 49 (forecast-mode rendering), and Stage 52 if the `[STRETCH]` animation is built.

**Dependencies.** Stage 13, for the engine. Stage 7, for the polygon. Stage 4, for forward-extending forcing. Independent of Stage 14 — the two runs share everything except direction and can be built in either order, though sharing the seeding code between them is the obvious economy.

**What "done" looks like.** A forward run over each demo case produces a time-indexed forecast track over a stated horizon, in the frozen formats. The predicted trajectory is physically plausible: it does not travel at speeds inconsistent with the forcing fields, and it does not pass through land. The horizon is explicitly bounded and does not silently exceed the cached forcing window — the run either stops at the data boundary or fails loudly, and which of the two happens is a decided, documented behaviour rather than whatever the engine defaults to.

**Known limitations & caveats.** Forecast skill degrades with horizon, because forcing-field error accumulates; a several-day forecast is a much weaker claim than a several-hour one, and presenting both with equal visual confidence would misrepresent that. Nearshore accuracy is weaker than open-ocean accuracy for the reasons noted in Stage 13, which directly affects the landfall estimate in Stage 16.

**Where this could silently go wrong.** A forecast that runs past the end of the cached forcing window and continues on extrapolated or held-constant fields, producing a confident-looking trajectory whose later portion is driven by nothing real. This is the forward-direction twin of the Stage 14 failure and has the same signature: a smooth, plausible result with no error raised. The second failure is a trajectory that crosses land because coastline interaction is not handled — which would then feed a nonsense landfall time into Stage 16.

---

### Stage 16 — Landfall & Sensitive-Zone Timing Metric

The forecast track says where the slick will be. This stage extracts from it the single number a response analyst actually acts on: how long until it reaches something that matters.

**Tier:** `[MVP]`. Scope Section 7.2: an estimated time-until-landfall or time-until-sensitive-zone metric, computed from when the predicted polygon centroid crosses a coastline or protected-zone boundary.

**What this stage is.** Scanning the forecast track forward in time and determining the first time at which the predicted slick centroid crosses either a coastline or a protected/sensitive-zone boundary drawn from Stage 5's reference layer, then reporting that as an elapsed duration from the detection time.

The scope document specifies the **centroid** as the crossing test subject, and that specificity is worth preserving exactly rather than substituting a leading-edge test, because the two produce materially different answers — the leading edge of a slick reaches a shoreline substantially before its centroid does. Using the centroid is a defensible and consistent choice; quietly using something else while the scope document says centroid is the kind of drift that makes two parts of the system disagree.

The stage must also define behaviour when no crossing occurs within the forecast horizon. The correct output in that case is an explicit "no landfall predicted within the forecast horizon of N hours" rather than a null, an empty field, or an extrapolated guess — because "no landfall" and "we did not look far enough" are different statements and a dossier that conflates them is misleading.

**Why this stage exists.** It converts a trajectory into a decision. It is also the point where the reference layer built in Stage 5 pays off for the second time — first for distance-to-coastline in Stage 9, now for dynamic crossing detection — which is why coastline and protected zones were assembled once rather than per-consumer.

**Inputs.** The forecast track from Stage 15 (or its weathering-enabled form from Stage 17, if built). Coastline geometry and sensitive-zone boundaries from Stage 5. The detection timestamp, as the zero point the elapsed duration is measured from.

**Outputs.** A time-to-coastline and/or time-to-sensitive-zone duration in declared units, with the crossing location, or an explicit no-crossing-within-horizon result. Consumed by Stage 40 (the dossier's drift summary) and Stage 49 (forecast-mode display).

**Dependencies.** Stage 15, for the forecast track. Stage 5, for the boundaries to test against. Stage 1, for the duration units and the timestamp base.

**What "done" looks like.** For a demo case whose forecast is directed toward shore, a specific crossing time and crossing location are produced and are consistent with the forecast track when the two are plotted together — a stated crossing time that does not match where the track visibly meets the coast is a failure. For a case whose forecast stays offshore, the explicit no-crossing-within-horizon result is produced with the horizon stated. Durations are in the contract's declared units.

**Known limitations & caveats.** This estimate inherits the forecast's nearshore weakness directly, and nearshore is precisely where it operates — the metric is least reliable in exactly the region it describes. It is a planning indicator, not a scheduling commitment, and should be worded as such wherever it is displayed. It also inherits any coverage gaps in the protected-zone dataset from Stage 5: a sensitive zone missing from the reference layer cannot be crossed.

**Where this could silently go wrong.** A crossing detected against a coastline geometry at a coarser resolution than the forecast's spatial precision, producing a confident time for a crossing of a shoreline that is itself approximate to within kilometres. The second silent failure is the no-crossing case being emitted as a null and then rendered downstream as a blank or a zero, which reads as "arrives immediately" or "no risk" depending on the template — the exact reason the no-crossing result is specified here as an explicit, distinguishable value.

---

### Stage 17 — Weathering-Enabled Forward Forecast

The forward forecast so far moves the oil without changing it. This stage turns on the physics that lets the slick evolve — and it is deliberately a configuration stage on top of existing machinery, not new modelling.

**Tier:** `[WORTH ADDING]`. Scope Section 7.2, with an explicit v3 note on why this tier rather than `[STRETCH]`.

**What this stage is.** Enabling OpenOil's built-in weathering processes — evaporation, emulsification, dispersion, and biodegradation, via its oil-property library interface — for the forward forecast, so that predicted spread accounts for the spill changing its composition, volume, and behaviour over time rather than moving as a static blob.

Weathering is the collective term for what happens to spilled oil over time: lighter fractions evaporate, the remainder mixes with water to form an emulsion that behaves very differently, wave action disperses droplets into the water column, and biological processes slowly degrade what is left. These change how the slick moves, not only how much of it there is, which is why weathering belongs in the forecast rather than in reporting.

The scope document's v3 edit defines the shape of the work precisely and is the reason for the tier: this replaces the earlier plan to hand-build a custom weathering formula, because OpenOil ships this natively — building it by hand would duplicate a capability the chosen engine already has and would look like the team did not know its own tool. Turning it on is a configuration and parameter task, principally setting the oil type and its properties, not new modelling, which is why it is realistically `[WORTH ADDING]` rather than `[STRETCH]`.

**Why this stage exists.** It materially improves forecast realism for a small amount of work, and it demonstrates command of the chosen tool — which, given that the project's claimed contribution is integration quality rather than novel modelling, is exactly the right kind of depth to show. It also improves Stage 16's landfall estimate, since a weathered slick moves differently from an unweathered one.

**Inputs.** The forward run configuration from Stage 15. An oil type and its properties, selected per case — which is itself a modelling assumption, since the true oil type in a real incident is often unknown. The cached forcing from Stage 4, since weathering rates depend on wind and sea state.

**Outputs.** A weathering-enabled forecast track — the same object shape as Stage 15's output, so no downstream stage needs to change to consume it, augmented with the weathering state over time (how much has evaporated, dispersed, and so on). Consumed by Stage 16 (which recomputes landfall against it), Stage 40, and Stage 49.

**Dependencies.** Stage 15, which it extends rather than replaces — the unweathered forecast remains the fallback if this is cut. Stage 13, because the OpenOil choice made there is what makes this a configuration task; had the generic module been chosen, this stage would be new modelling work rather than a parameter change. That dependency is the clearest single illustration of why the engine choice in Stage 13 was called load-bearing.

**What "done" looks like.** The forward forecast runs with weathering enabled and reports a weathering state that evolves over the forecast horizon in a physically sensible direction — evaporated fraction increases monotonically, remaining surface volume does not increase. The chosen oil type is recorded per case as an explicit, documented assumption rather than an engine default. The forecast track object shape is unchanged, verified by Stage 16 and the dossier consuming it without modification.

**Known limitations & caveats.** Scope Section 14 states this openly: age estimation and weathering, if built, are approximations based on simplified physics, not precise forensic timing. The oil type is in practice an assumption rather than a measurement, and weathering rates are sensitive to it, so the weathered forecast is more precise-looking than it is precise. The honest framing is that weathering makes the forecast more physically realistic in character, not that it makes it quantitatively authoritative.

**Where this could silently go wrong.** An oil type left at a library default that does not match the case's assumed oil, producing weathering rates that are internally consistent and wrong — and invisibly so, since nothing about the output reveals which oil was assumed unless it is recorded deliberately. That is why recording the assumption is part of this stage's done-condition rather than a documentation nicety.

---

### Stage 18 — Perturbed Ensemble Execution

Every drift result so far is a single deterministic answer. This stage begins replacing that with a distribution, and it is the single most consequential and most risky piece of work in the project. It is split across two stages — running the ensemble here, aggregating it in Stage 19 — because generating hundreds of trajectories and turning them into a usable probabilistic object are genuinely separate problems with separate failure modes.

**Tier:** `[WORTH ADDING]`. Scope Section 7.3, which also names this as *"the single biggest technical/logistics risk in the project"* and points at the Risk Register for the required fallback before attempting it.

**What this stage is.** Running many perturbed simulations — the scope document says 100 or more — in both directions, where each run randomizes the current and wind inputs within realistic error bounds, so that the spread across runs represents genuine uncertainty in the forcing data rather than a single assumed-perfect field.

The concept: the deterministic run in Stage 14 treats the cached current and wind fields as exactly correct. They are not — they are themselves model products with their own error, and small errors compound over a drift simulation. An ensemble acknowledges this by running the same simulation many times, each with the forcing nudged within its plausible error range, and treating the resulting scatter of outcomes as the answer instead of any individual run.

The design work in this stage is the perturbation scheme, and it is where the physics lives: how the current and wind fields are perturbed, whether perturbations are correlated in space and time or independent per particle, and what "realistic error bounds" means quantitatively for the specific data products cached in Stage 4. Independent random noise per timestep produces artificially narrow spread, because errors cancel; correlated perturbation — a run where the current is biased slightly one way throughout — produces a realistic spread. Getting this wrong yields a cone whose *width is meaningless*, which is worse than no cone at all, because it looks like quantified uncertainty.

The execution work is orchestration: running the engine many times, managing runtime and storage, and retaining per-run results in a form Stage 19 can aggregate.

**Why this stage exists.** This is the uncertainty-awareness differentiator in its strongest form — the scope document lists "ensemble drift simulation producing a probability cone, not a single deterministic line/point" as the first of the four differentiators. It is also what makes the calibration check in Stage 21 possible: without an ensemble there is no predicted uncertainty region to test the true origin against.

**Inputs.** The configured engine from Stage 13, the cached forcing from Stage 4 together with its recorded resolution and any published error characteristics, and the seeding configuration from Stages 14 and 15.

**Outputs.** A collection of per-run trajectories, in both directions, retained with the perturbation parameters used for each. Consumed exclusively by Stage 19, which turns them into the origin probability field.

**Dependencies.** Stages 13, 14, and 15 — the ensemble perturbs and repeats runs those stages define, so it cannot precede a working deterministic run. Stage 4, critically, because ensemble runs multiply the demand on cached forcing data and confirm data access at scale. The Risk Register's stated precondition applies as a dependency in its own right: this is attempted only after the core pipeline works end-to-end and data access is confirmed, never as the last thing built.

**What "done" looks like.** At least the specified number of perturbed runs complete in both directions for at least the ground-truth anchor case, with per-run outputs retained and perturbation parameters recorded. The perturbation scheme is documented — what is perturbed, by how much, with what correlation structure, and on what basis those bounds were chosen. A spread sanity check passes: the ensemble spread is neither degenerate (all runs nearly identical, indicating perturbations are not actually taking effect) nor absurd (spread far exceeding any plausible drift distance, indicating perturbation magnitudes are wrong). Total runtime and storage are recorded, because they determine whether this is feasible across all cases or only the anchor.

**Human Decision Gate.**

- **Show a human:** the spread of the completed ensemble — all perturbed endpoints plotted together — with the perturbation scheme, its magnitudes and its correlation structure written alongside, plus the total runtime and storage the batch consumed.
- **The judgment:** whether the spread is real. A degenerate spread means the perturbations never reached the engine and the "ensemble" is one run repeated; an unrealistically tight spread usually means uncorrelated per-timestep noise that cancels itself out; an absurd spread means the magnitudes are wrong. All three produce a well-formed cone, and a cone whose width is an artifact is worse than no cone at all, because it looks like quantified uncertainty.
- **Proceed if:** the spread is neither degenerate nor absurd, and the runtime is affordable across the cases it is intended for.
- **If not:** the Risk Register's answer is pre-agreed and explicit — the single deterministic run from Stages 14 and 15 is the guaranteed MVP baseline. The ensemble is dropped rather than shipped with meaningless width; nothing downstream requires it.

**Known limitations & caveats.** The Risk Register is explicit that real current and wind reanalysis data — with registration gates and large downloads — combined with 100 or more runs per direction is a major technical and logistics risk, and that the single deterministic run from Stages 14 and 15 is the guaranteed baseline that ships if this does not. Nothing downstream may *require* the ensemble: Stages 22, 28, and 40 all consume the deterministic origin estimate and must continue to work when the ensemble is absent. Preserving that fallback cleanly is part of this stage's obligation.

**Where this could silently go wrong.** A perturbation scheme that produces a spread which is precise-looking and meaningless — most commonly by perturbing with uncorrelated noise so errors cancel across timesteps and the cone comes out unrealistically tight. The output looks like a beautifully quantified uncertainty region and is in fact an artifact of the noise model. The second failure is quieter still: perturbations that never actually reach the engine, so all runs are identical and the "ensemble" is one run repeated, which produces a degenerate cone that will be read as high confidence.

---

### Stage 19 — Origin Probability Field & Cone Aggregation

Stage 18 produced hundreds of trajectories. On their own they are an unreadable tangle. This stage turns them into the object the rest of the system can consume and the interface can draw: the **origin probability field**, rendered as the **probability cone**.

**Tier:** `[WORTH ADDING]`. The aggregation half of scope Section 7.3, which specifies runs *"aggregated into a probability cone/field instead of a single line."*

**What this stage is.** Reducing the ensemble of perturbed trajectories into a spatial probability distribution — for the backward runs, a distribution over possible origins; for the forward runs, a distribution over future positions at each forecast time — and serializing it in a form the API, the dossier, and the map can all consume.

The work is a sequence of decisions, each of which changes what the final visual means. Where the ensemble members are aggregated onto a common spatial grid, the grid resolution has to be chosen against the forcing resolution rather than arbitrarily, or the field will imply spatial precision the underlying physics cannot support. The distribution then has to be reduced to renderable contours — the familiar form is nested probability regions, an inner region containing some stated fraction of the ensemble and outer regions containing more — and the fractions chosen must be stated explicitly wherever the cone is drawn, because a cone with no stated containment level communicates nothing quantitative at all. For the forward direction the field is time-indexed, since the distribution both moves and widens with lead time, and that time indexing is what Stage 52's `[STRETCH]` scrubbing animation steps through.

The output must be usable by a browser: a dense probability grid serialized naively is far too large to ship to a map, so a contour or aggregated representation is part of the contract, not an optimization.

**Why this stage exists.** The cone is the most visible expression of the uncertainty-awareness differentiator in the entire product — it is the thing a viewer looks at and immediately understands to mean "we do not know exactly, and here is the shape of not knowing." It also produces the object Stage 21's calibration check consumes: asking what fraction of the time the true origin falls inside the predicted cone is only answerable once the cone is a well-defined region with a stated containment level.

**Inputs.** The per-run trajectories from Stage 18. The forcing resolution recorded in Stage 4, which bounds the meaningful grid resolution.

**Outputs.** The origin probability field for the backward direction and a time-indexed probability field for the forward direction, each with explicitly stated containment levels, serialized to the schema reserved in Stage 1. Consumed by Stage 21 (calibration), Stage 40 and Stage 41 (dossier), Stage 49 (cone rendering in both modes), and Stage 52 if built. Stage 23 may reference the cone's extent when assigning triage confidence, since a wide cone should temper how strongly a source hypothesis is stated.

**Dependencies.** Stage 18, for the runs. Stage 1, for the schema — this is the field flagged in Stage 1 as necessarily provisional, and this stage is where it becomes concrete, which should be an extension of the contract rather than a redefinition of it.

**What "done" looks like.** A probability field exists for at least the ground-truth anchor case in both directions, with stated containment levels, serialized at a size the frontend can load without stalling. The deterministic origin point from Stage 14 falls inside the aggregated field — if the single deterministic run lands outside its own ensemble's high-probability region, either the ensemble or the deterministic run is wrong and that must be resolved rather than shipped. Contour geometry is valid and renderable in the frozen coordinate system. Every rendering of the cone states its containment level.

**Human Decision Gate.**

- **Show a human:** the rendered cone with its stated containment level, the deterministic origin point from Stage 14 plotted on it, and the aggregation grid resolution set next to the forcing resolution recorded in Stage 4.
- **The judgment:** whether the cone is honest. Two things to check: whether the deterministic point falls inside its own ensemble's high-probability region, and whether the field's fine structure is real or an artifact of aggregating onto a grid finer than the forcing supports. An intricately detailed probability field is exactly what over-fine gridding produces.
- **Proceed if:** the deterministic point sits inside the field, the grid resolution is defensible against the forcing, and the containment level is stated wherever the cone is drawn.
- **If not:** coarsen the grid to the forcing resolution. If the deterministic run lands outside its own ensemble, one of the two is wrong and that is resolved rather than shipped — with the Risk Register's deterministic baseline as the fallback if it cannot be.

**Known limitations & caveats.** The cone represents uncertainty *arising from the perturbations that were applied* — principally forcing-field error — and not all sources of error. Detection boundary error, seeding assumptions, and the drift model's own structural approximations are not represented in it. It is therefore a lower bound on true uncertainty, and describing it as "the uncertainty" overstates it. This is a distinction worth being able to articulate, since it is the natural follow-up question once the cone is shown.

**Where this could silently go wrong.** A cone drawn without a stated containment level, which reads as authoritative while being quantitatively vacuous — the viewer supplies their own assumption about what the boundary means. The second failure is aggregating onto a grid far finer than the forcing resolution supports, producing an intricately detailed probability field whose fine structure is entirely an artifact of the interpolation rather than of the ocean.

---

### Stage 20 — Hand-Rolled Advection Cross-Check

The drift results so far come out of a framework. This stage builds a deliberately minimal implementation of the same physics from scratch, not to replace the engine but to be able to explain it — and to catch the case where the engine is being driven incorrectly.

**Tier:** `[STRETCH]`. Scope Section 7.4: a minimal custom Lagrangian particle-advection routine, roughly 100–200 lines, cross-checked against OpenDrift's output.

**What this stage is.** Writing a small, self-contained particle advection routine — bilinear interpolation of the gridded current and wind data to a particle's position, plus simple time-stepping — and running it over the same case and same forcing as the engine, then comparing trajectories.

The physics involved is genuinely simple at this level, which is the point. Advection means transport by the flow. At each timestep the routine finds where the particle currently is, interpolates the current and wind values at that position from the surrounding grid points (bilinear interpolation: a weighted average of the four surrounding grid cells), moves the particle by that velocity times the timestep, and repeats. That is the core of what any Lagrangian drift model does; the frameworks add a great deal around it, but not to that centre.

The deliverable is the comparison, not the routine. Agreement within a stated tolerance over a stated interval is evidence that the engine is being driven correctly; divergence is a finding worth chasing, since it most likely indicates a configuration or forcing problem in the engine rather than a defect in a hundred lines of interpolation.

**Why this stage exists.** Two reasons, both about defensibility. First, it makes the physics explainable line by line rather than treated as a black box — directly relevant when the system's claimed contribution is integration quality and someone asks what the drift model actually does. Second, and more practically, it is an independent check on the highest-consequence silent failure in Part III: the engine running on default or fallback forcing, which is invisible in the engine's own output but would show up immediately as a divergence against a routine that demonstrably reads the cached files.

**Inputs.** The cached forcing fields from Stage 4, read directly rather than through the engine's readers — reading them independently is what makes the check independent. Seeding position and time matching a run already produced by Stage 14 or Stage 15.

**Outputs.** An independent trajectory plus a documented comparison against the engine's trajectory over the same interval, with a quantified divergence measure. Consumed by Stage 53 as a validation exhibit, and referenced by Stage 41's evidence-presentation logic if the full evidence breakdown is built. Nothing in the operational pipeline consumes this output, which is what makes it cleanly cuttable.

**Dependencies.** Stage 13, 14, and 15, since there must be an engine trajectory to compare against. Stage 4, for direct access to the forcing fields.

**What "done" looks like.** The routine reproduces the engine's trajectory for a short interval within a stated, pre-agreed tolerance — for example, an endpoint separation below a fixed distance over a fixed simulated duration — and the tolerance is documented *before* the comparison is run rather than chosen to fit the result. Where divergence exceeds tolerance, it has been investigated and explained rather than tolerated. The routine is short enough and clear enough that it can be read aloud and understood, which is its actual purpose.

**Known limitations & caveats.** The routine is deliberately simpler than the engine — it will not include diffusion, wind-drift factors, vertical mixing, or oil-specific physics — so exact agreement is neither expected nor desirable, and only short-interval, open-water comparison is meaningful. It is a sanity check on the transport core, not a validation of OpenOil.

**Where this could silently go wrong.** Reusing the engine's own readers or interpolation code for convenience, which destroys the independence that gives the check its value: a routine sharing the engine's forcing-loading path will agree with the engine even when both are reading the wrong data. The second failure is choosing the tolerance after seeing the divergence, which converts a check into a rationalization.

---

### Stage 21 — Drift Accuracy Evaluation Against the Ground-Truth Anchor

Part III closes by answering, with a number, how accurate the hindcast actually is. This is the stage that consumes the ground-truth anchor selected in Stage 2, and the scope document treats its output as non-negotiable.

**Tier:** `[MVP, required]`. Scope Section 11.3 uses that exact phrasing and states: *"This number must appear in the evaluation slide regardless of what else gets built."* It also carries a `[STRETCH]` extension for additional cases and a conditional calibration item tied to the ensemble.

**What this stage is.** Taking the origin estimate that Stage 14 produces for the ground-truth anchor case, comparing it against that incident's documented real origin, and reporting two numbers: **distance error in kilometres** between estimated and documented origin location, and **time error in hours** between estimated origin time and documented origin time.

Two extensions attach to this stage without changing its core. The `[STRETCH]` item from scope Section 11.3 adds one or two further real historical cases from the same sources, strengthening the result beyond a single data point. And conditional on the ensemble existing (Stages 18 and 19), an additional **calibration** figure is reported: across synthetic scenarios, what fraction of the time the true origin falls inside the predicted uncertainty cone. Calibration asks a different question from accuracy — not "how close was the estimate" but "was the stated uncertainty honest." A cone containing the truth far less often than its stated containment level is overconfident; far more often, and it is uninformative. That figure is the direct quantitative test of the uncertainty-awareness differentiator, which is why it is worth reporting whenever the ensemble exists.

**Why this stage exists.** The Risk Register names the absence of this number as a specific risk: if the historical case is not sourced, drift ships with zero quantified accuracy — *"the one gap most likely to stand out given the other two stages are fully measured."* Detection has IoU and Dice; attribution has Top-1 and Top-3 hit rates; without this, drift has assertions. This stage exists to close that asymmetry.

**Inputs.** The origin estimate for the anchor case from Stage 14. The documented real origin coordinates and time from Stage 2's case manifest. If the ensemble exists, the origin probability field from Stage 19 and the synthetic scenario set from Stage 27, against which calibration is measured.

**Outputs.** A distance error in kilometres and a time error in hours for the anchor case, plus the same for any additional cases under the `[STRETCH]` extension, plus a calibration fraction if the ensemble exists. Consumed by Stage 53.

**Dependencies.** Stage 14, for the origin estimate. Stage 2, for the documented ground truth — this stage is the entire reason the ground-truth anchor requirement exists in Stage 2, and the two are best understood as a matched pair separated by the dependency chain between them. Stages 18, 19, and 27 conditionally, for calibration only.

**What "done" looks like.** A distance error in kilometres and a time error in hours exist for the ground-truth anchor, computed against a documented origin traced to a named public source, and stated with the n=1 caveat attached to the number itself rather than in a footnote. The comparison method is written down: which point of the origin estimate is compared against the documented position, and how the estimated time window is reduced to a single comparable time — otherwise two people will compute different errors from the same estimate.

**Human Decision Gate.**

- **Show a human:** the distance error in kilometres and the time error in hours, the written comparison method, and an explicit statement of whether any hindcast parameter was adjusted after this error was first seen.
- **The judgment:** whether this number is presentable as an accuracy figure. The judgment is not whether the error is small — it is whether it is *honest*. An error improved by tuning against the anchor is a fitted result rather than an out-of-sample one, and nothing in the output distinguishes the two.
- **Proceed if:** the number is reported with the n=1 caveat attached to it directly, per scope Section 11.3's v3 edit.
- **If not:** if parameters were tuned against the anchor, that is disclosed in those words. Section 11.3's `[STRETCH]` extension — one or two additional real historical cases from the same sources — is the existing path to a figure that does not rest on the tuned case.

**Known limitations & caveats.** Scope Section 11.3's v3 edit applies verbatim and belongs next to the number wherever it is shown: this is a single case, n=1, sufficient as a demo anchor and as a concrete accuracy figure but not statistically meaningful on its own — and the team should be ready to say "n=1, here is why" rather than let it look like an oversight. The caveat from Stage 2 also applies: if the documented origin is itself an estimate, this measures agreement between two estimates rather than accuracy against truth.

**Where this could silently go wrong.** Tuning hindcast parameters until the anchor's error looks good, which converts the project's one real accuracy number into a fitted result while leaving no trace in the output. If parameters are adjusted after seeing the error, that has to be disclosed, and the honest form of that disclosure is stating that the anchor was used for tuning and therefore is not an out-of-sample result. The second failure is an ambiguous comparison method — comparing the cone centroid in one place and the deterministic point in another — producing two different "the" accuracy numbers in different parts of the presentation.

---
# Part IV — Source-Type Triage (scope Stage B)

Part III produced an **origin estimate**: a place and a time window where the oil most plausibly entered the water. The obvious next move is to look for ships there. This part exists to stop the system doing that reflexively.

The scope document opens its Stage B section with the whole argument in one sentence: not every spill comes from a moving ship, and before any vessel-attribution logic runs, the system asks what kind of source is plausible — *this prevents force-fitting an innocent ship as the culprit when the real source is stationary*. That is the **multi-hypothesis source triage** differentiator, and it is also the part of the system with the most direct real-world consequence, because the cost of the failure it prevents is a wrongly implicated vessel.

This part is short — four stages — but it sits at the highest-leverage point in the pipeline. It is the gate. Everything in Part V runs only because triage said it should.

---

### Stage 22 — Origin Proximity Testing Against Fixed Infrastructure

This is the first stage that consumes the origin estimate from Stage 14, and it is where the reference layer assembled in Stage 5 finally does the job it was assembled for.

**Tier:** `[MVP]`. Scope Section 6 tags both the platform check and the pipeline check as `[MVP]`, including the static-list fallback behaviour.

**What this stage is.** Testing the hindcasted origin point against the fixed infrastructure in Stage 5's reference layer, and producing the geometric evidence that Stage 23 turns into a labelled hypothesis. Two checks specifically:

- **Platform proximity.** Whether the origin lies within a defined radius of a known offshore oil and gas platform location, producing a "near known platform" flag together with the identity of the platform and the actual distance.
- **Pipeline proximity.** Whether the origin lies within a defined distance of a publicly mapped offshore pipeline route, with the same treatment — which pipeline, and how far.

Two design points matter more than they appear to. First, the **radius is a parameter with real consequences** and must be chosen and documented deliberately rather than defaulted: too tight and a genuine platform source is missed because the origin estimate has its own spatial tolerance; too loose and every case in a busy oil field reports "near platform" and the triage signal degrades to noise. The right way to set it is against the origin estimate's own tolerance from Stage 14 — the radius should acknowledge that the origin is a window, not a point.

Second, the test should be against the origin *window*, not only the origin point. The system already carries a spatial tolerance, and, where the ensemble exists, a full origin probability field from Stage 19. Testing the point alone discards information the pipeline went to considerable trouble to produce.

**Why this stage exists.** Without this check, the system has exactly one hypothesis available to it and will supply a ranked vessel list for a spill that came from a wellhead. That is the failure mode the differentiator is named after, and it is the one that damages a real investigation most. This stage is also where the honesty about data coverage established in Stage 5 becomes operationally relevant: proximity evidence is only as strong as the infrastructure dataset behind it, and this stage must pass through the provenance of whatever it matched against.

**Inputs.** The origin estimate from Stage 14 — point, time window, and spatial tolerance — and the origin probability field from Stage 19 where it exists. Platform locations and pipeline routes from Stage 5's reference layer, with their provenance markers distinguishing dataset-sourced entries from hand-verified fallback entries.

**Outputs.** A structured proximity result: for each check, whether a match was found, the identity and distance of the nearest matching feature, and the provenance of that feature. Consumed by Stage 23, which is its only consumer — this stage produces evidence, not a decision.

**Dependencies.** Stage 14, because there is no origin to test without a hindcast — this is the concrete reason this part follows Part III rather than preceding it, despite the scope document's B-before-C lettering. Stage 5, for the infrastructure to test against; a reference layer that is empty for the demo region makes this stage vacuous while still returning results. Stage 1, for the coordinate contract, since this is a geometric comparison between objects produced by two different parts of the system.

**What "done" looks like.** For a test origin deliberately placed near a known platform in the reference layer, the check returns that platform with a correct distance; for a test origin placed in open water far from infrastructure, it returns no match. The radius parameter is documented together with the reasoning for its value and its relationship to the origin estimate's spatial tolerance. Provenance is carried through: a match against a hand-verified fallback entry is distinguishable in the output from a match against a dataset entry.

**Human Decision Gate.**

- **Show a human:** the chosen radius, the origin estimate's own spatial tolerance from Stage 14, and the match results for each demo case — which feature matched, at what distance, and with what provenance.
- **The judgment:** whether the radius is calibrated sensibly against the origin's own uncertainty. Too tight and a genuine platform source is missed, because the origin is a window rather than a point; too loose and every case in a busy oil field reports "near platform" and the triage signal degrades to noise. There is no correct value derivable from the data — it is a calibration a person makes.
- **Proceed if:** the radius is justified against the Stage 14 tolerance and the per-case results are plausible for the region.
- **If not:** adjust the radius; or, if the underlying coverage is the problem rather than the radius, fall back to the hand-verified static list from Stage 5, as scope Section 6 and the Risk Register already prescribe.

**Known limitations & caveats.** Scope Section 14's disclosed limitation applies directly: platform, pipeline, and seep datasets may have incomplete public coverage in some regions, and the static-list fallback is used where this applies. The asymmetry noted in Stage 5 is the operative caveat here — a positive match is reasonably strong evidence, but *absence of a match is weak evidence of absence*, because it may equally mean the feature is missing from the dataset. Stage 23 must encode that asymmetry rather than treating "nothing nearby" as affirmative support for the vessel hypothesis.

**Where this could silently go wrong.** An empty or sparse reference layer producing "no infrastructure nearby" for every case, which is indistinguishable in the output from a genuine open-water origin and routes every case to vessel attribution. The pipeline runs end to end, the demo works, and the differentiator has silently stopped existing. The specific defence, as in Stage 5, is a positive test asserting a known platform *is* matched — not merely that the query returns without error. A second, subtler failure is a radius chosen large enough that everything matches, which produces the opposite bias: platform hypotheses everywhere and no vessel attribution at all.

---

### Stage 23 — Source Hypothesis Labelling & the Routing Gate

Stage 22 produced evidence. This stage turns it into a decision, and that decision determines whether the entire attribution half of the system runs at all. It is the narrowest and most consequential piece of logic in the pipeline.

**Tier:** `[MVP]`. Scope Section 6: output a labelled hypothesis with confidence, from a fixed set, and route on it.

**What this stage is.** Producing the **source hypothesis** — a label drawn from exactly the set `{likely-vessel, likely-platform, likely-pipeline, possible-natural-seep, insufficient-evidence}`, with an associated confidence and the evidence that produced it — and then acting on it as a routing gate.

The routing rule is specified precisely in the scope document and should be implemented exactly as written: **only `likely-vessel` (and `insufficient-evidence`, shown as low-confidence) proceeds into vessel attribution; other outcomes are reported directly.** That is, a `likely-platform` or `likely-pipeline` result does not produce a vessel suspect list at all — it goes straight to the dossier with the stationary-source conclusion. The `insufficient-evidence` path is the deliberate middle: it proceeds to attribution, because withholding all leads on ambiguous evidence is unhelpful to an analyst, but it proceeds *flagged as low-confidence* so nothing downstream reads it as a confident vessel determination.

The `possible-natural-seep` label is part of the fixed set here even though the seep check that can produce it is `[STRETCH]` (Stage 24). The label set is frozen in the contract from the start so that adding the seep check later is a new evidence source feeding an existing label, not a schema change rippling through the dossier and the interface.

Confidence assignment is the substantive design work in this stage, and it is where several threads from earlier converge. It should reflect: the strength and provenance of the proximity evidence from Stage 22, the asymmetry that absence of infrastructure is weak evidence, the width of the origin estimate's tolerance or probability cone from Stages 14 and 19 — a very wide cone should temper any hypothesis — and, reasonably, the **look-alike confidence** from Stage 8, since a weakly-supported detection should not yield a strongly-stated source hypothesis. Elongation from Stage 9 is available as corroborating shape evidence: a strongly elongated slick is more consistent with a moving source, a compact one with a stationary point source.

**Why this stage exists.** This is the multi-hypothesis triage differentiator made concrete — the single place where the system decides that a spill might not be a ship's fault. It is also the mechanism behind the **false-implication check** in the attribution evaluation (Stage 37), which runs scenarios where the true source is a platform or pipeline and confirms that triage correctly routes them away from vessel scoring rather than Stage D forcing out a false top suspect. That check tests this stage, not the scorer.

**Inputs.** The proximity result from Stage 22. The seep check result from Stage 24 and the repeated-origin result from Stage 25, if those `[STRETCH]` stages are built. The origin estimate from Stage 14 and probability field from Stage 19, for tolerance width. The look-alike confidence from Stage 8 and elongation from Stage 9, as corroborating inputs.

**Outputs.** The source hypothesis — label, confidence, and the evidence supporting it — conforming to the Stage 1 schema, plus the routing decision itself. Consumed by Stage 28 onward (the entire attribution part, which runs only on a vessel-permitting label), Stage 40 (the dossier's source hypothesis section, on every path including the non-vessel ones), and Stage 46 (the interface's source-hypothesis step, which also implements this gate visually).

**Dependencies.** Stage 22, for the proximity evidence. Stage 14, for the origin estimate and its tolerance. Stage 1, for the frozen label set — the exact five strings must be fixed in the contract, because they are matched on by the router, rendered by the interface, and printed in the dossier, and a mismatch between any two of those is a silent routing failure. Stages 8 and 9 for corroborating inputs, weakly.

**What "done" looks like.** Every case produces exactly one label from the fixed five-value set, with a confidence and an attached evidence record explaining the label. The routing behaviour is verified explicitly in both directions: a constructed case with an origin adjacent to a known platform produces `likely-platform` and produces **no** suspect list, and a constructed case in open water with no infrastructure nearby produces `likely-vessel` or `insufficient-evidence` and does proceed to attribution. The `insufficient-evidence` path is verified to proceed while being marked low-confidence, not silently upgraded to `likely-vessel`. The confidence assignment rule is written down rather than being an unexplained expression in code.

**Human Decision Gate.**

- **Show a human:** for each demo case, the assigned label, its confidence, and the full evidence record behind it — including, explicitly, whether the infrastructure dataset returned anything at all.
- **The judgment:** whether the confidence is defensible given what the evidence actually rests on. The specific thing to catch is a confidently-stated `likely-vessel` whose real basis is an empty infrastructure dataset: absence of a match is weak evidence of absence, and the output looks identical either way. This is the gate that keeps the multi-hypothesis triage differentiator from quietly becoming a single-hypothesis one.
- **Proceed if:** both the label and its confidence are defensible from the stated evidence.
- **If not:** the fallback is already inside the frozen label set — route to `insufficient-evidence`, which proceeds to attribution but is shown as low-confidence, rather than asserting `likely-vessel` on absent data.

**Known limitations & caveats.** The confidence here is a rule-based assessment built on heuristics and the quality of public infrastructure data, not a probability in any rigorous sense — and it inherits Stage 22's coverage caveat completely. The `possible-natural-seep` label is unreachable unless the `[STRETCH]` seep check exists, which should be stated plainly rather than leaving a label in the schema that can never occur. The overarching positioning from scope Section 2 applies with particular force at this stage: this is a lead-prioritization decision for a human analyst, not a determination of what caused the spill.

**Where this could silently go wrong.** A confidently-stated hypothesis resting on absent data — reporting `likely-vessel` with high confidence when the real basis is that the infrastructure dataset was empty. The output is well-formed, the label is defensible-sounding, and the reasoning is wrong in a way that is invisible downstream. The second failure is label-string drift: the router matching on one spelling while the dossier template or the interface expects another, so a non-vessel case falls through the gate into vessel attribution without any error being raised. Freezing the label set in the Stage 1 contract and validating against it is the defence for both.

---

### Stage 24 — Natural Seep Zone Check

The `[MVP]` triage checks cover human-built infrastructure. This stage adds the fourth hypothesis: oil that nobody spilled at all.

**Tier:** `[STRETCH]`. Scope Section 6: flag "possible natural seep" if the origin coincides with a documented seep area.

**What this stage is.** Testing the origin estimate against documented natural seep zones — areas where oil escapes from the seafloor through natural geological processes, without any human involvement — and emitting evidence for the `possible-natural-seep` label defined in Stage 23's fixed label set.

Natural seeps are a genuine and substantial source of oil in the ocean, and in some regions they are persistent and well-documented. A SAR detector cannot distinguish seep oil from discharged oil by appearance, so the only available discriminator is location: if the origin falls within a known seep area, that is a plausible alternative explanation that ought to be surfaced before any vessel is implicated.

Mechanically this is the same geometric test as Stage 22 against a different dataset, which is why it is a small stage. It is `[STRETCH]` primarily because documented seep-zone data has patchier public coverage than platform and pipeline data, so its value depends heavily on the region chosen in Stage 2.

**Why this stage exists.** It completes the multi-hypothesis triage set. A system that considers vessels, platforms, and pipelines but not natural seeps still has a systematic bias toward blaming somebody, and the differentiator's claim is specifically that the system considers non-anthropogenic sources too. In a region with documented seeps, this check is the difference between a defensible investigation and a confident accusation about a naturally occurring phenomenon.

**Inputs.** The origin estimate from Stage 14. Documented seep-zone geometry, added to Stage 5's reference layer as its `[STRETCH]` extension. This is the first and only stage that touches seep data.

**Outputs.** A seep proximity result — whether the origin falls within a documented seep zone, which zone, and the provenance of that record — feeding Stage 23's hypothesis labelling. Stage 23 is its only consumer.

**Dependencies.** Stage 14, for the origin. Stage 5, for the seep-zone data, which only exists in the reference layer if this `[STRETCH]` path is pursued — the two are a matched pair, and building this stage without extending Stage 5 produces a check with nothing to check against. Stage 23, in the sense that the label this stage feeds must already exist in the frozen label set, which it does by design.

**What "done" looks like.** Seep-zone geometry for the demo region is present in the reference layer with recorded provenance, and the test returns a correct positive for an origin deliberately placed inside a documented zone and a correct negative outside it. Stage 23 demonstrably produces the `possible-natural-seep` label when this check fires, which is the end-to-end verification that matters — a working check whose label never reaches the dossier is not done.

**Known limitations & caveats.** Scope Section 14 covers this explicitly alongside platform and pipeline data: seep datasets may have incomplete public coverage in some regions. Seep zones are also broad areas rather than precise points, so a positive result means the origin fell inside a region where seepage is known to occur — not that this particular oil came from a seep. That distinction should be reflected in how the label is worded, and the scope document's chosen wording already does so: the label is `possible-natural-seep`, not `natural-seep`.

**Where this could silently go wrong.** Over-triggering: seep zones can be large, so an origin falling inside one is a much weaker signal than an origin falling within a tight radius of a specific platform. If the confidence logic in Stage 23 treats the two as equivalent evidence, a busy shipping lane that happens to overlap a documented seep area will route real vessel discharges away from attribution entirely — a failure that looks like appropriate caution and is actually a blind spot.

---

### Stage 25 — Repeated-Origin Pattern Detection

The final triage stage adds a form of evidence none of the others can access: a pattern that only becomes visible across multiple incidents rather than within one.

**Tier:** `[STRETCH]`. Scope Section 6: repeated-origin pattern detection across multiple historical events in the same region.

**What this stage is.** Comparing the origin estimates of several independently detected spills in the same region and flagging when several of them trace back to the same fixed coordinates. The scope document states the inferential logic compactly and it is worth preserving exactly: *several spills independently tracing to the same fixed coordinates is strong evidence of a stationary source, since a moving vessel would not produce that pattern.*

That reasoning is what makes this stage qualitatively different from Stages 22 and 24. Those tests ask whether an origin is near something already known to be there — they can only find sources that appear in a dataset. This test can identify a stationary source that appears in **no** dataset, purely from the geometry of repetition. Given that scope Section 14 discloses incomplete infrastructure coverage as a standing limitation, a check that does not depend on that coverage is a genuinely useful complement rather than a redundant one.

The work involves running the pipeline over multiple incidents in one region, clustering their origin estimates spatially with a tolerance that respects each estimate's own uncertainty, and flagging clusters that are tighter than repeated independent vessel discharges would plausibly produce.

**Why this stage exists.** It strengthens the multi-hypothesis triage differentiator on exactly the axis where the other checks are weakest — undocumented stationary sources — and it is the only place in the system where evidence accumulates across cases rather than within one. It is `[STRETCH]` because it requires several processed incidents in one region before it can produce anything at all, which is a substantially larger data requirement than any other triage check.

**Inputs.** Origin estimates from Stage 14 for multiple incidents in the same region — meaning multiple cases must have been run through the pipeline, which is a real precondition and not a formality. Historical spill incident records (ITOPF, NOAA ERMA), which are the practical source of those additional incidents and are the same records used in Stages 2 and 11.

**Outputs.** A repeated-origin flag with the cluster location, the incidents comprising it, and the cluster's spatial tightness, feeding Stage 23's hypothesis labelling as corroborating evidence for a stationary-source label. Stage 23 is its only consumer.

**Dependencies.** Stage 14, applied across multiple cases. Stage 2 and Stage 11, for the additional regional incidents and the historical sourcing work that makes them available — this stage benefits directly from the `[STRETCH]` extension in scope Section 11.3 that adds further historical cases, since those cases are exactly what this stage needs. Stage 23, as its consumer.

**What "done" looks like.** Origin estimates from at least three independent incidents in one region have been produced and clustered, the clustering tolerance is documented and justified against the individual origin estimates' own uncertainties, and a constructed positive control — several incidents whose true origin is the same fixed point — is correctly flagged while a constructed negative control of genuinely scattered origins is not. Stage 23 demonstrably incorporates the flag into its hypothesis confidence.

**Human Decision Gate.**

- **Show a human:** the clustered origin estimates plotted together with the incidents they came from, each with its own uncertainty, and the prevailing current direction for the region.
- **The judgment:** whether the cluster reflects a real stationary source or a shared systematic hindcast bias. If every backward run in the region is pulled the same way by the same forcing error, origins will cluster regardless of where the oil actually came from — and the cluster looks identical either way. Making this call means confirming the incidents were genuinely separated in time and in detection location.
- **Proceed if:** the cluster survives that check → it becomes corroborating evidence for a stationary-source label in Stage 23.
- **If not:** this is `[STRETCH]`. The flag is dropped rather than fed into Stage 23, and the platform and pipeline checks in Stage 22 remain the basis for stationary-source triage.

**Known limitations & caveats.** With a small number of incidents, apparent clustering is weak evidence: three origins landing near each other in a region with a dominant prevailing current is not surprising, because a shared current field biases independent hindcasts in the same direction. The tolerance must therefore be tight relative to the origin estimates' own uncertainty for the pattern to mean anything, and the flag should be worded as corroborating rather than determinative.

**Where this could silently go wrong.** Clustering that is really an artifact of a shared systematic hindcast bias rather than a shared real source — if every backward run in the region is pulled the same way by the same current field error, their origins will cluster regardless of where the oil actually came from, and the cluster will look exactly like a stationary source. The check that distinguishes the two is whether the clustered origins came from incidents at genuinely different times and locations, and that check has to be deliberate, because the clustered output looks identical either way.

---
# Part V — Source Attribution Logic (scope Stage D)

Triage has returned a vessel-permitting source hypothesis. Only now does the system start looking at ships.

This part builds the evidence base, the individual **feature scores**, and the scoring engine that ranks candidate vessels — and it is the largest part of the document, which is proportionate: it is where the **explainable attribution** differentiator lives, and it is the part with the highest real-world cost of being wrong. The scope document is direct about the design consequence of that cost: the extended scorer is *"designed to minimize false positives given the real-world cost of wrongly accusing a vessel."*

Two structural points hold across this entire part. First, everything here is **feature columns feeding one scoring engine** — not separate models. The scope document says so explicitly, and it is the architectural reason every one of Stages 29 through 35 is a self-contained feature that produces one named, individually inspectable number, and why Stages 31 and 36 are the only stages that combine anything. Second, and this is the caveat that attaches to the entire part rather than to any one stage in it: **all AIS data used in this project is synthetic.** Scope Section 14 discloses it, the Risk Register rehearses the answer for it, and the v3 edit on Section 11.2 insists it be stated on the evaluation slide rather than buried. It is restated in each stage below where it materially changes what a result means, because a reader opening one stage in isolation needs to know it there.

---

### Stage 26 — AIS Schema Study & Canonical Track Representation

Before any vessel data can be generated or scored, the system needs to know what vessel data actually looks like. This stage establishes that, and it is the reason the synthetic data produced in Stage 27 is a defensible stand-in rather than an invention.

**Tier:** `[MVP]`. Scope Section 8.1: learn the AIS schema and field structure from publicly available real sample AIS data so synthetic data matches real-world format.

**What this stage is.** Obtaining publicly available real sample AIS data, studying its schema and field structure, and defining the project's **canonical AIS track representation** — the frozen shape of an `AIS track` as it exists inside this system.

AIS, the Automatic Identification System, is the transponder-based system by which ships broadcast their position, identity, course, and speed. A real AIS feed is a stream of position reports, each carrying at minimum a vessel identifier (the MMSI), a timestamp, latitude and longitude, and typically speed over ground, course over ground, heading, and static information about the vessel such as its type and dimensions. Real feeds are irregular: reporting intervals vary with vessel speed and receiver coverage, fields go missing, and identifiers are occasionally reused or spoofed.

The output of this stage is a canonical representation — an ordered sequence of position reports per vessel identifier, with a fixed field set, fixed units, and fixed timestamp format per the Stage 1 contract — plus a written record of which real-world fields it mirrors and which it omits. That written mapping is what makes the synthetic data defensible: it turns "we made up some ship tracks" into "we generated tracks conforming to the real AIS schema, here is the mapping."

The scope document is precise about the boundary, and it should not be exceeded: real sample AIS data is used **only to match format and structure**. Actual demo tracks are synthetically generated. This stage is not an attempt to source a real operational feed.

**Why this stage exists.** Every feature score in Part V is computed over this representation, and every one of them makes assumptions about it — Stage 33's dark-gap detection depends entirely on how reporting intervals and gaps are represented, Stage 32's integrity checks depend on speed and timestamp fields being well-defined, Stage 30's trajectory alignment depends on course being available or derivable. Fixing the representation once, against a real schema, is what allows six independent features to be built against it without colliding. It also directly serves the honesty theme: the closer the synthetic format is to the real one, the more credible the claim that plugging in a real feed requires no redesign — which is precisely the rehearsed answer the Risk Register prescribes.

**Inputs.** Publicly available real sample AIS data, used for format reference only. This is the first stage that touches AIS data of any kind. The Stage 1 contract, for timestamp and coordinate conventions.

**Outputs.** The canonical AIS track schema, registered into the Stage 1 interface contract, plus a written field-mapping document recording which real AIS fields are represented, which are omitted, and why. Consumed by Stage 27 (which generates conforming tracks), Stages 28 through 35 (which all read this representation), and Stage 47 (which renders vessels on the map).

**Dependencies.** Stage 1, for the conventions this schema must conform to and the contract it becomes part of. Independent of everything in Parts II, III, and IV — this stage could be built at any point, and is placed here because it is the first thing Part V needs.

**What "done" looks like.** A canonical track schema exists with fields, types, and declared units, registered in the interface contract; a sample of real AIS data has been parsed into it successfully, which is the concrete proof that the schema actually mirrors reality rather than a guess at it; and the field-mapping document records every real-world field that was deliberately omitted, so the omissions are decisions rather than oversights.

**Known limitations & caveats.** A schema learned from a sample captures structure, not the messiness of a real operational feed — irregular reporting intervals, receiver coverage gaps, duplicate and conflicting reports, and identity spoofing are properties of real data that a clean schema does not by itself reproduce. Stage 27's generator can deliberately reintroduce some of that messiness, and Stage 32 exists to handle a specific class of it, but the gap between "conforms to the real schema" and "behaves like real data" remains and is part of the standing synthetic-data disclosure.

**Where this could silently go wrong.** A canonical representation that is subtly cleaner than reality in a way that a downstream feature quietly depends on — for example assuming regular fixed-interval reporting. Stage 33's dark-gap feature is defined by the absence of reports, so a representation that implicitly assumes evenly-spaced reports makes gap detection trivial in synthetic data and structurally broken on real data, while every test passes.

---

### Stage 27 — Synthetic AIS Scenario Generator

With the canonical representation fixed, the system needs vessel traffic to reason about. This stage builds the generator that produces it — and it is a larger and more consequential piece of work than "make some fake ships" suggests, because it is simultaneously the demo's data source and the entire evaluation's ground truth.

**Tier:** `[MVP]`. Scope Section 8.1: generate synthetic AIS vessel tracks for the demo region and time window — normal background traffic plus one or more controllable "guilty vessel" tracks with course, speed, and timing consistent with the estimated origin window.

**What this stage is.** A parameterized generator producing conforming AIS tracks for a case's region and time window, comprising two populations. **Background traffic**: a realistic set of vessels transiting the region on plausible courses at plausible speeds, none of which is responsible for the spill. And one or more **planted guilty vessels**: tracks deliberately constructed so that the vessel passes through the origin window at the right time with a course and speed consistent with having discharged there.

The generator must be controllable along the axes that matter for evaluation. It needs to produce many independent scenarios rather than one — Stage 37 requires a batch of 30 to 50 — each with a known planted answer recorded as ground truth. It needs a difficulty control, because a scenario where the guilty vessel is the only ship within a hundred kilometres proves nothing, and the evaluation's credibility rests on background traffic being genuinely confusable with the guilty vessel. And per scope Section 11.2, it must be able to generate the **negative** case: scenarios where the true source is a platform or pipeline and **no guilty vessel exists at all**, which is what the false-implication check requires.

This stage owns realistic background behaviour: vessels following plausible lanes, appropriate speeds for their type, and reporting patterns consistent with the canonical representation. Stage 32 later extends the generator with deliberately implausible tracks; Stage 34 extends it with per-vessel historical behaviour profiles. Those extensions belong to their own stages, and this stage's job is the clean baseline that both build on.

**Why this stage exists.** It is the data source for the entire attribution half of the system, and — more importantly — it is the source of ground truth for every attribution metric the project reports. Stage 37's Top-1 and Top-3 hit rates are computable only because this generator knows which vessel it planted. That dual role is also precisely the limitation the scope document insists on disclosing, and it is stated in full below.

**Inputs.** The canonical track schema from Stage 26. The case manifest from Stage 2, for region and time window. The origin estimate from Stage 14, since the guilty vessel's track must be constructed consistently with the estimated origin window — which is what makes the scenario a meaningful test of the scorer rather than an arbitrary one.

**Outputs.** Per scenario: a set of conforming AIS tracks, plus a recorded ground-truth record naming which vessel (if any) was planted as guilty, and the scenario's parameters. Consumed by Stage 28 (filtering), Stages 29 through 35 (feature computation), Stage 37 (evaluation, which also reads the ground truth), Stage 47 (map rendering), and Stage 21's calibration check if the ensemble exists.

**Dependencies.** Stage 26, for the schema. Stage 14, for the origin window the guilty track is built around. Stage 2, for region and window. Note the ordering consequence: the generator depends on the hindcast, so attribution data generation cannot precede drift modelling any more than triage can.

**What "done" looks like.** The generator produces a batch of at least 30 to 50 independent scenarios, each with recorded ground truth, each conforming to the canonical schema and passing its validator. Both scenario classes exist: vessel-source scenarios with a planted guilty vessel, and non-vessel-source scenarios with no guilty vessel, for the false-implication check. Background traffic density and confusability are parameterized and documented rather than fixed at whatever looked reasonable, and at least one scenario is deliberately hard — multiple vessels plausibly near the origin window — because a batch of easy scenarios produces a hit rate that means nothing.

**Human Decision Gate.**

- **Show a human:** several generated scenarios rendered as maps — background traffic and the planted guilty vessel together, with the origin window overlaid — plus the difficulty parameters used to produce them.
- **The judgment:** whether the scenarios are genuinely hard. Two failure modes need a person's eye: a guilty track constructed to be geometrically optimal for the proximity and trajectory features rather than merely physically plausible, and background traffic too sparse or too distant to be confusable with it. Either one produces a near-perfect hit rate in Stage 37 that measures nothing but the generator's agreement with itself.
- **Proceed if:** at least one scenario is one where a person looking at the map could not immediately pick the guilty vessel out.
- **If not:** regenerate with denser and closer background traffic, and with guilty tracks offset and noised rather than laid along the hindcast path. Characterizing difficulty explicitly is already required by Stage 37's done-condition, and this is where that characterization is earned.

**Known limitations & caveats.** This is the single most important caveat in Part V, and it belongs to this stage more than to any other. Scope Section 11.2's v3 edit: *all of the attribution numbers are generated, scored, and validated using ground truth the team itself planted with the same feature logic being tested — a valid mechanism check, but not evidence the system generalizes to real, messy AIS data*, and this must be stated plainly next to those numbers on the evaluation slide, not only in the Risk Register. The Risk Register reinforces that this applies to the **whole of Stage D**, not to one feature, and prescribes the rehearsed framing: this validates the attribution mechanism against controlled ground truth, the same way any anomaly-detection or fraud-scoring system is validated before real deployment; plugging in a real AIS feed is the natural next phase and requires no redesign. Scope Section 14 lists the synthetic-AIS disclosure among the limitations stated openly in the final report, and Stage 40 requires that disclosure to appear in the dossier itself.

**Where this could silently go wrong.** Generating a guilty vessel using the same geometric assumptions the proximity and trajectory features are built on — for example, planting it exactly along the hindcast path — which makes those features trivially correct and inflates the hit rate to near perfection while measuring nothing but the generator's agreement with itself. Guilty tracks should be constructed to be *physically plausible* given the origin window, with realistic offsets and noise, not to be *mathematically optimal* for the scorer. The second failure is background traffic that is too sparse or too far away, which produces a high Top-1 rate that reflects an easy problem rather than a good scorer.

---

### Stage 28 — Space-Time Candidate Filtering

The generator produces all the traffic in the region. Most of it is irrelevant. This stage reduces that traffic to the set of vessels worth scoring at all, and it is the first stage where the origin window from Stage 14 is used to make a decision about ships.

**Tier:** `[MVP]`. Scope Section 8.2: filter out vessels whose tracks fall entirely outside the drift-estimated origin space-time window before scoring.

**What this stage is.** Testing every AIS track in the scenario against the **origin window** — the bounded geographic area paired with the bounded time interval from the origin estimate — and retaining only those tracks that intersect it in both space and time. Surviving tracks become **candidate vessels**; the rest are excluded from scoring entirely.

The word "entirely" in the scope document's phrasing is precise and should be implemented as written: a track is excluded only if it falls **entirely** outside the window. A vessel that passes through the window briefly and then leaves is a candidate. The filter is deliberately generous.

Two design points deserve care. First, filtering must be a genuine space-**time** intersection, not two independent tests: a vessel that was in the right place several days early is not a candidate, and testing space and time separately will keep it. Second, the window's extent should incorporate the origin estimate's spatial tolerance and, where the ensemble exists, the origin probability field from Stage 19 — filtering against a bare point discards the uncertainty the drift stages went to considerable effort to quantify, and it is the most likely way for a genuinely guilty vessel to be silently excluded before it is ever scored.

**Why this stage exists.** Practically, it reduces the scoring problem to a tractable set and keeps the ranked list meaningful — a suspect list containing every vessel in the region is not a lead list. Conceptually, it is the first place where the drift model's uncertainty either does or does not propagate into the attribution logic, which makes it a load-bearing point for the uncertainty-awareness differentiator even though it looks like plumbing.

**Inputs.** The AIS tracks for the scenario from Stage 27. The origin estimate from Stage 14, and the origin probability field from Stage 19 where it exists. The source hypothesis from Stage 23, which gates whether this stage runs at all.

**Outputs.** The set of candidate vessels — a subset of tracks, in the canonical representation, unchanged in shape — plus a record of how many tracks were considered and how many survived. Consumed by Stages 29 through 35 (every feature computes over candidates), Stage 31 (scoring), and Stage 47 (the map renders candidates, not all traffic).

**Dependencies.** Stage 27, for tracks. Stage 14, for the origin window. Stage 23, for the routing gate — this stage runs only on a vessel-permitting hypothesis, and that gate is what makes the false-implication check in Stage 37 testable. Stage 19 optionally, for a probability-field-aware window.

**What "done" looks like.** Given a scenario, the filter returns a candidate set that provably contains the planted guilty vessel — verified across the whole generated batch, not on one scenario — while excluding vessels that are demonstrably far outside the window in space or time. The retained and excluded counts are recorded per scenario, because a filter that retains nearly everything or nearly nothing is not doing its job and the counts are the only visible symptom. The space-time intersection is verified with a constructed case of a vessel in the right place at the wrong time, which must be excluded.

**Known limitations & caveats.** The filter can only be as good as the origin window, and it inherits every limitation of the hindcast: a window that is too tight because backward uncertainty was understated will exclude the guilty vessel before any feature is computed, and no downstream stage can recover from that. Erring toward a generous window is the right bias, since a false exclusion is unrecoverable while a false inclusion is merely a low-scoring candidate.

**Where this could silently go wrong.** Silently filtering out the true guilty vessel and then producing a confident, well-formed ranked list of innocent ones. Nothing about the output reveals the omission — the list looks exactly as it would if the guilty vessel had never been in the region. This is why the done-condition is stated as containment of the planted vessel across the batch: it is the only way to detect the failure, and it is detectable only because the ground truth is known.

---

### Stage 29 — Proximity Feature Score

With a candidate set established, feature computation begins. This is the first and most intuitive of the **feature scores**: how close, in space and time, did this vessel come to where and when the oil entered the water.

**Tier:** `[MVP]`. Scope Section 8.4 lists proximity as an `[MVP]` feature column feeding the scoring engine.

**What this stage is.** Computing, per candidate vessel, a single normalized score expressing the spatial and temporal closeness of that vessel to the estimated origin window.

The design work is in combining two different quantities into one number honestly. A vessel has a closest spatial approach to the origin, and it has a temporal offset between when it was there and the estimated origin time. These have different units and different tolerances, and the combination requires deciding how they trade off — whether a vessel very close in space but two hours off in time scores higher or lower than one further away but exactly on time. That trade-off is a documented modelling choice, not a detail, because it determines what the ranked list means. The origin estimate's own spatial tolerance and time window width are the natural scales to normalize against, which keeps the feature coupled to the drift uncertainty rather than to arbitrary constants.

The output must be a bounded, normalized value with a documented meaning at its extremes, because Stage 31 combines it with other features on a common scale and Stage 41 displays it to a human as evidence.

**Why this stage exists.** It is the most direct expression of the core suspicion: this vessel was there when it happened. It is also, being the most intuitive feature, the one an analyst will scrutinize first — which is exactly why it must be individually visible in the evidence breakdown rather than absorbed into a composite. That visibility is the explainable-attribution differentiator in its simplest form.

**Inputs.** The candidate vessels from Stage 28. The origin estimate from Stage 14, including its spatial tolerance and time window, and the origin probability field from Stage 19 where available.

**Outputs.** One normalized proximity score per candidate vessel, with the underlying raw quantities — closest approach distance and temporal offset — retained alongside it. Consumed by Stage 31 (baseline scorer), Stage 36 (extended scorer), Stage 41 (evidence breakdown), and Stage 40's `[MVP]` suspect list, which reports basic proximity and trajectory scores.

**Dependencies.** Stage 28, for candidates. Stage 14, for the origin window that defines closeness. Independent of Stage 30 — proximity and trajectory alignment are separate features computed over the same inputs and can be built in either order.

**What "done" looks like.** Every candidate receives a bounded proximity score whose extremes have documented meaning. On a constructed test, a vessel passing directly through the origin point at the origin time scores at or near the maximum, while a vessel at the far edge of the window scores near the minimum. The spatial-temporal trade-off is documented with its reasoning. Raw distance and time offset are retained, not just the normalized score, because the evidence breakdown in Stage 41 shows an analyst the underlying quantities rather than an abstract number.

**Known limitations & caveats.** Proximity is the feature most vulnerable to the evasion tactic the scope document singles out. Its v3 edit on Section 8.5 is explicit that proximity- and trajectory-only attribution is most vulnerable to exactly the tactic a genuinely guilty vessel is most likely to use — going dark on AIS before discharging — since such a vessel may not cleanly satisfy proximity matching at all. The dark-gap feature in Stage 33 is the direct mitigation and is tiered `[WORTH ADDING]`; until it exists, this is a disclosed limitation rather than an oversight. Proximity also inherits the origin window's uncertainty entirely: a poorly estimated origin makes every proximity score wrong together, in a way no amount of scoring sophistication can detect.

**Where this could silently go wrong.** A normalization scale chosen arbitrarily rather than against the origin estimate's tolerance, producing scores that are all clustered near the top or all near the bottom. The ranked list still has an order, and it looks fine, but the score has lost its ability to discriminate — and because ranking is preserved, the degeneracy is invisible unless the score distribution is inspected directly.

---

### Stage 30 — Trajectory Alignment Feature Score

Proximity asks whether a vessel was in the right place at the right time. This stage asks a harder and more discriminating question: was it moving the right way.

**Tier:** `[MVP]`. Scope Section 8.4 lists trajectory alignment as an `[MVP]` feature column.

**What this stage is.** Computing, per candidate vessel, a normalized score expressing how well that vessel's course aligns with the backward drift path — the trajectory the hindcast traced from the detected spill back to the estimated origin.

The underlying reasoning is what makes this feature valuable. If a vessel discharged oil while under way, the resulting slick is stretched along the vessel's track and then deformed by currents and wind. Running the drift backward retraces that deformation. A vessel whose course over the relevant interval runs along the backward drift path is consistent with having laid the slick down; a vessel that merely crossed the origin area perpendicular to the drift path is much less so, even if its proximity score is identical. This is why the two `[MVP]` features are genuinely complementary rather than two versions of the same signal, and it is why the elongation property computed back in Stage 9 is corroborating evidence for the same story.

This stage needs more than the origin point — it needs the backward drift **path** from Stage 14, not just its endpoint, which is a concrete reason Stage 14's output retains the trajectory rather than only the reduced origin estimate.

**Why this stage exists.** It is the feature that makes the `[MVP]` scorer meaningfully better than a nearest-neighbour lookup, and it is the one whose reasoning is most persuasive when explained to a human — an analyst reading "this vessel's course over the two hours before the estimated origin time ran along the reconstructed drift path" has been given an actual argument, not a number. That is the explainable-attribution differentiator doing what it exists to do.

**Inputs.** The candidate vessels from Stage 28, including their course and position history. The backward drift path from Stage 14. Optionally the elongation property from Stage 9 as corroborating context, though the score itself is computed from track and path geometry.

**Outputs.** One normalized trajectory alignment score per candidate, with the underlying geometric comparison retained for display. Consumed by Stage 31, Stage 36, Stage 41, and Stage 40's `[MVP]` suspect list.

**Dependencies.** Stage 28, for candidates. Stage 14, specifically for the drift path rather than only the origin estimate — this is the dependency most likely to be discovered late if Stage 14 emits only the reduced origin. Independent of Stage 29.

**What "done" looks like.** Every candidate receives a bounded alignment score with documented extremes. On constructed tests, a vessel travelling directly along the backward drift path scores near maximum and a vessel crossing it perpendicularly scores near minimum, with both cases verified explicitly, since the perpendicular case is the one that distinguishes this feature from proximity. The geometric comparison method — how course and path are compared, over what interval, and how the interval is chosen — is documented.

**Known limitations & caveats.** Alignment inherits the backward drift path's uncertainty, which is larger than the origin point's because the whole path is uncertain, not only its endpoint. In busy shipping lanes the discriminating power drops sharply, because vessels in a lane share a course by definition — so in exactly the high-traffic areas where attribution matters most, this feature is weakest. The same v3 disclosure from Stage 29 applies here in full: proximity- and trajectory-only attribution is the `[MVP]` tier's known vulnerability to a vessel going dark before discharging.

**Where this could silently go wrong.** An alignment measure that is insensitive to direction — scoring a vessel travelling exactly opposite to the drift path as highly as one travelling along it, because the comparison uses an unsigned angle. Both produce a high score, the ranked list looks reasonable, and the feature has silently lost half its meaning. The second failure is comparing over the wrong time interval: aligning a vessel's course at detection time rather than around the estimated origin time measures the wrong thing entirely while producing a perfectly well-formed number.

---

### Stage 31 — Baseline Weighted Scorer & Ranked Suspect List

Two features exist. This stage combines them into the object the rest of the system consumes: the ranked **suspect list**. It is deliberately the simplest possible combination, and the scope document is unusually specific about not overselling it.

**Tier:** `[MVP]`. Scope Section 8.5: combine proximity and trajectory alignment into one transparent, weighted score per vessel, output as a ranked list — *"explicitly not marketed as 'Bayesian belief propagation' or any technique more advanced than what is actually implemented and defensible."*

**What this stage is.** Combining the proximity and trajectory alignment feature scores into a single **suspicion score** per candidate vessel using a transparent weighted combination, and emitting the ranked **suspect list**: candidates ordered by suspicion score, each carrying its individual feature scores alongside the combined value.

Three properties are non-negotiable and each maps to something the scope document says directly.

**Transparent.** The combination is a stated weighting whose weights are written down and whose arithmetic can be reproduced by hand from the feature scores. Anyone should be able to check the total.

**Feature scores travel with the total.** The individual proximity and trajectory scores are part of the suspect list, not intermediate values discarded after summing. Scope Section 8.5's `[WORTH ADDING]` extension requires each vessel's individual feature scores to be visible rather than a single opaque number, and Stage 40's `[MVP]` dossier requirement already asks for the ranked list *with basic scores*. Building the `[MVP]` scorer so that the total is inseparable from its components is what makes both possible without rework.

**Described accurately.** The scope document's parenthetical is a naming instruction, and it is there to prevent an unforced error: this is a weighted sum of two features, it should be called that, and describing it in the language of a more sophisticated inference method invites a question the implementation cannot survive.

**Why this stage exists.** It is the minimum viable attribution: without it there is no ranked lead list and scope Stage D has no output. It also sets the architectural pattern that Stage 36 extends — one scoring engine consuming feature columns — which is why adding four more features later is an extension of this stage rather than a replacement of it.

**Inputs.** Proximity scores from Stage 29 and trajectory alignment scores from Stage 30, for every candidate from Stage 28.

**Outputs.** The ranked suspect list: candidates ordered by suspicion score, each with its combined score and its individual feature scores, conforming to the Stage 1 schema. Consumed by Stage 36 (which extends it), Stage 37 (evaluation), Stage 40 (the dossier's suspect list), Stage 41 (the full evidence breakdown), Stage 47 (map rendering), and Stage 50 (tier-based visual encoding).

**Dependencies.** Stages 29 and 30, for the features. Stage 1, for the suspect list schema — this object is consumed by the dossier and the interface as well as by later scoring stages, so its shape must be fixed before those are built against it. Stage 23, transitively, since the whole chain runs only on a vessel-permitting hypothesis.

**What "done" looks like.** A scenario produces a ranked suspect list in which each entry carries both its combined suspicion score and its individual feature scores, and the combined score can be reproduced by hand from the components using the documented weights. On the generated scenarios, the planted guilty vessel appears in the ranking — its position is Stage 37's business, but its presence is this stage's. Ties are handled by a defined, documented rule rather than by whatever order the data arrived in. The weights are documented with their rationale, and the scorer is described in code comments and in the report using language that matches what it actually does.

**Human Decision Gate.**

- **Show a human:** the ranked suspect list for a hard scenario with each vessel's individual proximity and trajectory scores visible, the documented weights, and a statement of whether those weights were adjusted after seeing scenario results.
- **The judgment:** whether the ordering is defensible from the visible evidence — reading the top three entries and their component scores and agreeing that the ranking follows from them — and whether both features are contributing at comparable strength rather than one dominating through a scale mismatch that the stated weights do not reflect.
- **Proceed if:** the ranking follows from the evidence on the page, and neither feature is inert.
- **If not:** rescale the features against the Stage 14 tolerance, as Stages 29 and 30 already prescribe. If weights were tuned against scenarios, that is disclosed, and the tuning is moved to a subset held apart from Stage 37's evaluation batch.

**Known limitations & caveats.** Two disclosures attach here directly. Scope Section 8.5's v3 edit, in full: proximity- and trajectory-only attribution is most vulnerable to exactly the evasion tactic a genuinely guilty vessel is most likely to use — going dark on AIS before discharging — since a vessel that does this may not cleanly satisfy proximity or trajectory matching at all; the dark-gap feature is the direct mitigation and is tiered `[WORTH ADDING]`, and until it is built this is a disclosed limitation, not an oversight. And the standing synthetic-data disclosure from Stage 27, which the Risk Register insists applies to the whole of scope Stage D rather than to any single feature.

**Where this could silently go wrong.** Weights chosen to make the planted guilty vessel rank first on the generated scenarios, which is fitting the scorer to its own test set — the hit rate in Stage 37 then measures the tuning rather than the method, and nothing in the output distinguishes the two. If weights are tuned against scenarios, that must be disclosed and ideally done on a subset held apart from the evaluation batch. The second failure is a scale mismatch between the two features — if one occupies a much narrower range than the other, the stated weights do not reflect the actual influence, and the scorer is effectively single-feature while appearing balanced.

---
### Stage 32 — Track Integrity Layer & Implausible-Track Injection

The baseline scorer trusts its input completely. This stage introduces the first form of scepticism about the AIS data itself, and it answers the most obvious objection to a system validated on data the team generated.

**Tier:** `[WORTH ADDING]`. Scope Section 8.3, which specifies both halves — deliberate injection of implausible tracks and a rule-based checker that flags and down-weights them.

**What this stage is.** Two halves that only make sense together. First, extending the Stage 27 generator to deliberately inject a small number of **implausible tracks** into scenarios: vessels with impossible speed or acceleration jumps, positions that teleport between consecutive reports, and similar physical impossibilities. Second, building a **rule-based integrity checker** — maximum realistic speed and acceleration per vessel class — that detects these before they reach scoring, and exposing its output as a reusable per-track **integrity score** that down-weights affected tracks.

The scope document's framing of why both halves belong together is the interesting part: *since AIS data is self-generated*, injecting known-bad tracks and then catching them is a way of demonstrating that the system does something real. It converts the synthetic-data weakness into a deliberate, controlled test — the team knows exactly which tracks are corrupt because it planted them, so the checker's performance is measurable rather than asserted.

Real AIS carries genuine integrity problems: receiver artifacts, transmission errors, duplicated identifiers, and deliberate manipulation. A checker built against synthetic corruption is not a full solution to that, but the rules it encodes — a vessel cannot travel at fifty knots, cannot accelerate instantaneously, cannot occupy two places at once — are the same rules a real integrity layer would apply.

The output is specified as a **reusable per-track integrity score** rather than a binary discard, and that word matters: a suspicious track is down-weighted, not deleted, so a vessel with imperfect data can still surface as a lead with its data quality visible.

**Why this stage exists.** It defends the scoring engine against garbage input, and it is a direct, demonstrable answer to "your data is synthetic, so how do you know any of this works" — the answer being that known-bad data was planted and the system caught it. That is a mechanism check with a measurable result, which is exactly the framing the Risk Register prescribes for the whole of scope Stage D.

**Inputs.** The canonical AIS tracks from Stage 27, extended with injected implausible tracks. Vessel class information from the canonical schema, since realistic speed and acceleration limits are class-dependent — a container ship and a fishing vessel have very different plausible envelopes.

**Outputs.** A per-track integrity score, retained as a named feature score alongside the others, plus a record of which tracks were flagged and which rule fired. Consumed by Stage 36 (the extended scorer, which incorporates it as a down-weighting factor), Stage 41 (the evidence breakdown, where data quality is part of the evidence), and Stage 37 as a measurable outcome.

**Dependencies.** Stage 27, for the generator being extended, and Stage 26, for the schema that defines the fields the rules operate on. Stage 36 is its principal consumer; the score exists before the extended scorer does, which is why this is a separate stage rather than part of Stage 36.

**What "done" looks like.** Scenarios contain deliberately injected implausible tracks whose identities are recorded as ground truth; the checker flags them at a measured rate that is reported as a number, not asserted; and the false-positive rate on normal background traffic is also measured, because a checker that flags everything is not a checker. Each rule's thresholds are documented per vessel class with their basis. A flagged track is demonstrably down-weighted rather than removed, verified by confirming it still appears in the suspect list with a reduced score.

**Human Decision Gate.**

- **Show a human:** the detection rate on the deliberately injected implausible tracks and the false-positive rate on normal background traffic, side by side, with the thresholds in force for each vessel class.
- **The judgment:** whether the balance between those two rates is acceptable. Thresholds loose enough to flag nothing produce a perfect false-positive rate and a useless checker; thresholds tight enough to flag legitimate high-speed vessels systematically down-weight an entire vessel class in every ranking. Only a person reading both rates against the classes actually present can make that call.
- **Proceed if:** both rates are acceptable and the per-class thresholds are justified.
- **If not:** this is `[WORTH ADDING]`. Adjust the per-class thresholds, or drop the feature — Stage 36's scorer is required to degrade gracefully when a feature is absent, so removal is a supported outcome rather than a breakage.

**Known limitations & caveats.** The checker is validated against corruption the team itself designed, which is the same circularity the Risk Register flags for the whole of scope Stage D and which should be disclosed in the same breath — catching your own planted anomalies proves the mechanism works, not that it catches the anomalies real data contains. Rule-based checking also catches only physically impossible behaviour; sophisticated manipulation that stays within a plausible envelope passes cleanly.

**Where this could silently go wrong.** Thresholds set so loose that nothing is ever flagged, which produces a perfect false-positive rate and a useless detector — and reads in a summary as "the integrity layer found no problems." The inverse is equally quiet: thresholds tight enough to flag legitimate high-speed vessels, systematically down-weighting a whole vessel class and quietly biasing every ranking against it. Reporting both detection rate and false-positive rate, as the done-condition requires, is what makes either visible.

---

### Stage 33 — Dark-Gap Feature & Dead-Reckoning Interpolation

This stage builds the direct mitigation for the vulnerability the scope document flags most prominently — the one the `[MVP]` scorer is explicitly known to be exposed to. It is the most investigatively interesting feature in the system.

**Tier:** `[WORTH ADDING]`. Scope Section 8.4, and named in both Section 8.5's v3 edit and Section 14 as the specific mitigation for the `[MVP]` tier's known weakness.

**What this stage is.** Detecting gaps in a vessel's AIS transmission — periods where the vessel stopped reporting — scoring them, and estimating where the vessel plausibly was during the gap.

Three components. **Gap detection**: identifying intervals in a track where reports are absent for longer than that vessel's normal reporting cadence would explain, which requires knowing what normal looks like for that vessel and that is a real subtlety rather than a fixed threshold. **Gap scoring**: the scope document specifies scoring by gap duration, gap location, and — the most incriminating factor — whether the vessel reappears near where the spill later occurred. A brief gap in a coverage-poor area is unremarkable; a long gap that begins near the origin window and ends just past it is not. **Dead-reckoning interpolation**: estimating a plausible position during the gap using the vessel's last known course and speed, made current-consistent where feasible by carrying the interpolated position along with the ocean currents from Stage 4's cached fields.

Dead reckoning is the classical navigation technique of projecting a position forward from a known position using known course, speed, and elapsed time. Making it current-consistent means acknowledging that a vessel is moving through water that is itself moving, which is a natural thing to do in this system because the current fields are already cached and already trusted for drift modelling.

**Why this stage exists.** The scope document's v3 edit on Section 8.5 states the problem exactly: proximity- and trajectory-only attribution is most vulnerable to the tactic a genuinely guilty vessel is most likely to use — going dark on AIS before discharging — because such a vessel may not cleanly satisfy proximity or trajectory matching at all. This is the feature that turns that evasion from a blind spot into a signal: a vessel that goes dark, and whose dead-reckoned position during the darkness passes through the origin window, becomes *more* suspicious rather than invisible. It is the strongest single argument for the explainable-attribution differentiator, because the reasoning is legible to a human in a way a model output is not.

**Inputs.** The candidate vessels from Stage 28, with their full reporting history including its irregularity. The origin estimate and origin window from Stage 14, for scoring whether a gap coincides with it. Cached ocean current fields from Stage 4, for current-consistent interpolation. The vessel's normal reporting cadence, which may be derived here or drawn from the behavioural profile built in Stage 34 where that exists.

**Outputs.** A per-candidate dark-gap feature score, plus the detected gaps with their durations and locations, plus dead-reckoned position estimates during each gap, explicitly labelled as estimates rather than as reported positions. Consumed by Stage 36 (extended scorer), Stage 41 (evidence breakdown, where the gap narrative is powerful evidence), and Stage 47 or Stage 50 if interpolated segments are rendered distinguishably on the map.

**Dependencies.** Stage 28, for candidates. Stage 14, for the origin window that gives a gap its significance. Stage 4, for current fields — a dependency that crosses from the drift half of the system into the attribution half, and one of the clearer illustrations that these are not two independent subsystems. Stage 26, since gap detection depends entirely on how reporting intervals are represented in the canonical schema.

**What "done" looks like.** Gaps are detected against a documented definition of what constitutes a gap for a given vessel, and the definition accounts for varying normal cadence rather than using one fixed threshold. The score demonstrably rises with gap duration, with gap proximity to the origin window, and with reappearance near the subsequent spill location, each verified on a constructed scenario. Dead-reckoned positions are produced and are marked in the data as interpolated, never as reported — this distinction must survive into the dossier and onto the map. A scenario in which the guilty vessel goes dark across the origin window is constructed and the feature fires on it, which is the specific end-to-end test that this stage does the job it exists for.

**Human Decision Gate.**

- **Show a human:** a scenario in which the guilty vessel goes dark across the origin window — the detected gap, the dead-reckoned positions during it, and exactly how those positions are marked relative to reported ones.
- **The judgment:** whether the interpolated positions are unmistakably distinguishable from reported ones, and whether the dead-reckoning error over that gap length is small enough for a point estimate to be published at all. This is the most consequential misrepresentation available anywhere in the system: an interpolated track through the origin window, read as observed evidence, manufactures apparent evidence against a specific named vessel.
- **Proceed if:** interpolated positions are clearly marked as estimates and the gap is short enough that the estimate means something.
- **If not:** score the gap without publishing a dead-reckoned position, or represent the position as a region rather than a point — the treatment this stage already names in its caveats — rather than shipping a point estimate whose error the presentation hides.

**Known limitations & caveats.** Real AIS gaps are extremely common and usually innocent — receiver coverage, equipment faults, and terrestrial-versus-satellite reception differences all produce them — so on real data this feature would generate substantial noise, and the synthetic setting makes it look cleaner and more decisive than it would be. Dead reckoning degrades quickly with gap length: a short gap yields a usable estimate, a long one yields a guess with a wide error that should be represented as a region rather than a point. Scope Section 14's disclosure that the `[MVP]` tier lacks this mitigation applies until this stage exists, and once it exists, the disclosure changes rather than disappears — the mitigation is present but validated only on synthetic data.

**Where this could silently go wrong.** Presenting a dead-reckoned position with the same visual and data weight as a reported one, so that an interpolated track through the origin window is read as observed evidence that the vessel was there. That is the most consequential misrepresentation the system could make, because it manufactures apparent evidence against a specific vessel. The second failure is a fixed gap threshold applied across vessel types with genuinely different reporting cadences, which systematically produces false gaps for slower-reporting classes and quietly biases the whole feature against them.

---

### Stage 34 — Behavioral Fingerprinting & Self-Anomaly Score

The features so far compare a vessel against the spill. This one compares a vessel against itself, which is a different kind of evidence and catches a different kind of behaviour.

**Tier:** `[WORTH ADDING]`. Scope Section 8.4: a per-vessel historical behaviour profile scored against how much the vessel deviates from its own normal pattern around the spill window.

**What this stage is.** Building a per-vessel behavioural profile — typical routes, typical speeds, typical courses — from that vessel's history, then computing a **self-anomaly score**: how much the vessel's behaviour around the spill window deviates from its own established pattern.

The distinguishing idea is in the word *self*. This is not asking whether the vessel behaved unusually compared to other vessels; it is asking whether it behaved unusually compared to itself. A vessel that always transits this lane at a steady speed and on this occasion slowed, deviated, and lingered near the origin window has done something notable, even though every individual observation is entirely normal for the region. Conversely, a vessel whose behaviour is erratic by nature is not made suspicious by more of the same. This is the standard shape of anomaly detection in fraud and monitoring systems, and it complements the spill-relative features precisely because it cannot be evaded by looking like everyone else.

This stage requires the Stage 27 generator to be extended: synthetic vessels need *histories*, not just tracks within the incident window, or there is no baseline to deviate from. That extension is substantive and belongs to this stage.

**Why this stage exists.** It adds an evidence axis that is independent of the drift model entirely — a self-anomaly score does not depend on the origin estimate being right, which makes it robust to exactly the failure that would corrupt proximity and trajectory alignment together. In an explainable evidence breakdown, "this vessel deviated from its own established pattern during the relevant window" is a distinct and persuasive line of argument alongside "it was in the right place" and "it went dark."

**Inputs.** Candidate vessels from Stage 28. Extended per-vessel history from the Stage 27 generator. The origin window from Stage 14, to define which interval counts as "around the spill window."

**Outputs.** A per-candidate behavioural anomaly score, plus the profile summary and the specific deviations that produced it, retained for display. Consumed by Stage 36 (extended scorer) and Stage 41 (evidence breakdown). Stage 33 may reuse the profile's reporting-cadence component for its gap definition.

**Dependencies.** Stage 27, extended with vessel histories — without that extension this stage has no baseline and cannot function. Stage 28, for candidates. Stage 14, for the window. Independent of Stages 32 and 33; the three `[WORTH ADDING]` features are parallel and can be built in any order.

**What "done" looks like.** Every candidate has a behavioural profile built from a documented history length, and an anomaly score computed against it. On a constructed scenario where the guilty vessel deviates sharply from its own established pattern near the origin window, the score fires; on a vessel behaving exactly as it always does, it does not, even when that vessel is near the origin. The profile and the specific deviations are retained in human-readable form, because "anomalous" without saying in what respect is not evidence.

**Human Decision Gate.**

- **Show a human:** the distribution of self-anomaly scores across all candidates in a scenario, and the behavioural profile and history length behind two of them.
- **The judgment:** whether the baseline is a pattern or noise. A profile built over too short a history makes nearly every vessel look anomalous — the scores are then all high, the feature contributes nothing to the ranking, and nothing in the output reveals it. The second thing to confirm is that the spill window itself was excluded from the baseline, since including it absorbs the very anomaly the feature exists to detect.
- **Proceed if:** the scores separate a genuinely deviating vessel from routine ones.
- **If not:** extend the history the profile is built from, or drop the feature — Stage 36 degrades gracefully without it, and the `[MVP]` scorer in Stage 31 remains the baseline.

**Known limitations & caveats.** The whole feature depends on synthetic vessel histories that the team designed, which makes the anomaly threshold a property of the generator rather than of real vessel behaviour — an even sharper version of the standing Stage D disclosure, since here both the normal and the anomalous behaviour were authored by the same hand. The scope document's Risk Register anticipates this being raised about behavioural fingerprinting specifically and insists the rehearsed answer cover the whole stage rather than this feature alone. Separately, real vessels legitimately change behaviour for many reasons — weather, chartering, port scheduling — so on real data this feature would need a substantially higher bar before it counted as evidence.

**Where this could silently go wrong.** A profile built over too short a history, making almost every vessel look anomalous because the baseline is noise rather than a pattern — the scores are then all high, the feature contributes nothing to ranking, and the degeneracy is invisible unless the score distribution is examined. The second failure is including the spill window itself in the baseline history, which absorbs the anomaly into the normal pattern and silently suppresses the very signal the feature exists to detect.

---

### Stage 35 — Historical Base-Rate Prior

The last feature is the smallest, and it brings the historical incident work from Part II back into the attribution scorer as a weak contextual signal.

**Tier:** `[STRETCH]`. Scope Section 8.4 lists it as a stretch feature, and Section 5.4 introduces the same idea as a stretch extension of the historical benchmark work: reuse the historical database as a minor base-rate prior in scoring.

**What this stage is.** Deriving a weak prior from the historical spill incident database — for example, that a particular lane or area has elevated historical spill frequency — and contributing it as a small-weight feature to the scoring engine.

The scope document's own words constrain this tightly: it is a **minor** prior, and the example given is region-level. It is context, not evidence about any particular vessel: knowing that a lane has a history of discharges slightly raises the plausibility that a discharge occurred there, but it says nothing about which ship did it.

**Why this stage exists.** It closes a loop opened in Stage 11 — the historical database sourced for benchmark validation gets a second use — and it adds a small amount of real-world grounding to a scorer that is otherwise entirely geometric. It is `[STRETCH]` because its contribution is genuinely marginal and because it carries a fairness risk that has to be managed deliberately, described below.

**Inputs.** Historical spill incident records (ITOPF, NOAA ERMA), already sourced in Stages 2 and 11. The candidate vessels from Stage 28 and the origin estimate from Stage 14, for locating the relevant region.

**Outputs.** A small-weight base-rate feature score per candidate, retained as a named, individually visible feature like every other. Consumed by Stage 36 and Stage 41.

**Dependencies.** Stage 11, or at least its historical sourcing, for the incident database. Stage 28 and Stage 14, for candidates and location. Stage 36, as its only real consumer — this feature has no meaning outside the extended scorer.

**What "done" looks like.** A base-rate value is derived from the historical database for the demo regions with a documented derivation, and it enters the scorer at a weight small enough that it cannot reorder the ranking on its own — verified by confirming that removing the feature changes scores but does not change the top of the ranking on the generated scenarios. It appears as a separately visible line in the evidence breakdown, so that its contribution is never hidden inside a total.

**Known limitations & caveats.** Historical spill records are records of *detected and reported* incidents, not of incidents, so the base rate reflects surveillance intensity and reporting practice as much as actual spill frequency. A busy, well-monitored lane will look worse than a poorly-monitored one for reasons that have nothing to do with how much oil is discharged there. This is a real bias and the reason the prior must stay minor.

**Where this could silently go wrong.** A prior weighted heavily enough to influence ranking, which means vessels are being ranked partly on where they happen to be rather than on anything they did — a fairness problem that is invisible in the output because the region-level contribution is identical across candidates in the same area and therefore looks like a harmless constant offset until it interacts with the other features near a ranking boundary. Keeping it visible as its own line in the evidence breakdown is the defence, since a reviewer can then see exactly how much of a vessel's score came from geography alone.

---

### Stage 36 — Extended Scorer, Confidence Tiers & Evidence Breakdown

Six feature scores now exist. This stage brings them into the one scoring engine, introduces the **confidence tier**, and completes the explainable-attribution differentiator by making the evidence, not the score, the primary output.

**Tier:** `[WORTH ADDING]`. Scope Section 8.5: extend the scorer to incorporate the dark-gap, behavioural, and integrity features once built, and output confidence tiers with each vessel's individual feature scores visible, not a single opaque number.

**What this stage is.** Extending the Stage 31 baseline scorer to consume every available feature — proximity, trajectory alignment, dark-gap, behavioural anomaly, track integrity, and the historical base rate where built — and to emit, per candidate: a combined suspicion score, a **confidence tier** of `High`, `Medium`, or `Low`, and the full set of individual feature scores.

Three design points carry the weight.

**Integrity is a modifier, not a peer.** The Stage 32 integrity score answers "how much should we trust this track's data," which is a different kind of question from "how suspicious is this vessel." Treating it as a down-weighting factor on the other features, rather than as another additive term, is what the scope document's phrasing — flag and *down-weight* — implies, and it avoids the perverse result where a vessel with corrupt data scores highly because its integrity term was low but its proximity term was high.

**Tiering is a communication decision.** Confidence tiers exist so that a human reads a category rather than over-interpreting the third decimal place of a score. Tier boundaries must be documented, and their meanings stated in words — what a `High` actually asserts, and specifically that it does not assert guilt.

**False positives are weighted more heavily than false negatives.** The scope document states the design intent directly: this is designed to minimize false positives given the real-world cost of wrongly accusing a vessel. In practice that means tier boundaries should be conservative — a vessel reaching `High` should be genuinely well-supported, and when the evidence is thin, the correct output is several `Medium` candidates rather than one confident `High`.

**Why this stage exists.** It is the completion of the explainable-attribution differentiator. Scope Section 3 describes it as *a transparent, multi-factor suspicion score per vessel with a visible evidence breakdown, not a black-box "top match"* — this is the stage where "multi-factor" and "visible" both become true. It also produces the object Stage 41's evidence breakdown and Stage 50's visual encoding both consume, so it is the pivot from computing evidence to communicating it.

**Inputs.** All available feature scores: proximity (Stage 29), trajectory alignment (Stage 30), integrity (Stage 32), dark-gap (Stage 33), behavioural anomaly (Stage 34), and base rate (Stage 35). The baseline scorer's structure and documented weights from Stage 31.

**Outputs.** The extended suspect list: per candidate, a suspicion score, a confidence tier, and every individual feature score, conforming to the same Stage 1 schema shape as the baseline list so nothing downstream has to change to accept it. Consumed by Stage 37 (evaluation), Stage 40 and Stage 41 (dossier), Stage 47 and Stage 50 (map).

**Dependencies.** Stage 31, which it extends — the baseline remains the fallback if the `[WORTH ADDING]` features are not built, and the extended scorer must degrade cleanly to it when a feature is absent rather than failing. Stages 32 through 35 for the features themselves, each of which is independently optional, which means the scorer must handle any subset of them being present.

**What "done" looks like.** The scorer consumes every built feature and produces a suspicion score, a confidence tier, and a complete individual feature breakdown per candidate. Removing any one feature degrades the scorer gracefully rather than breaking it, verified by running with each feature disabled in turn. Tier boundaries and their verbal meanings are documented. The combined score remains reproducible by hand from the components and the documented weights, exactly as in Stage 31 — extending the scorer must not cost transparency. The false-positive-conservative intent is demonstrable: a scenario with genuinely ambiguous evidence produces no `High` tier.

**Human Decision Gate.**

- **Show a human:** the tiered suspect list for a deliberately ambiguous scenario, with the tier boundaries and their stated verbal meanings, and each candidate's full feature breakdown.
- **The judgment:** whether the tiering is conservative in the direction the design brief requires — minimizing false positives given the real-world cost of wrongly accusing a vessel. The specific thing to catch is a `High` tier carried by one strong feature while the others sit neutral, which is invisible in any view that shows only the combined total.
- **Proceed if:** an ambiguous scenario yields several `Medium` candidates rather than one confident `High`, and no `High` rests on a single feature.
- **If not:** raise the tier boundaries. The Stage 31 baseline scorer remains available underneath, and the requirement that an absent feature scores as unavailable rather than as zero is worth re-checking at the same time, since it produces the same symptom.

**Known limitations & caveats.** The full standing Stage D disclosure applies here more than anywhere, because this is the stage whose output is most likely to be quoted: every feature and every weight is validated against ground truth the team planted using the same logic being tested. The Risk Register's rehearsed framing covers this exactly — it validates the attribution mechanism against controlled ground truth, the way any anomaly-detection or fraud-scoring system is validated before deployment, and a real AIS feed is the natural next phase requiring no redesign. Confidence tiers are also not calibrated probabilities, in the same sense as the look-alike confidence from Stage 8: `High` does not mean any particular percentage.

**Where this could silently go wrong.** An overconfident `High` tier on thin evidence — one strong feature carrying a vessel into the top tier while the others are neutral. That is precisely the false positive the design brief warns about, and it is invisible in a ranked list that shows only the total, which is the whole argument for the feature breakdown being mandatory rather than optional. The second failure is a feature that is absent being scored as zero rather than as unavailable: a vessel with no computed dark-gap score should not be penalized as though it had been checked and found clean.

---

### Stage 37 — Attribution Evaluation Harness

Part V closes the way Part II and Part III did — with numbers rather than assertions. The scope document identifies one of these numbers as the most important in the entire evaluation.

**Tier:** Untagged in source. Scope Section 11 requires every metric to be reported as an actual number in the final presentation, and Section 11.2 specifies these metrics precisely. This document does not assign evaluation stages a tier.

**What this stage is.** Running the full attribution pipeline over the batch of synthetic scenarios from Stage 27 — target 30 to 50, each with a planted guilty vessel — and reporting three results.

**Top-1 hit rate**: the fraction of scenarios in which the true guilty vessel is ranked first. **Top-3 hit rate**: the fraction in which the true guilty vessel appears anywhere in the top three ranked suspects. The scope document singles out Top-3 as *"the single most important number in the whole evaluation — it is what answers 'how do we know this isn't just working on the one example you're showing me.'"* Top-3 rather than Top-1 is the headline for a reason that reflects the product's positioning: the system produces a prioritized lead list for a human investigator, so the guilty vessel appearing among the first three leads is a success by design, and optimizing for rank-one alone would misstate what the tool is for.

**False-implication check**: running scenarios where the true source is a platform or pipeline and **no guilty vessel exists**, and confirming that triage correctly routes these away from vessel scoring rather than the scorer forcing out a false top suspect. This is the test of Stage 23's routing gate as much as of the scorer, and it is the quantitative evidence for the multi-hypothesis triage differentiator — without it, that differentiator is a claim rather than a measurement.

**Why this stage exists.** Scope Section 11 opens with the reason: a working demo on one case proves nothing by itself. This harness converts attribution from a demonstration into a measurement, and the false-implication check specifically converts the project's most ethically significant claim — that it will not manufacture a suspect when there is not one — from an intention into a number.

**Inputs.** The batch of synthetic scenarios and their recorded ground truth from Stage 27, including the non-vessel-source scenarios. The full attribution pipeline: Stages 28 through 31, and Stage 36 where built. Stage 23's routing gate, which the false-implication check exercises.

**Outputs.** Top-1 hit rate, Top-3 hit rate, and false-implication check results, with the scenario count, in a form ready for Stage 53. Consumed by Stage 53.

**Dependencies.** Stage 27, for scenarios and ground truth. Stages 28 through 31 for the `[MVP]` scorer, and Stage 36 where the extended scorer exists — in which case both sets of numbers are worth reporting, since the improvement from the `[WORTH ADDING]` features is itself a result. Stage 23, for the routing gate the false-implication check tests.

**What "done" looks like.** Top-1 and Top-3 hit rates are computed over at least 30 scenarios and reported with the exact scenario count alongside them. The false-implication check is run over non-vessel-source scenarios and reports how many produced no vessel suspect list, with any that did produce one investigated rather than averaged away — a single false implication is a finding, not a rounding error. Scenario difficulty is characterized, so a reader can tell whether a high hit rate reflects a good scorer or an easy batch. The harness is rerunnable, so the numbers track the current scorer rather than an earlier version.

**Human Decision Gate.**

- **Show a human:** the Top-1 and Top-3 hit rates with the exact scenario count, the false-implication results, and the difficulty characterization of the batch they were run on.
- **The judgment:** two things no metric can self-report. Whether the hit rate reflects a good scorer or an easy batch — which means reading the rate against the difficulty characterization rather than on its own. And, for any false implication at all, what caused it: a single false implication is a finding to investigate, not a rounding error to average away, because it is the one result that contradicts the multi-hypothesis triage claim directly.
- **Proceed if:** the hit rates come from a batch a person agrees was hard, and there are either no false implications or every one has been traced to a cause.
- **If not:** regenerate harder scenarios through Stage 27 and re-run. The disclosure required by scope Section 11.2's v3 edit stands beside these numbers either way — it is not contingent on the result.

**Known limitations & caveats.** The v3 edit on scope Section 11.2 applies in full and must appear next to these numbers rather than in a footnote: all of these figures are generated, scored, and validated using ground truth the team itself planted with the same feature logic being tested — a valid mechanism check, but not evidence that the system generalizes to real, messy AIS data. The Risk Register extends this to the whole of scope Stage D and prescribes the rehearsed answer for it, adding the instruction that matters most in practice: *do not let this be discovered live.* Stating it first is strictly better than being asked.

**Where this could silently go wrong.** A high Top-3 rate produced by scenarios that are too easy — sparse background traffic, or a guilty vessel constructed to be geometrically optimal for the features being tested. The number looks strong and measures the generator rather than the scorer, and nothing in the metric itself reveals this, which is why characterizing difficulty is part of the done-condition. The second failure is quietly excluding scenarios where the pipeline errored or produced no candidates, which inflates the rate by dropping exactly the cases most likely to be failures.

---
# Part VI — Integration & Service Layer

Parts II through V produce five bodies of logic that, so far, exist as separate things: a detector, a drift engine, a triage gate, a scoring pipeline, and the evidence they generate. This part is the seam where they become one callable system, and where the presentation layer gets something it can actually talk to.

It is a short part with an outsized role. The scope document's Risk Register names integration across parallel stage-owners as a distinct named risk — coordinate systems, timestamp formats, and the shape of shared objects drifting apart during parallel work — and Stage 1 is the preventive half of the answer to that risk. This part is the other half: the place where the contract is actually enforced at runtime, and where a violation of it becomes a visible error rather than a subtly wrong result.

---

### Stage 38 — REST API Surface

Every object the backend produces now has a defined shape. This stage exposes them over HTTP so that something other than a Python process can consume them.

**Tier:** Untagged in source. Scope Section 10.4 specifies the backend as a REST API (FastAPI or Flask) exposing endpoints such as `/detect`, `/triage`, `/drift`, `/attribute`, and `/report`, but does not tag it. It is a precondition for every `[MVP]` frontend stage. This document does not assign it a tier.

**What this stage is.** Implementing the REST service that fronts the pipeline, with an endpoint per pipeline stage as named in the scope document — detection, triage, drift, attribution, and reporting — each returning the corresponding object from the Stage 1 interface contract.

The important design property is that the endpoints return **contract objects, not endpoint-specific shapes**. `/detect` returns a detection record. `/drift` returns an origin estimate and a forecast track. `/triage` returns a source hypothesis. `/attribute` returns a suspect list. `/report` returns a dossier. There is no separate "API model" that reshapes these, because a second definition of the same object is exactly the drift the interface contract exists to prevent — and because the frontend types should be derivable from the same contract the backend validates against, so a mismatch is a build error rather than a runtime surprise.

Two behaviours need to be decided here rather than left to emerge. **The triage gate must be honoured at the API boundary**: calling `/attribute` for a case whose source hypothesis is `likely-platform` must return an explicit, structured "not applicable — non-vessel hypothesis" response rather than an empty suspect list, because an empty list and a list that was never generated mean different things and a client cannot distinguish them otherwise. And **optional features must be representable as absent**: when the ensemble, weathering, or the `[WORTH ADDING]` feature scores do not exist, the response must say so explicitly rather than omitting fields or defaulting them to zero — the distinction between "checked and found nothing" and "not checked" runs through this entire system and is easiest to lose at a serialization boundary.

**Why this stage exists.** It is the only route by which the narrative UI reaches any of the work in Parts II through V, and it is where the interface contract is enforced in practice. It also makes the pipeline inspectable stage by stage, which matters for a system whose selling point is explainability: being able to call `/triage` and see the source hypothesis and its evidence, independently of the report, is the difference between an explainable pipeline and one that merely produces an explanation at the end.

**Inputs.** The interface contract and schemas from Stage 1. The stage implementations from Parts II through V. The case artifacts from Stage 39, in the normal serving path.

**Outputs.** A running REST service with the five named endpoint families, returning contract-conforming objects, together with its own schema documentation. Consumed by every frontend stage from Stage 43 onward, and by Stage 39's orchestration.

**Dependencies.** Stage 1, definitively — the endpoints return contract objects, so the contract must exist first. The pipeline stages for the logic behind each endpoint, though the API can be built against the contract before all of them are complete, which is a genuine benefit of having frozen the contract early: the frontend can be built against a conforming stub.

**What "done" looks like.** Each endpoint returns an object that passes the Stage 1 schema validator, verified automatically rather than by inspection. The non-vessel path returns its explicit structured response and is tested. Absent optional features are explicitly represented as absent, and this is tested for at least one optional feature. Error responses are structured rather than raw stack traces. Frontend-facing types are derived from the same contract rather than restated by hand.

**Known limitations & caveats.** This is a demo-oriented service, not a production one: the scope document is clear that integration with any specific agency's real workflow or systems is out of scope for a student project, and that the decision-support positioning is a narrative and report-framing decision rather than an engineering commitment. Authentication, rate limiting, multi-user concurrency, and operational hardening are correspondingly out of scope, and should be described that way rather than as omissions.

**Where this could silently go wrong.** A response shape that drifts from the contract because a field was added to the API layer for convenience — the frontend then depends on a field the contract does not define, and the two definitions diverge in exactly the way Stage 1 exists to prevent, with no error anywhere until something downstream reads the wrong thing. The second failure is returning an empty suspect list on the non-vessel path, which a client will render as "no suspects found" when the truth is "no vessel search was performed," quietly erasing the multi-hypothesis triage differentiator at the last hop.

---

### Stage 39 — End-to-End Orchestration & the Case Artifact Store

The API can serve each stage. This stage makes the whole pipeline runnable as one thing, and — importantly for a live demo — makes its results precomputed rather than live-computed.

**Tier:** Untagged in source. Implied by scope Section 10.1's `[MVP]` requirement for curated, pre-verified demo cases, and by the Risk Register's mitigation that the default demo path uses those cases precisely because live computation on arbitrary input is unpredictable. This document does not assign it a tier.

**What this stage is.** Two related things. First, a runner that executes the full pipeline for a case in dependency order — detection, hindcast, forecast, triage, and then, conditionally on the routing gate, attribution and reporting — handling the conditional branch correctly so that a non-vessel hypothesis skips attribution rather than running it and discarding the result. Second, the **case artifact store**: the serialized, precomputed output of that run for each curated case, held so the demo serves stored results instead of recomputing.

The artifact store is what makes the demo robust. Segmentation inference, a drift simulation, and — if the ensemble exists — a hundred or more perturbed runs are not things to attempt live in front of an audience, and the Risk Register's guidance about curated cases being the safe path applies to computation as much as to input. Precomputing also makes the demo reproducible: the same case shows the same result every time, so a rehearsed walkthrough matches what happens.

The artifacts must be **contract-conforming and versioned**. Conforming, because they are served through the same API as live results and must be indistinguishable in shape. Versioned, because an artifact generated before a stage changed is stale, and a stale artifact is worse than a missing one — it silently shows old results while the code has moved on. A recorded provenance stamp, naming what produced each artifact, is what makes staleness detectable.

**Why this stage exists.** It is where five independently built stages first run together as one system, which is the moment integration problems actually surface. It is also the guarantee that the narrative UI has something complete and consistent to walk through: the guided flow in Part VIII sequences the reveal of *already computed* outputs, and that framing only works if a complete, consistent set of outputs exists per case.

**Inputs.** All pipeline stages from Parts II through V. The case manifest from Stage 2. The interface contract from Stage 1.

**Outputs.** A per-case artifact containing the complete pipeline output — detection record, origin estimate, forecast track, probability field where built, source hypothesis, suspect list where applicable, and dossier — with a provenance stamp. Consumed by Stage 38 for serving, by every frontend stage, and by Stage 53, which draws on complete runs when assembling the evaluation.

**Dependencies.** Stage 38, for the serving interface, and every pipeline stage for the logic. Stage 23 specifically for the conditional branch, which is the one piece of control flow the orchestrator must get right. Stage 2, for the case list.

**What "done" looks like.** Running the orchestrator over each curated case produces a complete artifact that passes contract validation for every object it contains. The conditional branch is verified in both directions: a vessel-hypothesis case produces a suspect list, and a non-vessel-hypothesis case produces an artifact with an explicit non-applicable attribution result rather than an empty one. Artifacts carry a provenance stamp identifying what generated them. Serving a case through the API returns the artifact's contents, and a full re-run reproduces the same result — non-reproducibility here indicates unrecorded state and should be resolved rather than tolerated.

**Human Decision Gate.**

- **Show a human:** one complete case artifact read end to end — detection record, origin estimate, forecast track, source hypothesis, suspect list and dossier — for a vessel case and for a non-vessel case.
- **The judgment:** whether the artifact tells one internally consistent story. Every object can pass its own schema validation while contradicting another: an age estimate that disagrees with the origin window, a source hypothesis whose confidence does not match the evidence printed beside it, a suspect list present on a case the routing gate should have diverted. This is the first point at which five independently built stages are visible together, and cross-stage coherence is not something the orchestrator can check for itself.
- **Proceed if:** both artifacts are coherent → they become the served case artifacts.
- **If not:** an inconsistency is a defect in the stage that produced it, flagged and fixed there rather than patched in the orchestrator — the operating principle this document already applies to itself.

**Known limitations & caveats.** Precomputed artifacts are a snapshot; any change to an upstream stage invalidates them, and there is no automatic mechanism proposed here for detecting that beyond the provenance stamp. The `[STRETCH]` upload path in Stage 51 deliberately bypasses this stage's protections, which is exactly why the Risk Register keeps it off the primary demo path.

**Where this could silently go wrong.** Serving a stale artifact after an upstream change — the demo shows results that no longer correspond to the code, and every number on screen is defensible-looking and out of date. This is particularly dangerous immediately after a fix, when the artifact still shows the bug. The second failure is an orchestrator that runs attribution regardless of the routing gate and filters the result afterwards, which produces correct-looking output while having silently disabled the multi-hypothesis triage behaviour that Stage 37's false-implication check is supposed to verify.

---

# Part VII — Reporting (scope Stage E)

Everything the system knows now exists as structured objects behind an API. This part turns them into something a human reads.

The scope document is emphatic about the boundary and it should be respected exactly: the dossier is *"a structured, auto-generated final report compiled from results already produced by Stages A–D. No new modelling — pure templating/presentation."* Nothing in this part computes, infers, or adjusts anything. If a number is needed and does not exist, that is a gap in an earlier stage, not a licence to derive it here.

This part is also where the **explainable attribution** differentiator becomes legible to an actual reader, and where the positioning that governs the whole project — decision support, not legal determination — is stated in writing rather than only in framing.

---

### Stage 40 — Dossier Assembly

This stage collects the outputs of every preceding pipeline stage into the investigator's dossier, in the structure the scope document specifies, with the positioning statement carried verbatim.

**Tier:** `[MVP]`. Scope Section 9 tags each element of the base dossier as `[MVP]`.

**What this stage is.** Compiling the **dossier** from the case artifact, with the sections the scope document enumerates:

- **Spill summary** — detection time and location, the indicative look-alike confidence from Stage 8, and the geometric property set from Stage 9.
- **Source hypothesis** — the label from Stage 23's fixed five-value set, with its Stage B confidence.
- **Drift summary** — the estimated origin window from Stage 14 and the forward forecast from Stage 15, including the time-to-coastline or time-to-sensitive-zone figure from Stage 16.
- **Suspect list, on the vessel path only** — the ranked candidates from Stage 31 with their basic proximity and trajectory scores, *alongside a stated disclosure that this reflects a synthetic-data validation.*
- **The positioning statement, verbatim, in every generated report** — the scope document's exact requirement, quoting the Section 2 framing: this is a decision-support lead list, not a legal determination.

Three details are load-bearing rather than cosmetic. The suspect list section appears **only on the vessel path**; a `likely-platform` dossier reports the stationary-source conclusion and contains no vessel section at all, which is the multi-hypothesis triage differentiator surviving to the last artifact rather than being quietly undone by a template that always has a suspects heading. The synthetic-data disclosure is required **in the report itself**, not only on the evaluation slide. And the positioning statement is required **verbatim in every generated report**, on every path, including non-vessel ones.

The look-alike confidence must be rendered with the wording discipline established in Stage 8: indicative, uncalibrated, never a precise statistical percentage. Where the ensemble exists, the origin should be described as a window with its stated containment level rather than as a point.

**Why this stage exists.** It is the system's actual deliverable — the artifact an analyst would take away. It is also where the uncertainty-awareness differentiator is either honoured or lost: every carefully hedged number from Parts II and III passes through this template, and a template that rounds them into confident assertions undoes all of it in one step.

**Inputs.** The complete case artifact from Stage 39: detection record, origin estimate, forecast track, landfall timing, source hypothesis, and suspect list where applicable. The verbatim positioning statement text.

**Outputs.** A structured dossier object conforming to the Stage 1 contract, renderable as an in-app report view. Consumed by Stage 41 (which extends it), Stage 42 (export), Stage 48 (the report view), and Stage 38's `/report` endpoint.

**Dependencies.** Stage 39, for a complete artifact — a dossier assembled from partial results is the most likely way for a field to be silently omitted. Stage 23, for the source hypothesis that determines the dossier's shape. Stages 8, 9, 14, 15, 16, and 31 for the content itself.

**What "done" looks like.** A dossier is generated for every curated case and contains every `[MVP]` element listed above. The positioning statement appears verbatim — character-for-character — in every generated dossier, verified on a non-vessel case as well as a vessel case. A non-vessel case produces a dossier with no suspect section. The synthetic-data disclosure appears in every dossier containing a suspect list. Confidence values are rendered with the indicative, non-percentage wording from Stage 8, and this is checked as an explicit item rather than assumed.

**Human Decision Gate.**

- **Show a human:** the rendered dossier for a vessel case and for a non-vessel case, read in full rather than spot-checked.
- **The judgment:** whether anything that was never computed is rendering as though it had been checked and found clean. A missing landfall time shown as a blank field reads as "no risk"; a missing confidence reads as no uncertainty at all. This is the last place the distinction between "checked and found nothing" and "not checked" can be lost, and the place where losing it does the most damage, because a reader treats the dossier as the finished answer.
- **Proceed if:** every absent value renders as an explicit absence, the positioning statement appears verbatim on both paths, and confidence wording is indicative rather than a percentage.
- **If not:** fix the template to render explicit absence — the behaviour this stage already specifies — rather than accepting a blank. Anything this surfaces that cannot be fixed belongs in Stage 54's ledger.

**Known limitations & caveats.** Every limitation from every upstream stage is inherited here, which is why scope Section 14's list of openly stated limitations exists and why Stage 54 assembles it as a single ledger. The most consequential for this stage specifically: detection confidence is uncalibrated and indicative; the `[MVP]` suspect list is proximity- and trajectory-only and is vulnerable to a vessel going dark; the AIS data is synthetic; and the drift accuracy figure rests on a single historical case.

**Where this could silently go wrong.** A template that renders a missing value as a blank or a zero rather than as an explicit absence — a missing landfall time shown as an empty field reads as "no risk," and a missing confidence reads as no uncertainty at all. This is the last place the "checked and found nothing" versus "not checked" distinction can be lost, and it is the place where losing it does the most damage, because the dossier is what a reader treats as the finished answer. The second failure is the positioning statement being paraphrased rather than reproduced verbatim, which is a direct departure from an explicit scope requirement and weakens the exact framing it exists to establish.

---

### Stage 41 — Full Evidence Breakdown & Alternative Hypotheses

The base dossier reports the ranking. This stage reports the reasoning — and it is the stage where the explainable-attribution differentiator is fully realized in the deliverable rather than only in the data model.

**Tier:** `[WORTH ADDING]`. Scope Section 9: full evidence breakdown per candidate including the dark-gap, behavioural, and integrity scores once built, plus listed alternative-hypothesis vessels, styled after how investigative and OSINT reports present a chain of evidence.

**What this stage is.** Extending the dossier so that each candidate vessel is presented with its complete evidence breakdown — every individual feature score from Stage 36, each named and explained, alongside the combined suspicion score and confidence tier — and so that **alternative-hypothesis vessels** are listed explicitly rather than silently dropped below a ranking cutoff.

The alternative-hypothesis listing is the more distinctive half and deserves emphasis. Reporting only the top suspect invites the reader to treat it as the answer. Presenting the leading candidate alongside the other plausible ones, with the evidence that separates them, presents an *investigation* rather than a *verdict* — which is precisely what the positioning statement in Stage 40 claims the system does, made structurally true rather than merely asserted.

The scope document's styling instruction is a substantive design instruction: styled after how investigative and OSINT reports present a chain of evidence. That means each score is accompanied by the underlying facts that produced it — this vessel's closest approach was this distance at this time; its AIS reporting ceased here for this duration and resumed here; its speed profile during this window departed from its established pattern in this way — rather than a bare table of normalized numbers. The raw quantities retained deliberately in Stages 29, 30, 33, and 34 exist for exactly this.

**Why this stage exists.** Scope Section 3 defines the differentiator as *a transparent, multi-factor suspicion score per vessel with a visible evidence breakdown, not a black-box "top match."* Stage 36 makes the breakdown available; this stage makes it visible to the person the system is built for. Without it, the system computes explainable attribution and then reports it opaquely, which forfeits the differentiator at the final step.

**Inputs.** The extended suspect list from Stage 36 with all feature scores and confidence tiers. The retained raw quantities from Stages 29, 30, 33, and 34. The integrity findings from Stage 32. The base dossier from Stage 40.

**Outputs.** An extended dossier with per-candidate evidence breakdowns and an explicit alternative-hypotheses section. Consumed by Stage 42 (export) and Stage 48 (report view).

**Dependencies.** Stage 40, which it extends rather than replaces — the base dossier remains complete and shippable without this. Stage 36, for the feature scores and tiers; where only the `[MVP]` scorer exists, this stage can still present proximity and trajectory with their raw quantities, which is a reduced but coherent version of the same idea.

**What "done" looks like.** Each candidate in the dossier shows every computed feature score individually, with the underlying raw quantity accompanying each, and features that were not computed are shown as not computed rather than as zero or absent. Alternative-hypothesis vessels are listed explicitly with their evidence. A reader with no prior context can follow why the top candidate ranks above the second — that is the concrete, checkable test of whether this stage succeeded, and it is best verified by having someone unfamiliar with the case read it and explain the ranking back.

**Human Decision Gate.**

- **Show a human:** the extended dossier for one case, handed to someone who has not seen that case and was not involved in building the scorer.
- **The judgment:** whether they can explain back why the top candidate ranks above the second. This stage's done-condition already states this as the test, and it is irreducibly human — a breakdown can contain every feature score and every raw quantity and still fail it, because comprehensive and legible are different properties. The second judgment is tonal: whether an evidence chain assembled with investigative styling reads as an investigation or as an accusation.
- **Proceed if:** the ranking is explicable from the page alone, and the page reads as a set of leads rather than a verdict.
- **If not:** this is `[WORTH ADDING]`. The Stage 40 base dossier is complete and shippable without it, so an unreadable breakdown is removed rather than shipped with the positioning statement doing all the work.

**Known limitations & caveats.** The evidence is only as meaningful as the synthetic data behind it, and the standing Stage D disclosure applies with particular force here because a detailed, well-presented evidence chain is far more persuasive than a bare score — the presentation quality must not outrun the evidential quality. Dead-reckoned positions from Stage 33 must remain visibly marked as estimates within the evidence chain; an interpolated position presented in the same visual register as a reported one is the most consequential misrepresentation available to this stage.

**Where this could silently go wrong.** A breakdown that is comprehensive and unreadable — every score present, none explained, which technically satisfies "visible evidence breakdown" while failing its purpose entirely. The second failure is a presentation that reads as an accusation: an evidence chain assembled with investigative styling, absent the positioning statement's framing, is exactly the "black-box top match with extra confidence" that the differentiator is defined against.

---

### Stage 42 — Polished Dossier Export

The final reporting stage makes the dossier portable — something that leaves the application rather than living only inside it.

**Tier:** `[WORTH ADDING]`. Scope Section 9: exportable as a clean, polished document or page — PDF or in-app report view — rather than a plain-text dump.

**What this stage is.** Rendering the dossier as a polished, self-contained document: correct typography, maps or figures where they aid comprehension, clear section structure, and — non-negotiably — every disclosure and the verbatim positioning statement carried through into the exported form.

The scope document's phrase "rather than a plain-text dump" sets the bar. This is the artifact that would be forwarded, printed, or attached to something, and it is the version most likely to be read by someone who never saw the interface, which makes it the version where the framing has to be most self-sufficient.

That last point drives the one real design constraint: the export must be **self-contained**. A dossier read outside the application has no map beside it, no confidence indicator in a sidebar, and no verbal framing from a presenter. Everything needed to interpret it correctly — the indicative-confidence wording, the synthetic-data disclosure, the n=1 drift caveat where the accuracy figure appears, and the positioning statement — has to be inside the document itself.

**Why this stage exists.** It is what makes the dossier an artifact rather than a screen, and it is the form in which the system's output would actually travel to a decision-maker. It also matters for the narrative UI differentiator in a subtle way: a guided investigation that terminates in a downloadable, well-made report has a proper ending, whereas one that terminates in a scrollable panel simply stops.

**Inputs.** The dossier from Stage 40, extended by Stage 41 where built. Map imagery or figures where included.

**Outputs.** A rendered, polished, self-contained document, and/or a polished in-app report view. Consumed by the end user directly, and by Stage 48, which presents it.

**Dependencies.** Stage 40, and Stage 41 where built. No pipeline stage depends on this, which makes it cleanly cuttable — a property worth preserving, since it is `[WORTH ADDING]` and the base dossier remains a complete deliverable without it.

**What "done" looks like.** A dossier exports to a polished document for every curated case, including the non-vessel path, and the exported document contains the verbatim positioning statement, the synthetic-data disclosure where a suspect list is present, and the indicative-confidence wording — verified in the exported artifact rather than only in the source object. The document is readable and correctly laid out without reference to the application. Content between the in-app view and the export does not diverge; if both exist, they render the same dossier object.

**Known limitations & caveats.** Export quality is presentation only and adds no evidential weight whatsoever — a well-formatted dossier is exactly as reliable as the pipeline behind it, and the risk that polish is read as rigour is real enough to be worth naming. All upstream limitations travel with the document, which is why they must be inside it.

**Where this could silently go wrong.** A disclosure that is present in the in-app view and lost in the export, because the two render through different paths — the exported document then reads as an unqualified finding, and it is the version most likely to be forwarded and least likely to be read alongside a caveat someone gave verbally. Rendering both from the same dossier object, and testing the exported artifact rather than the source, is the defence.

---
# Part VIII — Presentation Layer (scope Frontend)

The backend now computes everything and serves it. This part is where the system is finally seen — and it is where the fourth differentiator, the **narrative UI**, is the whole point rather than a supporting property.

The scope document is precise about the form: a linear, step-by-step guided flow, *not* a freeform dashboard, sequencing the reveal of pipeline outputs **already computed**. Built as a wizard with an optional back button, not full free navigation. That constraint is the design, not a limitation of it. A dashboard presents everything at once and leaves the viewer to assemble the argument; a guided flow presents the investigation in the order the reasoning actually runs — here is a spill, here is how confident we are it is a spill, here is where it came from, here is what kind of source that implies, and only then, here are the vessels. The interface is making the same argument the pipeline makes, in the same order, which is why the wizard's step order mirrors the dependency spine from Section 0.1 rather than the scope document's section numbering.

One reading of the source document should be flagged explicitly rather than assumed. Scope Section 10.1's `[MVP]` list covers the landing map, case selection, the camera transition, the spill polygon with its confidence indicator, the source-hypothesis indicator, the AIS candidate layer, and the report view. It does **not** list a drift-path or probability-cone map layer at `[MVP]`; drift visualization appears at `[WORTH ADDING]` in Section 10.2's dual-mode toggle and at `[STRETCH]` in Section 10.3's time-scrubbing animation. This document therefore places drift *rendering* at those tiers and treats the drift result as surfacing textually through the dossier at `[MVP]`. If the team intends an origin marker or drift path on the map at `[MVP]`, that is a scope-document clarification to make deliberately — per the source document's own principle, it is flagged here rather than guessed around.

---

### Stage 43 — Map Shell, Sidebar & Wizard State Machine

The first frontend stage builds the container everything else renders into, and the state machine that makes the flow guided rather than free.

**Tier:** `[MVP]`. Scope Section 10.1: landing state with an interactive world map (Mapbox GL JS) and a left sidebar panel; Section 10.4 specifies React with `useState`-based wizard flow, explicitly noting no Redux or Zustand is needed.

**What this stage is.** The application shell: an interactive world map as the primary surface, a left sidebar panel that carries the narrative text and controls for the current step, and the **wizard state machine** that governs which step is active, what each step is permitted to display, and how the flow advances.

The state machine is the substance of this stage. It defines the ordered sequence of steps, the transitions between them, whether a step is reachable given the current case's data, and the optional back button's behaviour. It must handle the **conditional branch** that runs through the whole system: a case whose source hypothesis is non-vessel skips the AIS candidate step entirely and moves from the hypothesis step to the report. That branch is Stage 23's routing gate expressed in the interface, and it is the same gate enforced at the API boundary in Stage 38 — three expressions of one rule, which is exactly why the rule was frozen into the contract as a fixed label set.

The scope document's state-management note is a deliberate scoping decision worth honouring: a linear wizard over precomputed per-case data does not need a state library, and adding one would be complexity without benefit.

**Why this stage exists.** It is the skeleton of the narrative UI differentiator. The guided sequence *is* the product's presentation argument, and the state machine is that sequence made concrete. Building it first, before any individual step's content, is what keeps the flow coherent instead of emerging from whichever steps happened to be built.

**Inputs.** The API surface from Stage 38 for data, and the case artifacts from Stage 39. Mapbox GL JS. The frontend types derived from the Stage 1 contract.

**Outputs.** A running application shell with a working step sequence, into which Stages 44 through 52 render their content. Consumed by every subsequent frontend stage.

**Dependencies.** Stage 38, for the API — though the shell can be built against contract-conforming stub data, which is a real benefit of the contract having been frozen in Stage 1 and worth using rather than blocking. Stage 1, for the frontend types. Stage 23's label set, for the conditional branch logic.

**What "done" looks like.** The shell renders a world map with a sidebar; the wizard advances through its defined steps in order and the back button returns to the previous step without losing state; the conditional branch is verified in both directions, with a non-vessel case demonstrably skipping the AIS step and a vessel case passing through it. Steps that lack data are unreachable rather than rendering empty. No global state library has been introduced.

**Known limitations & caveats.** The wizard is deliberately not free navigation, per the scope document — arbitrary jumping between steps is out of scope, not missing. The interface is built for the curated-case path; the `[STRETCH]` upload path in Stage 51 introduces a state the wizard otherwise never encounters, namely a case whose data does not yet exist, and if that path is pursued the state machine must accommodate it.

**Where this could silently go wrong.** A step advancing before its data has loaded, rendering an empty panel that reads as "nothing was found" rather than "not loaded yet" — the same "checked and found nothing" versus "not checked" confusion that runs through the whole system, appearing here as a race condition. The second failure is the conditional branch being implemented as hiding the AIS step rather than skipping it, which leaves the step in the sequence and produces a visible empty state on non-vessel cases.

---

### Stage 44 — Curated Case Selection & Guided Camera Transition

With the shell in place, the flow needs its opening move: choosing a case, and travelling to it.

**Tier:** `[MVP]`. Scope Section 10.1: a dropdown of 2–3 curated, pre-verified demo cases, explicitly noted as safer for a live demo than arbitrary live upload; and an animated camera transition zooming from world view into the selected spill's region.

**What this stage is.** The case selection control and the animated `flyTo` transition that follows it. The dropdown lists the curated cases from Stage 2's manifest, each labelled meaningfully — including the ground-truth anchor, whose status as a real documented historical incident is worth surfacing in the label, since it is the case that carries the project's drift accuracy number.

The camera transition is a narrative device rather than decoration. Starting at world view and flying into the region establishes the scale of the problem — a satellite-scale search collapsing to a specific patch of ocean — before any detail appears. It is the interface's opening sentence.

The scope document's reasoning for the dropdown belongs in this stage rather than as a caveat on it: curated cases are safer for a live demo than arbitrary upload, and this is the Risk Register's pre-agreed mitigation for unknown model behaviour on out-of-distribution imagery. The dropdown is the mitigation, not a placeholder for a more ambitious control.

**Why this stage exists.** It is the entry point to the guided flow and the mechanism by which the demo stays on rails. It also carries a quiet obligation from Stage 2: the ground-truth anchor must be present and selectable, because it is the case that demonstrates the drift accuracy claim.

**Inputs.** The case manifest from Stage 2, served through Stage 38. The case artifacts from Stage 39. The wizard shell from Stage 43.

**Outputs.** A selected case identifier that the wizard carries through every subsequent step, and a completed camera transition to the case region. Consumed by every subsequent frontend stage, all of which render that case's artifact.

**Dependencies.** Stage 43, for the shell and state machine. Stage 2, for the cases. Stage 39, for the artifacts that make each case selectable — a case listed in the dropdown without a corresponding artifact is a dead end.

**What "done" looks like.** Two to three curated cases are listed, each selectable, and the ground-truth anchor is among them and identifiable. Selecting a case triggers a smooth transition ending framed on the case region at a zoom level where the spill polygon will be legible. The selected case propagates correctly to every downstream step, verified by checking that the detection, hypothesis, and report steps all show data for the selected case rather than for a default.

**Known limitations & caveats.** Only curated cases are supported here by design; arbitrary upload is `[STRETCH]` (Stage 51) and, per the Risk Register, never the primary demo path. The number of cases is small, which is a deliberate scoping choice rather than a limitation to apologize for.

**Where this could silently go wrong.** A transition that ends at a zoom level where the spill polygon is either invisible or fills the frame, which quietly ruins the reveal in Stage 45 — and which will only be noticed when the polygon is actually rendered, potentially long after this stage is considered finished. Framing the transition against real polygon extents rather than a fixed zoom constant is the defence. The second failure is a case selection that does not fully reset prior state, leaving a previous case's layers visible over the new one.

---

### Stage 45 — Detection Layer & Look-Alike Confidence Display

The camera has arrived. This is the first reveal: the spill itself, and — inseparably — how confident the system is that it is a spill.

**Tier:** `[MVP]`. Scope Section 10.1: the detected spill polygon overlaid as a GeoJSON layer once zoomed in, *including its look-alike-confidence indicator.*

**What this stage is.** Rendering the **spill polygon** from the detection record as a GeoJSON layer on the map, together with the **look-alike confidence** indicator and the geometric property set in the sidebar.

The scope document binds the polygon and the confidence indicator together in a single `[MVP]` requirement, and that pairing is the point rather than a convenience: the interface never shows a detection without simultaneously showing how much to trust it. This is the uncertainty-awareness differentiator at its most visible, and it is the moment where the discipline established in Stage 8 either survives into the product or quietly does not.

The wording discipline from Stage 8 applies here without exception: indicative, uncalibrated, never a precise statistical percentage. An interface element reading "94% confident" contradicts an explicit scope-document instruction and hands a viewer exactly the objection the framing exists to pre-empt. A qualitative band, or a number explicitly labelled as indicative, is the correct treatment. The sidebar at this step also carries the geometric properties from Stage 9 — area, distance to coastline, elongation — which is where the detection becomes an incident with a magnitude rather than a shape on a map.

**Why this stage exists.** It is the payoff of the entire detection pipeline and the first substantive step of the narrative. It is also the interface's first opportunity to establish the honest register the rest of the flow depends on: a system that shows its uncertainty at step one has earned more trust when it later ranks vessels.

**Inputs.** The detection record from the case artifact: spill polygon, look-alike confidence, and geometric property set, served through Stage 38.

**Outputs.** A rendered map layer and a populated sidebar panel for the detection step. Consumed visually; Stage 49's dual-mode view and Stage 50's vessel encoding render alongside this layer, so its visual weight must leave room for them.

**Dependencies.** Stage 44, for the case and camera position. Stage 7, transitively, for the polygon, and Stage 8 for the confidence. Stage 43, for the step in the wizard. Stage 1, for the coordinate order the map depends on — GeoJSON requires longitude first, and this is the stage where a contract violation becomes visible as a polygon in the wrong hemisphere.

**What "done" looks like.** The spill polygon renders in the correct geographic location, correctly shaped, at a zoom level where it is legible. The confidence indicator is present in the same view, worded as indicative and not as a precise percentage — verified as an explicit check, since it is a wording requirement rather than a functional one. Geometric properties appear in the sidebar with units. The layer renders without noticeable lag, which depends on the vertex-count bound set back in Stage 7.

**Human Decision Gate.**

- **Show a human:** the detection step exactly as it renders — spill polygon on the map at the case location, confidence indicator in the same view, geometric properties in the sidebar.
- **The judgment:** whether the polygon is legible at the zoom the flow actually arrives at, and whether the confidence indicator reads as indicative rather than as a precise measurement. The wording is a scope-document requirement that no functional test catches, and the framing problem originates a step earlier in Stage 44's camera transition, which is only visible here.
- **Proceed if:** the polygon is legible in the correct place and the confidence is worded as indicative.
- **If not:** frame the Stage 44 transition against real polygon extents rather than a fixed zoom constant, as that stage already prescribes; and replace any precise percentage with a qualitative band or an explicitly-labelled indicative value, per Stage 8.

**Known limitations & caveats.** The polygon is the model's belief, not a measurement, and the confidence attached to it is uncalibrated per scope Section 14 — both of which are the reason the indicator is beside it rather than in a footnote. The polygon's boundary precision is limited by the segmentation and by the simplification applied in Stage 7.

**Where this could silently go wrong.** A confidence indicator rendered as a precise percentage, which is a direct contradiction of the scope document's instruction and is a wording failure that no functional test will catch. The second failure is a polygon rendered from a coordinate array in the wrong order, which produces a valid, well-styled layer somewhere entirely wrong — visually obvious only if someone checks that the location matches the case, which is why the done-condition names the location rather than the rendering.

---

### Stage 46 — Source-Hypothesis Step & UI Routing Gate

The spill is on screen. Before the interface goes looking for ships, it does what the pipeline does: it asks what kind of source this is. This step is the multi-hypothesis triage differentiator made visible.

**Tier:** `[MVP]`. Scope Section 10.1: source-hypothesis indicator shown at this stage before proceeding to vessel search, only if relevant.

**What this stage is.** Presenting the **source hypothesis** from Stage 23 — the label, its confidence, and the evidence behind it — as its own step in the guided flow, positioned deliberately *before* any vessel content appears, and implementing the routing gate in the interface: a non-vessel hypothesis ends the investigative branch here and proceeds to the report, while `likely-vessel` or `insufficient-evidence` proceeds to the AIS step.

The step's position in the sequence is the argument. A viewer watching the flow sees the system consider stationary sources before it considers ships, which communicates the differentiator far more effectively than a sentence in a report claiming it does. When the hypothesis is `likely-platform` or `likely-pipeline`, the step should show *why* — the matched infrastructure and its distance from the origin, from Stage 22 — so the conclusion is legible rather than asserted.

The `insufficient-evidence` case needs deliberate treatment. It proceeds to vessel search, but per scope Section 6 it is shown as low-confidence, and the interface must carry that qualification into the following step rather than letting the flow's momentum imply a firm vessel determination.

**Why this stage exists.** Scope Section 3 lists multi-hypothesis source triage as one of the four differentiators, and this step is the only place a viewer actually sees it happen. Without it, the interface would proceed from spill directly to suspects, and the triage logic — however well built — would be invisible in the product.

**Inputs.** The source hypothesis from Stage 23 with its confidence and evidence, and the proximity result from Stage 22, served through Stage 38.

**Outputs.** A rendered hypothesis step and the branch decision that determines the next step. Consumed by Stage 43's state machine for routing, and by the viewer.

**Dependencies.** Stage 43, for the state machine that implements the branch. Stage 23, for the hypothesis and the frozen label set — the interface matches on those exact label strings, which is the third consumer of that fixed set after the router and the dossier, and the reason a mismatch is a three-way failure. Stage 45, for step order.

**What "done" looks like.** Every case shows a hypothesis label with its confidence at this step. A non-vessel case demonstrably ends the vessel branch and proceeds to the report with no AIS step shown. A vessel case proceeds. An `insufficient-evidence` case proceeds while displaying its low-confidence qualification, and that qualification remains visible on the following step. Where a stationary source was matched, the matched infrastructure and its distance are shown.

**Known limitations & caveats.** The hypothesis inherits everything from Stage 22 and Stage 5 — particularly that absence of nearby infrastructure is weak evidence, because public coverage may be incomplete (scope Section 14). The interface should not present `likely-vessel` with more visual confidence than the underlying evidence supports, and a `likely-vessel` conclusion that rests on an empty infrastructure dataset is exactly the case where a strong visual treatment would mislead.

**Where this could silently go wrong.** Rendering `likely-vessel` as a definitive finding rather than as a hypothesis with a confidence, which converts a triage step into an accusation and undoes the framing at the exact moment the flow is about to show vessels. The second failure is the interface's branch logic diverging from the API's — the interface showing the AIS step while the API returns the non-applicable response, producing an empty vessel layer that reads as "no suspects found."

---

### Stage 47 — AIS Candidate Vessel Layer

On the vessel branch, the flow reaches the ships. This stage renders them.

**Tier:** `[MVP]`. Scope Section 10.1: AIS candidate-vessel layer rendered as points on the map, shown only when Stage B indicates a vessel hypothesis, and explicitly *static, non-animated for MVP.*

**What this stage is.** Rendering the **candidate vessels** — the filtered set from Stage 28, carrying the suspicion scores from Stage 31 — as points on the map, with the ability to inspect an individual vessel's identity and its feature scores.

Two constraints from the scope document are explicit and should be held. The layer appears **only on a vessel hypothesis**, which is the routing gate reaching its third and final expression in the interface. And it is **static and non-animated at `[MVP]`** — animation belongs to the `[STRETCH]` time-scrubbing work in Stage 52, and building movement into this layer prematurely would pull `[STRETCH]` complexity into an `[MVP]` step.

What is rendered here is the candidate set, not all traffic in the region. That is the correct choice — the filtered set is the investigative shortlist and showing everything would obscure it — but it means the step should make clear that filtering occurred, so a viewer understands the points are a selection rather than the totality of what was in the water.

At `[MVP]` the points are undifferentiated; visual encoding by suspicion tier is `[WORTH ADDING]` and is Stage 50. Selecting a vessel should surface its feature scores individually, which is the explainable-attribution differentiator appearing on the map rather than only in the report.

**Why this stage exists.** It is where the investigation becomes concrete for the viewer — the abstract origin window resolves into specific ships. It also sets up the report step: by the time the dossier appears, the viewer has already seen the candidates on the map, so the ranked list reads as a summary of something they watched rather than as a conclusion delivered from nowhere.

**Inputs.** The candidate vessels from Stage 28 with their suspicion scores and feature scores from Stage 31, or from Stage 36 where the extended scorer exists, served through Stage 38.

**Outputs.** A rendered vessel point layer with per-vessel inspection. Consumed by Stage 50, which encodes it by tier, and by Stage 52 if the `[STRETCH]` animation is built.

**Dependencies.** Stage 46, for the branch that gates this step. Stage 28 and Stage 31, for the candidates and their scores. Stage 43, for the wizard step.

**What "done" looks like.** Candidate vessels render as points in correct geographic positions on a vessel-hypothesis case, and the layer is absent entirely on a non-vessel case. Selecting a vessel shows its identity, its suspicion score, and its individual feature scores. The layer is static, with no animation. The step communicates that these are filtered candidates rather than all traffic.

**Human Decision Gate.**

- **Show a human:** the vessel layer as rendered, including any dead-reckoned positions from Stage 33 displayed alongside reported ones.
- **The judgment:** whether a viewer can tell interpolated positions from observed ones at a glance. Stage 33's gate covers the marking in the data; this is the separate question of whether that marking survives into the visual, which is where the misreading is most persuasive and least likely to be questioned. The second check is whether the step makes clear these are filtered candidates rather than all traffic in the region.
- **Proceed if:** interpolated segments are visually distinct and the filtering is communicated.
- **If not:** render dead-reckoned segments differently, or omit them from the map entirely — Stage 33's fallback of scoring the gap without publishing a position applies here in the same form.

**Known limitations & caveats.** The vessels are synthetic (scope Section 14), and the interface should not imply otherwise — the disclosure required in the dossier by Stage 40 applies to what is shown here too, and a demo that shows convincing vessel tracks without noting they are generated invites exactly the discovery the Risk Register says must not happen live. Where Stage 33's dead-reckoned positions are shown, they must be visually distinguishable from reported positions.

**Where this could silently go wrong.** Rendering interpolated dead-reckoned positions identically to reported ones, so a viewer reads an estimated track through the origin window as observed evidence — the single most consequential visual misrepresentation the system can make, and the map is where it is most persuasive. The second failure is an empty layer on a vessel-hypothesis case reading as "no suspects" when the real cause is a filtering or loading failure.

---

### Stage 48 — Dossier Report View

The guided flow ends where the pipeline ends: with the dossier.

**Tier:** `[MVP]`. Scope Section 10.1: final report view or panel rendering the Stage E dossier.

**What this stage is.** The terminal step of the wizard, rendering the **dossier** from Stage 40 — extended by Stage 41 where built — inside the application, with the export from Stage 42 available where that exists.

This step is the interface's closing argument, and its content is entirely determined by Stage 40: spill summary with indicative confidence, source hypothesis, drift summary including the origin window and landfall timing, the ranked suspect list on the vessel path with its synthetic-data disclosure, and the verbatim positioning statement. This stage renders, it does not re-derive — the same "no new modelling" discipline that governs Part VII governs this view, extended to mean no re-formatting of numbers into forms the dossier did not state.

It is also the step that must work identically on both branches. A `likely-platform` case reaching this step directly from the hypothesis step must produce a complete, coherent report about a stationary source — not a vessel report with an empty suspects section. That is the multi-hypothesis differentiator surviving all the way to the last screen.

**Why this stage exists.** It closes the narrative. The guided flow has walked the viewer through detection, uncertainty, origin, source type, and candidates; this step assembles that walk into a single artifact they can read, take away, and act on. Without it the flow simply stops on a map.

**Inputs.** The dossier from Stage 40, extended by Stage 41 where built, served through Stage 38's `/report` endpoint. The export from Stage 42 where built.

**Outputs.** A rendered report view, and access to the exported document. Consumed by the viewer.

**Dependencies.** Stage 40, for the dossier. Stage 43, for the terminal wizard step. Stage 46, since both branches converge here and both must render correctly.

**What "done" looks like.** The report view renders the complete dossier for every curated case on both branches. The positioning statement appears verbatim in the view. The synthetic-data disclosure appears wherever a suspect list does. Confidence values are rendered with the indicative wording from Stage 8, unchanged from the dossier object. A non-vessel case produces a complete report with no vessel section and no empty placeholder. Where Stage 42 exists, the exported document and the in-app view show the same content.

**Known limitations & caveats.** Every upstream limitation is inherited and displayed here, which is the intent — this is the surface where scope Section 14's disclosures are supposed to be visible rather than filed away. The report view is a rendering of the dossier and cannot be more reliable than it.

**Where this could silently go wrong.** A view that renders the dossier's fields but drops its disclosures, because disclosures are prose rather than data and are easy to omit from a field-mapped template. The result is a clean report that has quietly shed exactly the framing the scope document requires in every generated report. Rendering the disclosure text as part of the dossier object rather than as view-layer decoration is the defence.

---

### Stage 49 — Dual-Mode Attribution / Forecast Drift View

The `[MVP]` flow answers where the oil came from and who might be responsible. This stage adds the second axis — where it is going — and gives the drift work its visual expression.

**Tier:** `[WORTH ADDING]`. Scope Section 10.2: a toggle or second tab, "Where did it come from" (attribution mode) versus "Where is it going" (forecast mode), both driven by the same drift engine output.

**What this stage is.** A mode toggle that switches the map between two views of the same drift computation. **Attribution mode** renders the backward picture: the hindcast path from Stage 14, the origin estimate, and — where the ensemble exists — the **probability cone** from Stage 19 with its stated containment level. **Forecast mode** renders the forward picture: the forecast track from Stage 15 or its weathering-enabled form from Stage 17, the predicted spread, and the landfall or sensitive-zone crossing from Stage 16.

The scope document's phrasing — *both driven by the same drift engine output* — is the conceptual point and is worth surfacing in the interface itself. The same physics, run in two directions, answers the investigative question and the response question. That duality is the clearest possible illustration that the drift engine is the system's spine rather than one feature among several.

This is the stage where the probability cone becomes visible, which makes it the strongest visual expression of the uncertainty-awareness differentiator available in the `[WORTH ADDING]` tier. The containment level must be stated wherever the cone is drawn, per Stage 19 — a cone without a stated level communicates confidence without content.

**Why this stage exists.** It completes the narrative by adding the operational half: a pollution-response analyst needs the forecast as much as an investigator needs the origin. It also gives Part III's ensemble work somewhere to be seen; without this stage the probability field exists only as a number in the dossier, which substantially undersells the project's most technically demanding component.

**Inputs.** The origin estimate and backward path from Stage 14, the origin probability field from Stage 19 where built, the forecast track from Stage 15 or Stage 17, and the landfall timing from Stage 16 — all served through Stage 38.

**Outputs.** Two rendered map modes with a toggle between them. Consumed by the viewer, and by Stage 52 if the `[STRETCH]` animation extends forecast mode.

**Dependencies.** Stage 43, for the shell. Stages 14 and 15 for the deterministic drift results, which are sufficient for a working version of this stage. Stage 19 for the cone, which upgrades it substantially where present. Stage 16, for the landfall figure shown in forecast mode.

**What "done" looks like.** Both modes render for a case and the toggle switches between them without losing map context. Attribution mode shows the backward path and origin estimate; forecast mode shows the forward track and, where a crossing exists, the landfall location and time from Stage 16 — with the explicit no-crossing-within-horizon result rendered as such rather than as a blank. Where the ensemble exists, the cone renders with its containment level stated on screen. Where it does not, the deterministic result is shown without implying a distribution it does not have.

**Human Decision Gate.**

- **Show a human:** both modes as rendered — the backward path and origin estimate in attribution mode, the forward track and its landfall result in forecast mode — with the cone and its stated containment level where the ensemble exists.
- **The judgment:** whether the rendering asserts more precision than the system claims. A deterministic drift path drawn as a crisp single line reads as a confident trajectory, which contradicts the uncertainty-awareness the project leads with; and a long-horizon forecast drawn with the same visual weight as a short-horizon one overstates skill that genuinely degrades with lead time.
- **Proceed if:** visual confidence matches the evidence, and the containment level is stated wherever the cone appears.
- **If not:** where Stage 19's cone exists, render it rather than the bare line; where it does not, render the deterministic path with visual restraint rather than implying a distribution the system has not computed.

**Known limitations & caveats.** Forecast skill degrades with horizon and nearshore accuracy is weaker than open-ocean accuracy (Stages 15 and 16), so a long-horizon forecast rendered with the same visual confidence as a short-horizon one overstates it. The cone represents only the uncertainty from the perturbations applied — principally forcing error — and not detection, seeding, or model-structural error, per Stage 19; it is a lower bound on true uncertainty.

**Where this could silently go wrong.** Drawing the deterministic drift path as a crisp single line with no uncertainty representation when the ensemble has not been built, which visually asserts a precision the system explicitly does not claim — the deterministic path is a best estimate, and rendering it as a confident trajectory contradicts the differentiator the project leads with. The second failure is a cone drawn without its containment level, which lets the viewer supply their own interpretation of what its boundary means.

---

### Stage 50 — Suspicion-Tier Visual Encoding

The candidate layer shows which vessels are in play. This stage shows, at a glance, which ones the evidence points at — and it is where the explainable-attribution differentiator reaches the map.

**Tier:** `[WORTH ADDING]`. Scope Section 10.3: colour and size-coding of AIS vessel points by suspicion score or confidence tier.

**What this stage is.** Encoding the candidate vessel points from Stage 47 by **confidence tier** and/or suspicion score, so that the ranking is visible spatially rather than only in a list, with the individual feature breakdown accessible on selection.

The encoding should use the **confidence tier** from Stage 36 as its primary channel rather than the raw suspicion score, for the same reason tiers exist at all: a continuous colour ramp invites over-reading of small differences, while three discrete bands communicate the coarse, honest distinction the scorer actually supports. Where only the `[MVP]` scorer exists, tiers do not exist and the encoding must fall back to the raw score with correspondingly restrained visual treatment.

Encoding is also where the false-positive-conservative design intent from Stage 36 has visual consequences. A single vessel rendered in a strong alarm colour is read as an identification; several vessels rendered in a middle band are read as a shortlist. The visual language should match what the evidence supports, and where evidence is ambiguous, the map should look ambiguous.

**Why this stage exists.** It makes the suspect ranking legible in the same view as the geography, which is where an analyst would actually reason about it — a vessel's score means more when seen against its track and the origin window than in a table. Combined with the per-vessel feature breakdown on selection, it puts the full explainable-attribution chain on the map.

**Inputs.** The suspect list with confidence tiers and feature scores from Stage 36, or suspicion scores from Stage 31 where the extended scorer does not exist. The candidate layer from Stage 47.

**Outputs.** An encoded vessel layer with a legible legend and per-vessel inspection. Consumed by the viewer.

**Dependencies.** Stage 47, which it extends. Stage 36 for tiers, or Stage 31 for raw scores as the fallback. Stage 43, for the step.

**What "done" looks like.** Vessel points are visually differentiated by tier or score with a legend that states what each level means in words, not only in colour. Selecting a vessel shows its individual feature scores, matching exactly what the dossier reports for the same vessel — a discrepancy between the map and the report for one vessel is a contract failure, not a display difference. The encoding remains legible with overlapping points and is distinguishable without relying on colour alone.

**Known limitations & caveats.** Confidence tiers are not calibrated probabilities (Stage 36), and a visual encoding tends to imply more precision than a number does, so the legend's wording carries real weight. All synthetic-data caveats apply to what is being encoded.

**Where this could silently go wrong.** A visual treatment that reads as an accusation — one vessel in alarm red — when the underlying tier assignment rests on thin evidence, which is the false positive the design brief warns about, amplified by presentation. The second failure is map and report disagreeing about a vessel's tier because one reads the extended scorer's output and the other the baseline's, which is invisible unless the two are compared directly for the same vessel.

---

### Stage 51 — Arbitrary SAR Upload Path

This stage opens the system to imagery it has never seen — and the scope document is explicit that it must never become the primary demo path.

**Tier:** `[STRETCH]`. Scope Section 10.3: "Upload your own SAR image" as an alternative to the curated case dropdown.

**What this stage is.** Accepting an arbitrary SAR image from a user, pushing it through the same preprocessing established in Stage 3 and the same inference path as Stage 7, and running as much of the downstream pipeline as the available data supports.

The constraint that shapes this stage is that an uploaded image arrives without the supporting data the curated cases have. There is no cached forcing data for its region and time window, no infrastructure reference layer, and no synthetic AIS scenario. The pipeline therefore cannot run end to end on it. The correct behaviour is to run what can be run — detection, characterization, and confidence — and to state explicitly which downstream stages are unavailable and why, rather than degrading silently or failing opaquely. That behaviour is itself the design work in this stage, more than the upload mechanics.

**Why this stage exists.** It demonstrates that the detector is a real model rather than a lookup keyed to three prepared cases, which is a fair question to anticipate. It is `[STRETCH]` and fenced because the Risk Register is explicit: the segmentation model may behave unpredictably on an arbitrary uploaded SAR image outside the training distribution, risking a broken live demo, and the pre-agreed mitigation is that the default demo path uses curated, pre-verified cases while upload stays a stretch or bonus path, never the primary one.

**Inputs.** A user-supplied SAR image. The preprocessing from Stage 3 and the trained model from Stage 6, via the inference path from Stage 7.

**Outputs.** A detection record for the uploaded image, and an explicit statement of which downstream stages could not run. Consumed by the detection step of the interface only.

**Dependencies.** Stages 3, 6, and 7, for preprocessing, model, and inference. Stage 43, for the wizard, which must handle a case whose artifact does not exist — a state the curated path never produces and which is the main integration cost of this stage.

**What "done" looks like.** An uploaded image is preprocessed identically to training data and produces a detection record, or fails with a clear, specific message rather than an unhandled error. Unavailable downstream stages are named explicitly with the reason. Malformed, unsupported, and non-SAR inputs are rejected gracefully. The curated path remains the default and is unaffected by this stage's presence.

**Human Decision Gate.**

- **Show a human:** detection results for two or three arbitrary SAR images genuinely outside the training distribution, together with the look-alike confidence values the model assigned them.
- **The judgment:** whether the model's behaviour on unseen imagery is acceptable to expose to a viewer. The confidence score is uncalibrated, so a confident-looking detection on an image where the model is effectively guessing is a realistic outcome — and it will not announce itself as one.
- **Proceed if:** behaviour is either reasonable or fails clearly and legibly, and the path is presented to the viewer as exploratory.
- **If not:** the Risk Register's position here is already fixed and is not a judgment call — the curated, pre-verified cases remain the default demo path, and this stays a bonus path, never the primary one.

**Known limitations & caveats.** Model behaviour outside the training distribution is unknown, per the Risk Register — results on an arbitrary image are genuinely unpredictable and should be presented as exploratory. Georeferencing may be absent or non-standard in a user-supplied file, in which case even the detection record may lack usable geography, and that case should be handled explicitly rather than assumed away.

**Where this could silently go wrong.** Producing a confident-looking detection on an out-of-distribution image where the model is effectively guessing — the output is well-formed and the confidence score, being uncalibrated (Stage 8), may even be high. The second failure is this path being used in a live demo despite the Risk Register's explicit guidance, which converts an unpredictable result into a public one.

---

### Stage 52 — Time-Scrubbed Ensemble Animation

The final presentation stage makes uncertainty move — turning the probability cone from a static shape into something a viewer watches evolve.

**Tier:** `[STRETCH]`. Scope Section 10.3: a time-scrubbing slider animating the drift probability cloud or heatmap shrinking or moving over time, with vessel track points animating in sync, using deck.gl or kepler.gl.

**What this stage is.** A time-scrubbing control that steps through the time-indexed probability field from Stage 19, animating how the predicted distribution moves and changes with lead time, with candidate vessel positions animating in sync so that the temporal relationship between vessel movement and the drift window is directly visible.

The scope document states the purpose precisely and it is the reason this stage is worth its cost: it *"makes the ensemble uncertainty modelling visually intuitive instead of a hidden backend number."* Stage 18 and Stage 19 are the most technically demanding work in the project, and without this stage their result is a static contour and a calibration figure. Scrubbing through time is what makes an ensemble comprehensible to someone who has never thought about one — the cone widening with lead time *is* the concept, shown rather than explained.

Scope Section 10.4 notes that deck.gl or kepler.gl are introduced only if this heatmap is attempted, which makes this stage the sole justification for a substantial additional dependency — a real argument for keeping it cleanly separable.

**Why this stage exists.** It is the uncertainty-awareness differentiator at its most communicative. It also synchronizes the two halves of the investigation visually: watching a vessel's track move through a widening origin distribution shows the attribution reasoning in a way no static view can.

**Inputs.** The time-indexed probability field from Stage 19, both directions. The forecast track from Stage 15 or Stage 17. Candidate vessel tracks from Stage 28 with their time-stamped positions.

**Outputs.** An animated, scrubbable map view. Consumed by the viewer.

**Dependencies.** Stage 19, definitively — there is nothing to animate without the ensemble, so this stage inherits the ensemble's status as the project's largest technical risk. Stage 49, whose forecast mode it extends. Stage 47, for the vessel positions it synchronizes with.

**What "done" looks like.** A slider steps through the forecast time range and the probability field updates correspondingly, with vessel positions synchronized to the same time index — verified explicitly, since desynchronized layers are the most likely defect and the easiest to miss. Playback is smooth enough to be legible. The containment level remains stated at every time step, not only at the initial view. Scrubbing to any time and reading the display gives a state consistent with the static views in Stage 49 at that same time.

**Known limitations & caveats.** This depends entirely on the ensemble, which the Risk Register identifies as the single biggest technical and logistics risk in the project, with the single deterministic run as the guaranteed fallback. If the ensemble is not built, this stage cannot be built either, and that dependency should be understood before any effort is invested in the visualization layer. Rendering performance with a dense time-indexed field is a real constraint and is why the aggregated representation from Stage 19 matters.

**Where this could silently go wrong.** Vessel positions and the probability field drifting out of sync by a time step, which produces an animation that looks correct and tells a subtly false story about where a vessel was relative to the drift window — precisely the relationship the animation exists to communicate, and the one nobody will independently verify while watching it. The second failure is an animation that is smooth and beautiful and shows a cone whose width, per Stage 18's failure mode, is an artifact of the perturbation scheme rather than a real uncertainty estimate — presentation quality outrunning evidential quality, in the place where it is hardest to notice.

---
# Part IX — Verification & Evidence

The system now runs end to end and can be watched doing it. Two things remain, and the scope document treats both as obligations rather than as polish.

The first is assembling the numbers. Detection metrics exist in Stage 10, drift accuracy in Stage 21, attribution hit rates in Stage 37 — each produced where the thing it measures was built, which is the right place to produce them and the wrong place to leave them. Scope Section 11.4 is specific that these get their own section, separate from the live demo walkthrough: *the demo shows what the system does, this section shows how well it actually works.*

The second is assembling the caveats. Scope Section 14 lists the limitations to be stated openly, the Risk Register prescribes rehearsed answers for the ones most likely to be challenged, and the v3 edits attach specific disclosures to specific numbers. Scattered across a build, these are easy to lose. Gathered into one ledger, they become the thing that makes the rest credible.

These two stages close the document because they are the ones that answer the question the whole project is ultimately judged on — not "does it run" but "how do you know."

---

### Stage 53 — Consolidated Evaluation Section

The measurements exist in three separate places. This stage brings them into one section that stands on its own.

**Tier:** Untagged in source. Scope Section 11 establishes the obligation: every metric *"must be reported as an actual number in the final presentation — not asserted qualitatively,"* and Section 11.4 specifies that these numbers get their own section separate from the demo walkthrough. This document does not assign evaluation stages a tier.

**What this stage is.** Assembling the complete evaluation into a single presentation section, comprising:

- **Detection (Stage 10)** — IoU and Dice on the dataset's official held-out test split, per class across `oil-spill`, `look-alike`, `land`, `ship`, and `sea surface`, and as an overall mean, with the class distribution alongside so the mean can be read correctly.
- **Attribution (Stage 37)** — Top-1 and Top-3 hit rates over the batch of synthetic scenarios with the exact scenario count, plus the false-implication check result. Top-3 is the headline figure: scope Section 11.2 calls it *"the single most important number in the whole evaluation."*
- **Drift (Stage 21)** — distance error in kilometres and time error in hours against the ground-truth anchor, with the n=1 caveat attached to the number itself; plus the calibration fraction where the ensemble exists, and any additional historical cases from the `[STRETCH]` extension.
- **Supporting validation where built** — the historical benchmark rate from Stage 11, the integrity checker's detection and false-positive rates from Stage 32, and the hand-rolled advection cross-check divergence from Stage 20.

The assembly work is not clerical. Each number needs its qualifying context sitting *with* it rather than in a general caveats slide, because a number read without its context is a number read wrongly — and the v3 edits are explicit that this is where the disclosures belong. The section also needs an honest framing of what each metric does and does not establish: detection metrics are measured against a labelled test split and are strong evidence; attribution metrics are measured against self-planted ground truth and are a mechanism check; drift accuracy is a single real case and is an anchor rather than a distribution.

**Why this stage exists.** Scope Section 11 opens with the reason: a working demo on one case proves nothing by itself. This section is the difference between a project that demonstrates and one that measures. Its separation from the demo walkthrough is deliberate — a number shown mid-demo is decoration, while a section that presents the measurements on their own terms is evidence.

**Inputs.** Metrics from Stage 10 (detection), Stage 21 (drift), and Stage 37 (attribution), plus supporting results from Stages 11, 20, and 32 where built. Complete runs from Stage 39.

**Outputs.** A single evaluation section with every metric, its scenario or sample count, and its qualifying disclosure. Consumed by the final presentation, and by Stage 54, which cross-checks that every disclosure appearing here also appears in the limitations ledger.

**Dependencies.** Stages 10, 21, and 37 for the numbers themselves. Stage 39, since the metrics must reflect a pipeline that actually runs end to end rather than three components measured in isolation. Stage 2, transitively, for the ground-truth anchor without which the drift number does not exist.

**What "done" looks like.** Every metric the scope document requires appears as an actual number: per-class and mean IoU and Dice; Top-1 and Top-3 hit rates with scenario count; the false-implication result; and drift distance and time error. Each carries its sample count and its qualifying disclosure adjacent to it, not in a separate section. No metric is asserted qualitatively anywhere in the section. The numbers match their sources exactly — a figure that has drifted from the harness that produced it is a defect, and the harnesses being rerunnable is what prevents it.

**Human Decision Gate.**

- **Show a human:** the assembled evaluation section as it will actually be presented, with every metric, its sample count, and its adjacent disclosure in place.
- **The judgment:** whether the three metric families are presented with weight proportional to what each actually establishes. Detection metrics are measured against a labelled held-out split and are strong evidence; attribution metrics are measured against self-planted ground truth and are a mechanism check; drift accuracy is a single real case. The attribution numbers are the weakest in what they establish and the strongest-looking on a slide, and only a person reading the section whole can see whether the presentation reflects that.
- **Proceed if:** each number sits beside its qualifying disclosure and its sample count, and nothing is asserted qualitatively anywhere in the section.
- **If not:** regenerate the numbers from the rerunnable harnesses in Stages 10, 21 and 37 rather than transcribing them, and move any disclosure that has drifted into a general caveats slide back beside its number, as the v3 edits require.

**Known limitations & caveats.** The scope document's v3 edits define what must sit beside these numbers, and they are restated here so this stage is self-contained. Beside the attribution numbers: all of Section 11.2's figures are generated, scored, and validated using ground truth the team itself planted with the same feature logic being tested — a valid mechanism check, but not evidence the system generalizes to real, messy AIS data, and this must be stated plainly on the evaluation slide rather than only in the Risk Register. Beside the drift number: this is a single case, n=1, sufficient as a demo anchor and a concrete accuracy figure but not statistically meaningful on its own — be ready to say "n=1, here's why" rather than let it look like an oversight. Beside the detection confidence wherever it appears: the score is uncalibrated and indicative.

**Where this could silently go wrong.** A number that has drifted from the code that produced it — reported from an earlier run while the pipeline has since changed. It is plausible, defensible-looking, and wrong, and the only defence is regenerating the section from rerunnable harnesses rather than transcribing. The second failure is presenting the three metric families with equal epistemic weight, which overstates the attribution numbers: they are the weakest of the three in what they establish and the strongest-looking on a slide.

---

### Stage 54 — Disclosed-Limitations Ledger & Rehearsed Framing

The last stage collects every caveat the project has accumulated into one place, and turns the ones most likely to be challenged into prepared answers.

**Tier:** Untagged in source. Scope Section 14 requires these limitations to be *"stated openly in the final report,"* and the Risk Register requires the framing for the most significant of them to be rehearsed before demo day. This document does not assign a tier.

**What this stage is.** Two deliverables.

The **ledger**: a single consolidated list of every disclosed limitation, each mapped to the stage it arises from, so that no caveat exists only in one stage's write-up. Scope Section 14's list is the base, and each item traces to a stage in this document:

- AIS data used in the demo is synthetic, not live or real vessel traffic — Stages 26, 27, and everything in Part V, with the disclosure required in the dossier itself by Stage 40.
- Detection confidence scores come from uncalibrated model class probabilities and are reported as indicative, not statistically precise — Stage 8, surfacing in Stages 40, 45, and 53.
- Age estimation and weathering, where built, are approximations based on simplified physics, not precise forensic timing — Stages 12 and 17.
- Platform, pipeline, and seep datasets may have incomplete public coverage in some regions, with the static-list fallback used where this applies — Stages 5, 22, and 24, with the asymmetry from Stage 23 that absence of a match is weak evidence of absence.
- `[MVP]`-tier vessel attribution, being proximity and trajectory only, is most vulnerable to a vessel deliberately going dark on AIS before discharge; the dark-gap feature is the direct mitigation and is tiered `[WORTH ADDING]` — Stages 29, 30, 31, and 33.
- The drift accuracy figure rests on a single historical case unless additional cases are added under the `[STRETCH]` extension — Stages 2, 21, and 53.
- The system produces ranked hypotheses with confidence levels for human review — it is a decision-support tool, not a final legal or regulatory determination — scope Section 2, carried verbatim into every dossier by Stage 40.

The **rehearsed framing**: prepared answers for the challenges the Risk Register anticipates. The synthetic-AIS answer is specified almost verbatim and is the one that matters most, because the Risk Register assigns it to the whole team and attaches a specific instruction — *do not let this be discovered live.* Its prescribed form: this validates the attribution mechanism against controlled ground truth, the same way any anomaly-detection or fraud-scoring system is validated before real deployment; plugging in a real AIS feed is the natural next phase and requires no redesign. The n=1 drift answer and the uncalibrated-confidence answer follow the same pattern — a known limitation, an explanation of why it is acceptable at this stage, and a specific named next step.

**Why this stage exists.** The project's positioning depends on it. A system claiming uncertainty-awareness as a differentiator that is not itself candid about its own limitations has contradicted its central claim. Stating limitations first is also strictly stronger than being asked about them: a disclosed limitation is evidence of judgement, while a discovered one is evidence of a gap. This is the stage where the honesty theme running through every part of this document becomes an explicit deliverable rather than an implicit discipline.

**Inputs.** Scope Section 14's limitation list, the Risk Register's rehearsed framings, the v3 edit disclosures, the positioning statement from scope Section 2, and the per-stage caveats recorded throughout this document.

**Outputs.** The consolidated limitations ledger and the prepared framings. Consumed by the final report, the presentation, and Stage 53, which places the relevant disclosures beside their numbers.

**Dependencies.** Every stage, in that each contributes its caveats — but functionally, Stage 53 for the evaluation numbers the disclosures attach to, and Stage 40 for the dossier that must carry the positioning statement and the synthetic-data disclosure.

**What "done" looks like.** Every item in scope Section 14 appears in the ledger, mapped to the stage or stages it arises from. Every disclosure required by a v3 edit appears both in the ledger and beside its number in Stage 53's evaluation section. The positioning statement appears verbatim in every generated dossier, verified in the artifact rather than in the template. The rehearsed answers exist in written form, and the synthetic-AIS answer specifically covers the whole of scope Stage D rather than any single feature — a point the Risk Register makes explicitly and which is the most common way this particular answer is given too narrowly.

**Human Decision Gate.**

- **Show a human:** the ledger with every Section 14 item mapped to the stage it arises from, and the rehearsed answers delivered aloud — the synthetic-AIS answer in particular.
- **The judgment:** whether each rehearsed answer is scoped correctly and actually lands. The specific failure to listen for is the synthetic-AIS answer given for a single feature when the question was about the whole of attribution, which reads as not having understood the question. The second judgment runs outward: whether every limitation in the ledger actually reaches the report, the dossier, and the slide where its number appears, rather than being disclosed internally only.
- **Proceed if:** the answers are scoped to the whole of scope Stage D, and every ledger item is traceable to somewhere a reader will encounter it.
- **If not:** rework the framing against the Risk Register's prescribed wording, which is written out there almost verbatim for exactly this purpose — together with its accompanying instruction, that this must not be discovered live.

**Known limitations & caveats.** This ledger is only current as of the tier of work actually built: the `[MVP]`-attribution vulnerability disclosure changes once the dark-gap feature exists, and the n=1 drift caveat changes if additional historical cases are added. A stale ledger disclosing a limitation that has been fixed is a smaller problem than one omitting a limitation that has not, but both are defects.

**Where this could silently go wrong.** A limitation that lives in the ledger but never reaches the report, the dossier, or the slide where its number appears — disclosed internally and undisclosed externally, which is the failure mode the Risk Register's instruction not to let this be discovered live is specifically aimed at. The second failure is a rehearsed answer scoped too narrowly: giving the synthetic-data answer for the behavioural fingerprinting feature when the question was about the whole of attribution, which reads as not having understood the question and turns a prepared answer into a weaker position than saying nothing.

---

## How to read this doc

Every stage above is written to be a **self-contained unit of context**. Someone should be able to open one stage — Stage 33, say, or Stage 19 — and have everything they need to understand what it is, why it exists, what it receives, what it produces, what would make it finished, and what to be careful about, without reading the stages around it and without going back to the original scope document.

That is why terms are re-defined where they are used rather than assumed: a stage that mentions a hindcast says what a hindcast is; a stage that reports an uncalibrated confidence restates why it is uncalibrated; a stage in Part V restates the synthetic-AIS disclosure rather than pointing at Part V's introduction. The repetition is deliberate. It is the cost of every stage standing alone, and it is worth paying.

The document is also meant to be read straight through, and it is written to work that way too. Stages open by connecting back to what came before, cross-reference forward and backward by stage number, and return repeatedly to the four differentiators — uncertainty-awareness, explainable attribution, multi-hypothesis triage, and narrative UI — because those are what turn a sequence of components into a system with a point. The canonical vocabulary in Section 0.3 is the spine: the **spill polygon** produced in Stage 7 is the same object seeded in Stage 14 and rendered in Stage 45; the **origin window** estimated in Stage 14 is the same one tested in Stage 22 and filtered against in Stage 28; the **feature scores** computed in Stages 29 through 35 are the same ones combined in Stage 36, broken down in Stage 41, and encoded on the map in Stage 50. If an object appears to change shape or name between two stages, that is not a nuance to interpret — it is an error.

Which brings up the operating principle this document inherits from the scope document, and which applies to this document about itself:

> **If any stage reads as unclear, underspecified, or noticeably lighter or heavier in effort than the others, that is a defect in this document — flag it and get it fixed. Do not guess around it, and do not start writing code around an assumption you had to invent to fill a gap here.**

That covers three distinct failure modes, and all three are worth naming separately:

**Unclear.** If two people read a stage and disagree about what it is asking for, the stage is wrong regardless of how much text it contains. The "What 'done' looks like" field is the specific test — it was written to be checkable, and if it is not checkable, that field has failed.

**Underspecified.** If a stage's inputs or outputs do not say precisely what shape they are, or its dependencies do not say why they exist, then someone building it will fill the gap with an assumption. That assumption will be invisible until it collides with a different assumption made in another stage — which is exactly the integration risk Stage 1 exists to prevent, reappearing at the document level.

**Unevenly sized.** The stages here were deliberately cut so that each is roughly comparable in depth of work. That is why scope Stage A is seven stages, scope Stage C is nine, scope Stage D is twelve, and the frontend is ten — the scope document's five-letter structure describes function, not effort. If a stage turns out in practice to be several times the work of its neighbours, it should be split, and this document updated. A stage that is much lighter than its neighbours should be examined for whether something was left out of it.

Two further notes on using this document.

**On ordering.** Stage numbers are dependency order, not a schedule and not an assignment. A lower number means only that later stages need it to exist first. Stages with no dependency relationship can be built in any order or at the same time, and where that is true the Dependencies field says so. Nothing here says when anything happens or who does it.

**On tiers.** `[MVP]`, `[WORTH ADDING]`, and `[STRETCH]` are reproduced exactly as the scope document assigns them and mean exactly what it says they mean: required for the pipeline to run end to end and have a demo at all; not required for a working demo but where the actual differentiation and technical depth live; and genuinely optional, first to be cut under pressure. They are priority labels, never timing labels. Where the scope document tags nothing, this document says "Untagged in source" and quotes the sentence establishing the obligation, rather than inventing a tier — and the scope document's own default applies to anything neither document covers: if the tier is unclear, it is `[STRETCH]` until explicitly reclassified.

---

*This document maps every section of the locked scope document (v4) to at least one stage above. If something in that document does not appear here, that is a gap in this document — flag it.*

---

# Part X — Consolidated List of Human Decision Gates

Thirty-one of the fifty-four stages above carry a **Human Decision Gate** — a point where the stage's own "done" condition cannot be fully settled by its own logic, because what has to be judged is a real output: a metric, a point plotted on a map, the spread of an ensemble, a ranked list, a rendered screen. At those points the correct behaviour is to stop and show a person the output, not to decide the output is good enough and continue.

This section exists so that nobody has to re-read fifty-four stages to find out where their input is next required. It is the scan list. Each entry names the stage, the one thing being judged, and where a stop leads — every fallback below is one already named elsewhere in this document or in the scope document's Risk Register, not a new escape hatch invented here.

The gates are listed in dependency order, which is also the order they will be reached. Note that they are not evenly distributed, and the distribution is itself informative: detection and drift are gate-dense because their outputs are pictures and pictures need eyes; the attribution features are gate-dense because their failure mode is a degenerate score distribution that no assertion catches; the data-transformation, filtering, formatting and serving stages carry no gates at all.

### The gates, in dependency order

- **Stage 1 — Interface Contract Freeze.** Two people independently hand-encode the same spill from the contract; do the two files match, and is anything a later stage needs still missing? → *Stop:* resolve in the contract before parallel building starts, per the Risk Register's integration-risk mitigation.
- **Stage 2 — Demo Case Curation.** Is the anchor case's documented origin a surveyed fact or itself an estimate? → *Stop:* choose a different incident, or keep it and state that Stage 21 compares two estimates; Section 11.3's `[STRETCH]` extra cases strengthen it.
- **Stage 5 — Static Geospatial Reference Layer.** Plotted platforms and pipelines for the demo region — is that coverage usable? → *Stop:* hand-seed the verified static list named in scope Section 6 and the Risk Register.
- **Stage 6 — Segmentation Model.** Per-class metrics plus predicted masks — were `oil-spill` and `look-alike` genuinely learned as distinct classes? → *Stop:* retrain, using the Risk Register's named levers (pretrained backbone, transfer learning).
- **Stage 7 — Mask-to-Polygon Vectorization.** Polygon on a basemap — right place, and right shape, or has cleaning merged two separate slicks? → *Stop:* revisit cleaning and simplification together with Stage 1's contract decisions.
- **Stage 8 — Look-Alike Confidence.** Clear versus ambiguous detection side by side — does the score visibly discriminate, and is the wording indicative rather than a percentage? → *Stop:* propagate anyway, with the calibration disclosure from scope Section 5.2's v3 edit.
- **Stage 11 — Historical Benchmark Validation.** Per-incident outcomes against a criterion fixed in advance — does each genuinely count as a hit? → *Stop:* drop the claim; Stage 10's held-out-split metrics remain the detection evidence.
- **Stage 13 — Drift Engine Integration.** Hand-worked directional test and proof of which files were read — is the engine actually driven by the cached forcing? → *Stop:* nothing in Part III is trustworthy until resolved; re-check Stage 4, and build Stage 20's `[STRETCH]` cross-check as the independent test.
- **Stage 14 — Backward Hindcast.** Origin plotted beside the detection with implied drift speed — is it physically reachable, and over water? → *Stop:* revisit horizon and seeding; deterministic run stays the baseline; a persistently bad anchor result reopens Stage 2.
- **Stage 18 — Perturbed Ensemble.** The spread of all perturbed endpoints — is it real, or degenerate, or absurd? → *Stop:* drop the ensemble; the Risk Register's single deterministic run is the guaranteed baseline and nothing downstream requires more.
- **Stage 19 — Probability Field & Cone.** Cone with containment level, deterministic point on it, grid resolution against forcing resolution — is the cone honest? → *Stop:* coarsen the grid; if the deterministic point sits outside its own ensemble, resolve rather than ship.
- **Stage 21 — Drift Accuracy.** Distance and time error, plus whether parameters were tuned after first seeing them — is this number honest, not merely small? → *Stop:* disclose the tuning; Section 11.3's `[STRETCH]` extra cases give an untuned figure.
- **Stage 22 — Infrastructure Proximity.** The radius against Stage 14's own tolerance — too tight to catch a real platform, or loose enough to match everything? → *Stop:* adjust the radius, or fall back to Stage 5's hand-verified static list.
- **Stage 23 — Source Hypothesis & Routing Gate.** Label, confidence and evidence per case — is a confident `likely-vessel` actually resting on an empty dataset? → *Stop:* route to `insufficient-evidence`, shown as low-confidence — the fallback already inside the frozen label set.
- **Stage 25 — Repeated-Origin Detection.** Clustered origins against the prevailing current — real stationary source, or shared hindcast bias? → *Stop:* drop the flag; Stage 22's checks remain the basis for stationary-source triage.
- **Stage 27 — Synthetic AIS Generator.** Rendered scenarios — could a person looking at the map fail to pick the guilty vessel out? → *Stop:* regenerate with denser, closer background traffic and offset guilty tracks.
- **Stage 31 — Baseline Scorer & Suspect List.** Ranked list with component scores on a hard scenario — does the ordering follow from the visible evidence, and are both features live? → *Stop:* rescale against Stage 14's tolerance; disclose and quarantine any weight tuning.
- **Stage 32 — Track Integrity Layer.** Detection rate and false-positive rate side by side — is the balance acceptable across vessel classes? → *Stop:* retune thresholds, or drop the feature; Stage 36 degrades gracefully without it.
- **Stage 33 — Dark-Gap & Dead Reckoning.** Interpolated positions beside reported ones — are they unmistakably distinguishable, and is the gap short enough to publish a point at all? → *Stop:* score the gap without a published position, or show a region instead of a point.
- **Stage 34 — Behavioral Fingerprinting.** Distribution of self-anomaly scores — is the baseline a pattern, or noise that makes everything look anomalous? → *Stop:* extend the profile history, or drop the feature.
- **Stage 36 — Extended Scorer & Confidence Tiers.** Tiered list on an ambiguous scenario — is any `High` carried by a single feature? → *Stop:* raise the tier boundaries; Stage 31's baseline remains underneath.
- **Stage 37 — Attribution Evaluation.** Hit rates read against the batch's difficulty, and the cause of any false implication — good scorer, or easy batch? → *Stop:* regenerate harder scenarios through Stage 27 and re-run.
- **Stage 39 — End-to-End Orchestration.** One complete case artifact, both branches — does it tell one internally consistent story? → *Stop:* fix the inconsistency in the stage that produced it, not in the orchestrator.
- **Stage 40 — Dossier Assembly.** The rendered dossier, read in full — is anything never computed rendering as though it were checked and clean? → *Stop:* render explicit absence rather than a blank, as this stage already specifies.
- **Stage 41 — Evidence Breakdown.** Hand it to someone who has not seen the case — can they explain why the top candidate outranks the second? → *Stop:* remove it; Stage 40's base dossier is complete and shippable without it.
- **Stage 45 — Detection Layer & Confidence Display.** The step as it renders — polygon legible at that zoom, confidence worded as indicative? → *Stop:* frame Stage 44's transition against real polygon extents; replace any percentage with a qualitative band.
- **Stage 47 — AIS Vessel Layer.** The rendered layer — can a viewer tell interpolated positions from observed ones at a glance? → *Stop:* render them differently, or omit them from the map, as in Stage 33.
- **Stage 49 — Dual-Mode Drift View.** Both modes as rendered — does the visual assert more precision than the system claims? → *Stop:* render Stage 19's cone where it exists; otherwise draw the deterministic path with restraint.
- **Stage 51 — Arbitrary SAR Upload.** Detections on genuinely out-of-distribution imagery — is this behaviour acceptable to expose? → *Stop:* not a judgment call — the Risk Register fixes curated cases as the default demo path and this as a bonus path only.
- **Stage 53 — Consolidated Evaluation.** The section as it will be presented — is each metric family weighted to what it actually establishes? → *Stop:* regenerate from the harnesses; move drifted disclosures back beside their numbers.
- **Stage 54 — Limitations Ledger & Framing.** The rehearsed answers delivered aloud — is the synthetic-AIS answer scoped to the whole of scope Stage D? → *Stop:* rework against the Risk Register's prescribed wording, and remember its instruction that this must not be discovered live.

### Stages deliberately left ungated — and the close calls

The other twenty-three stages produce output that is mechanically checkable: schema-conformant data, filtering verified against known ground truth, formatting, serving, and constructed test cases with a predetermined right answer. Stage 9's area computation either matches a known test polygon or does not; Stage 38's endpoints either return contract-conforming objects or do not; Stage 35's prior either changes the top of the ranking or does not. Those need no person.

Some calls were closer than others, and the honest thing is to name them rather than let their absence read as a considered omission when it was a judgment. If any of these is later found to need a person, that is a defect in this section — flag it and add the gate, exactly as the rest of this document asks:

- **Stage 3 (SAR corpus).** Preprocessing consistency is asserted mechanically, but nobody looks at a preprocessed scene. A visual check that normalization has not destroyed the imagery is arguably warranted.
- **Stage 4 (forcing data).** The "plausible values against an independent source" check is genuinely human, but Stage 13's gate tests the same data far more stringently. If Stage 13 proves hard to clear, treat Stage 4 as gated too.
- **Stage 10 (detection evaluation).** Data leakage is not code-checkable. It is ungated only because the split is inherited unmodified from Stage 3 and adequacy is judged at Stage 6. This is the closest call in Part II.
- **Stage 12 (age estimation).** Its contradiction check against the Stage 14 origin window surfaces at Stage 39's coherence gate instead.
- **Stages 15 and 16 (forward forecast, landfall timing).** Trajectory plausibility and crossing consistency are judged where both are rendered, at Stage 49. If Stage 49 is cut, these become ungated blind spots.
- **Stage 17 (weathering).** The assumed oil type is a real modelling assumption; it is recorded and disclosed rather than judged, which is weaker than a gate.
- **Stage 20 (advection cross-check).** A failed cross-check is a finding about Stage 13, which is gated; the tolerance being fixed in advance is this stage's own protection.
- **Stage 24 (seep check).** Whether a broad seep zone is specific enough to count as evidence is weighed inside Stage 23's confidence gate.
- **Stage 26 (AIS schema).** The rehearsed claim that a real feed "requires no redesign" rests on a human judgment of schema faithfulness. Genuinely close.
- **Stage 28 (candidate filtering).** Containment of the planted vessel is mechanically checkable against known ground truth; only the retention-rate sanity read is human.
- **Stage 42 (dossier export).** Whether disclosures survive into the exported artifact is automatable by extracting its text and comparing.
- **Stage 44 (camera transition).** Absorbed into Stage 45, which cannot pass unless the framing is right.
- **Stage 46 (source-hypothesis step).** Whether the interface shows `likely-vessel` with more visual confidence than the evidence supports has no other home. Close.
- **Stage 50 (tier visual encoding).** Whether the map reads as an accusation is judged at Stage 36 for the tiering and Stage 41 for the tone.
- **Stage 52 (time-scrubbed animation).** Layer desynchronization is real and not code-verifiable — nobody checks sync while watching an animation. Close.
