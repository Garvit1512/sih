# CLAUDE.md — oil-spill-pipeline (Frontend)

## 0. RELATIONSHIP TO PARENT CLAUDE.md

This file is scoped to `E:\sih\oil-spill-pipeline` and governs the **frontend
implementation approach** for this Next.js project only.

The parent `E:\sih\CLAUDE.md` remains the source of truth for everything else,
including but not limited to:

- product mission and positioning ("this is a decision-support lead list,
  not a legal determination")
- the five-stage **backend** investigation pipeline (SAR Detection →
  Source-Type Triage → Drift Hindcast → Conditional Vessel Attribution →
  Forward Forecast → Investigator's Dossier → Guided Frontend Experience)
  and all Stage A/B/C/D/E business logic and ownership boundaries
- backend architecture, orchestration, mock providers
- API contracts, geo-spatial contract (WGS84/EPSG:4326, GeoJSON [lon, lat]
  ordering), time contract (UTC/ISO 8601)
- non-accusatory attribution language rules
- explainability, evidence, and provenance requirements
- synthetic AIS disclosure requirements
- data source / fallback / no-fabrication rules
- security rules
- testing requirements
- git/commit conventions

**This file does not override, remove, or weaken any of the above.** It
supersedes ONLY the frontend *technology/implementation* choices previously
specified in the parent CLAUDE.md (its §30 frontend technology stack, §32
"Mapbox is central" as it implied a specific library pairing, and §55
dependency guidance as applied to map/state library selection), and it adds
frontend-only **presentation terminology** (§6 below) — because this is a
new, from-scratch frontend build with its own stack and narrative framing
decisions.

Anywhere the parent CLAUDE.md states a *product, workflow, content, or
behavioral* rule rather than a technology or presentation choice, it still
applies here in full, without exception. **Backend contracts and business
logic are unchanged by this file.**

## 1. SCOPE OF THIS FILE

Governs only:
- frontend technology stack
- frontend architectural conventions
- frontend directory structure
- frontend state-management approach
- frontend UI/animation/library choices
- frontend-facing narrative/labeling of the investigation journey

Does NOT redefine:
- API contracts
- coordinate/timestamp formats
- Stage B/E business logic
- backend behavior

Those remain governed by the parent CLAUDE.md (and `docs/contracts.md` if
present in the repo).

## 2. FRONTEND STACK (supersedes parent §30 / §32 / §34 / §55 where they conflict)

- Framework: Next.js 16 (App Router), React 19, TypeScript (strict mode)
- Styling: Tailwind CSS v4 (CSS-first config, no `tailwind.config.ts`)
- Components: shadcn/ui
- Map: **Mapbox GL JS + react-map-gl/mapbox** — do NOT use MapLibre
- State: React state/hooks for the investigation wizard and page-level state
  - Do NOT introduce Zustand, Redux, or any other global state library
    unless a specific, documented need is identified and explicitly approved
- Animation: Motion (`motion/react`)
- Icons: Lucide React
- File upload: React Dropzone
- Forms: React Hook Form + Zod
- Client-side geospatial: Turf.js

## 3. DEFERRED / STRETCH LIBRARIES — DO NOT INSTALL YET

Reserved for the future cinematic landing experience (§7):

- Lenis
- Three.js / React Three Fiber
- React Bits
- 21st.dev-inspired components

Install only when a concrete component requires one, per the dependency
discipline in §10 below.

## 4. WHY MAPBOX GL JS (NOT MAPLIBRE)

- `react-map-gl` has first-class, well-documented Mapbox GL JS support.
- Parent CLAUDE.md §33 already defines map-layer/source naming conventions
  (`spill-source`, `spill-fill`, `origin-marker`, etc.) written against
  Mapbox GL JS semantics — keeping Mapbox avoids re-deriving those.
- Mapbox GL JS requires an access token (`MAPBOX_TOKEN`, per parent §43).
  Token handling follows parent §49 security rules: never commit secrets,
  never expose more than necessary, ship a `.env.example`.

## 5. WHY REACT HOOKS OVER ZUSTAND (FOR NOW)

State stays in React hooks/`useState`, consistent with the official scope
referenced in parent §30 ("React useState-based wizard... Redux/Zustand is
unnecessary"). Zustand may be introduced later only if the app genuinely
outgrows lifted state (e.g. deep prop drilling across unrelated route
trees), and only with explicit approval — not as a default convenience.

## 6. USER-FACING INVESTIGATION STAGES (frontend presentation layer)

The **backend** pipeline and business logic (parent CLAUDE.md §2, §11–§28)
are unchanged. This section defines only how the frontend *labels and
narrates* that pipeline to the user. It does not rename, restructure, or
alter any backend stage, contract, or routing rule.

The frontend MUST present the investigation journey using exactly these
five user-facing stages:

| # | User-facing label | Subtitle | Maps to backend |
|---|---|---|---|
| 01 | **DETECTION** | SAR Image Analysis | Stage A |
| 02 | **RULE-OUT** | Infrastructure & Source-Type Triage | Stage B |
| 03 | **TIME TRAVEL** | Backward Drift Modelling | Stage C (hindcast) |
| 04 | **LINEUP** | AIS Vessel Attribution | Stage D (conditional) |
| 05 | **VERDICT** | Investigator's Dossier | Stage E (report; also carries Stage C forward forecast) |

Notes:

- Forward forecast (part of Stage C) is presented within the VERDICT
  (Investigator's Dossier) stage where appropriate, rather than as a
  separate user-facing step — this is a display/IA choice, not a backend
  change.
- When Stage D is skipped (platform/pipeline/natural-seep routing per parent
  §17), the LINEUP step must still render in a clearly labelled
  not-applicable/skipped state — never silently omitted, and never faked.
  Per parent §38 this is a valid system state, not an error.
- "VERDICT" is a frontend narrative label only. It must NOT be interpreted
  as, or allowed to imply, a legal or definitive conclusion. All content
  rendered inside the VERDICT step must still comply with parent §20–§23
  (attribution language, disclaimer, synthetic AIS disclosure, indicative
  confidence language). The word describes the investigative narrative arc
  (the resolution the user reaches), not a claim of legal fact.
- All parent CLAUDE.md frontend rules that are about *content/behavior*
  rather than *technology* remain fully binding, including:
  - §35 investigation state shape (case, currentStep, detection, triage,
    drift, attribution, report, loading, error)
  - §36 all API calls centralized in `services/api.ts`
  - §37 TypeScript types must mirror backend Pydantic contracts, kept in sync
  - §38 distinguish real errors from valid system states (e.g. LINEUP
    skipped because RULE-OUT found a stationary source is NOT an error)
  - §39 investigation-stage-specific loading messages, no fake progress %
  - §67 the ten questions the UI must answer
  - §68 visual design rules (map-first, restrained, no generic dashboard look)
  - §21 synthetic AIS disclosure — must not be removed
  - §22 non-accusatory attribution language — must not be removed
  - §23 "indicative detection confidence" language — must not be removed

## 7. CINEMATIC LANDING EXPERIENCE (`/` route)

The `/` route is intended to become a cinematic, scroll-driven maritime
intelligence introduction — **not** a generic SaaS/AI product landing page.

Intended narrative arc:

```
OCEAN
  → SAR ACQUISITION
  → SLICK DETECTION
  → RULE-OUT
  → BACKWARD DRIFT
  → AIS LINEUP
  → VERDICT
  → INVESTIGATION WORKSPACE
```

This arc mirrors the user-facing stages in §6 (SAR Acquisition / Slick
Detection ≈ DETECTION, Rule-Out ≈ RULE-OUT, Backward Drift ≈ TIME TRAVEL,
AIS Lineup ≈ LINEUP, Verdict ≈ VERDICT), then hands off into the actual
investigation workspace (the wizard flow).

The libraries listed in §3 (Motion, Lenis, Three.js / React Three Fiber,
React Bits, 21st.dev-inspired components) are the anticipated toolset for
this experience but remain **deferred** — not installed — until this
landing page is actually being implemented. Building the guided
investigation wizard takes priority; do not front-load landing-page work
ahead of the functional product, per parent §64/§82 (a reliable end-to-end
demo beats extra polish).

## 7A. CINEMATIC VISUAL QUALITY (the `/` experience)

This section governs the quality bar for the cinematic landing experience.
It is a *visual* standard, not a technology list — §2 still decides the stack.

**The ocean is the product's primary visual.** It must read immediately as a
real, moving 3D sea: layered wave scales (large swell, medium wave, fine
ripple), visible crest structure, directional moonlight, broken specular
highlights, Fresnel response, and distance haze. A dark surface with
technically-correct geometry that visually reads as flat black is a failure,
not a stylistic choice. Achieve tonal range through shading — a three-tone
height gradient, specular, foam at crests — never by flatly raising overall
brightness.

**Night maritime atmosphere.** This is Earth's night ocean under surveillance:
stars with horizon extinction, a small low moon whose reflection path lines up
with the water's specular highlights, atmospheric fog, and clear separation
between sky, horizon, distant water and foreground water. No sunsets, no
nebulae, no purple space, no colour washes.

**Analytical UI stays restrained.** Overlays are small, anchored annotations —
coordinate readouts, instrument-style dials, short narrative headings. Never a
dashboard, HUD frame, fake terminal, glowing border, or floating glass card
over the scene. Most of the frame stays ocean.

**Procedural 3D over icons.** Satellites, vessels and other physical objects
are built from primitive geometry (box / cylinder / cone / plane groups) and
lit by the scene. Never a flat sprite, 2D icon or image standing in for a 3D
object.

**Aesthetic exclusions.** No cyberpunk or neon; no giant centered text with no
surrounding composition; no excessive uppercase, letter-spacing or monospace;
no rounded-card pile-ups; no wireframe rectangles as decoration. JetBrains Mono
is for genuine telemetry (coordinates, timestamps, sensor metadata, numeric
readouts); narrative headings and body copy are Inter.

**Performance constraints.** Prefer shader work over polygon count. Instance or
batch repeated geometry (stars, flow markers). Keep ocean subdivision
reasonable, keep adaptive DPR and `PerformanceMonitor` in place, and dispose
every manually-constructed geometry (R3F only auto-disposes JSX-declared
objects).

**Accessibility / reduced motion.** Under `prefers-reduced-motion`: keep the
ocean animating, damp camera movement, disable pointer parallax and smooth
scrolling, reduce particle motion, and keep the full narrative readable. The
closing CTA is always a real, keyboard-reachable link.

**Visual-first verification.** Cinematic work is not verified by typecheck,
lint, build, curl or SSR HTML. It must be inspected in a real browser —
scrolled through the full sequence, with pointer interaction, at the target
1440×900 — before it is described as working. If browser access is
unavailable, say so explicitly and ask for a manual review rather than
implying the visual result has been confirmed.

## 8. COMPONENT DISCIPLINE

Do not use 21st.dev or React Bits components merely because they are
visually impressive. Any third-party component or animation must conform
to the established maritime intelligence design system and must improve
usability or storytelling. Avoid cyberpunk aesthetics, excessive neon,
excessive glassmorphism, excessive gradients, decorative 3D objects, and
unnecessary animation.

This applies to every frontend surface, not only the landing page:
component and motion choices in the investigation wizard, map UI, and
dossier are held to the same standard as parent §68 (professional maritime
intelligence tool; avoid generic Bootstrap appearance, pointless
animations, card overload, decorative UI that does not support the
investigation).

## 9. DIRECTORY STRUCTURE

Adapting parent §56 to the Next.js App Router:

```
src/
  app/            routes, layouts
  components/     feature components + shadcn/ui primitives
  lib/            utils, cn(), shared helpers
  services/       API client (api.ts)
  types/          TS types mirroring backend contracts
  hooks/          custom hooks
  store/          reserved, empty unless/until Zustand is approved
```

## 10. INSTALLATION DISCIPLINE

Before installing anything, apply parent §55: "Do we actually need this?"
Do not install UI/animation/geospatial libraries beyond §2 until a concrete
component needs them. Do not install a second library that solves a problem
already solved by an approved one (no second map library, no second forms
library, no second HTTP client). Landing-page-only libraries (§3, §7) stay
uninstalled until the landing page is actively being built.

## 11. WHEN IN DOUBT

If a new frontend requirement seems to need a technology not listed here,
or seems to conflict with a parent CLAUDE.md product/workflow/content rule,
STOP and flag the conflict rather than silently choosing — per parent
CLAUDE.md §3 and §82.
