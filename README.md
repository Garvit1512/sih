# Satellite-Based Oil Spill Investigation Platform (SIH 2026)

An explainable decision-support platform combining satellite oil-spill detection,
source-type triage, ocean drift modelling, and AIS-correlated vessel attribution into a
guided investigation workflow.

**This is a decision-support lead list, not a legal determination system.**

See `prd.md` for the full product requirements, `CLAUDE.md` for engineering rules and
ownership boundaries, and `docs/contracts.md` for the frozen cross-stage API contracts.

---

## Project Overview

The pipeline is: SAR Detection (**Stage A**) → Source-Type Triage (**Stage B**) → Drift
Hindcast (**Stage C**) → Conditional Vessel Attribution (**Stage D**) → Forward Forecast →
Investigator's Dossier (**Stage E**) → guided frontend.

**Currently implemented** (real code, in `backend/`):
- Full Pydantic contract layer for every stage's inputs/outputs (`backend/app/schemas/`)
- **Stage B** — the triage/routing engine that decides platform vs. pipeline vs. vessel
  vs. insufficient-evidence, and gates whether vessel attribution runs at all
  (`backend/app/services/triage_service.py`)
- The investigation orchestrator that wires Stage A → C → B → (D) → E together
  (`backend/app/services/investigation_service.py`)
- **Stage E** — dossier/report compilation, including the frozen disclaimer text and the
  synthetic-AIS disclosure (`backend/app/services/report_service.py`)
- Case management, an in-memory investigation repository, and the full REST API surface
  (`backend/app/api/`: cases, investigation, detection, drift, triage, attribution, report)
- A test suite that enforces the project's non-negotiable rules in code, not just docs
  (contract validation, triage routing, and the report's language/disclosure rules)

**Currently mocked** (real logic owned by other team members, not us):
- **Stage A** (SAR detection), **Stage C** (drift modelling), **Stage D** (AIS vessel
  attribution) all run through `Protocol`-typed provider adapters
  (`backend/app/integrations/base.py`) with deterministic mock implementations
  (`backend/app/integrations/mock/`). Switching a stage from mock to real is a one-line
  config change (`STAGE_A_MODE` / `STAGE_C_MODE` / `STAGE_D_MODE` in `.env`) — the
  orchestrator and frontend never need to know which mode is active.

**Future / aspirational** (not implemented — do not assume otherwise):
- The **entire frontend**. `frontend/` does not exist in this repository yet. Everything
  described about the React/Mapbox investigation UI in this README, `prd.md`, and
  `CLAUDE.md` is a plan, not working code.
- Real Stage A/C/D model implementations (SAR segmentation, OpenDrift/OpenOil physics,
  AIS scoring) — these belong to teammates and are out of scope for this repository's
  current code.
- PDF export (`reportlab` is a declared-but-unused optional dependency).
- The 50-stage build roadmap in `docs/staged-build-reference.md` — most of it describes
  future work; only a handful of its stages (contract freeze, triage, orchestration,
  dossier assembly, REST API surface) have real code behind them today.

---

## Current Architecture

```
api/            FastAPI routers — thin controllers (cases, investigation, detection,
                drift, triage, attribution, report)
   ↓
services/       business logic — triage_service, investigation_service (orchestrator),
                report_service, case_service
   ↓
integrations/   provider selection (stage_a.py / stage_c.py / stage_d.py switch
                mock ↔ real via Settings) and Protocol interfaces (base.py):
                DetectionProvider / DriftProvider / AttributionProvider
   ↓
integrations/mock/   MockDetectionProvider / MockDriftProvider / MockAttributionProvider
                      — deterministic, demo-safe stand-ins for teammates' real models
   ↓
schemas/ + data/     Pydantic contracts (common, detection, drift, triage, attribution,
                      investigation, report) and curated demo/infrastructure data
                      (backend/app/data/infrastructure.py, demo_cases.py)
```

Cross-cutting: `core/config.py` (typed `Settings`, env-driven, no hardcoded thresholds),
`core/errors.py` (`AppError` hierarchy → clean JSON error responses, never a raw
traceback), `core/logging.py` (structured logs).

The routing rule that makes Stage B meaningful: if triage concludes `likely-platform`,
`likely-pipeline`, or `possible-natural-seep`, **Stage D (vessel attribution) does not
run** — this is enforced by `test_triage.py` and `test_investigation.py`, not just
described in prose.

---

## Repository layout

```
backend/       FastAPI service — Stage B triage engine, orchestration, Stage E reporting
data/          Curated demo cases and infrastructure (platform/pipeline) datasets
docs/          Frozen contract reference (docs/contracts.md) and the build-plan roadmap
graphify-out/  The shared "Hive Mind" knowledge graph — see below
prd.md         Product requirements
CLAUDE.md      Engineering rules and ownership boundaries for AI-assisted development
```

`frontend/` is not yet present — see "Future / aspirational" above.

## Getting started

### Backend (implemented, runnable today)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Backend runs at http://localhost:8000. Health check: `GET /api/health`.
Copy `.env.example` to `.env` (repo root or `backend/.env`) to override thresholds or
switch a stage to `real` mode once a teammate's model is ready.

### Frontend (not yet implemented)

There is no `frontend/` directory yet. The `MAPBOX_TOKEN` / `API_BASE_URL` /
`MAP_DEFAULT_*` variables in `.env.example` are reserved for when frontend work starts —
they do nothing today.

## Demo cases

Four curated, deterministic cases demonstrate that Stage B actually gates vessel
attribution rather than always blaming a vessel:

| Case | Hypothesis | Stage D runs? | Notes |
|---|---|---|---|
| OS-001 | likely-vessel | yes | ranked lead list produced |
| OS-002 | likely-platform | no | stationary source identified |
| OS-003 | likely-pipeline | no | stationary source identified |
| OS-004 | insufficient-evidence | yes | leads produced, flagged low-confidence |

`OS-004` exercises the fourth routing path: no stationary source is close enough and no
vessel evidence is available, so Stage D still runs but its result carries
`low_confidence: true` — a field consumers branch on, not just prose. See
`docs/decisions.md` #2-#3 for why this routes to Stage D rather than skipping it.

See `data/README.md` for dataset provenance.

---

## What Is the Hive Mind?

"Hive Mind" is this project's name for the shared, machine-readable understanding of the
codebase that every teammate and every Claude Code session gets automatically, instead of
everyone re-deriving architecture knowledge from scratch by grepping around.

It's four things working together:

- **Graphify** — a tool that reads this entire repository (code, docs, PRD, contracts)
  and builds a knowledge graph out of it: files, functions, classes, schemas, and
  documentation concepts as nodes, with typed edges (`imports`, `calls`, `contains`,
  `inherits`, `references`, `shares_data_with`, …) between them, grouped into
  auto-detected communities (e.g. "Stage B triage", "report/dossier", "docs roadmap").
- **`graph.json`** — the graph itself, serialized. This is the actual shared artifact:
  a queryable representation of "what exists in this repo and how it connects."
- **Graphify MCP** — an MCP server that exposes the graph to Claude Code as tools
  (`query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`,
  `graph_stats`, `shortest_path`). This is how Claude answers "how does X work?" by
  querying a pre-built graph instead of re-reading the whole repo every time.
- **Obsidian** — a note-taking app that turns `graphify-out/obsidian/` into a browsable,
  visually-linked knowledge base: one Markdown note per graph node, cross-linked with
  `[[wikilinks]]`, plus a pre-arranged `graph.canvas` layout and Obsidian's built-in
  Graph View for a literal visual map of the codebase.

The important distinction to keep in mind:

| Layer | Role |
|---|---|
| **Obsidian** | The human visual brain — browse, click through, and see the architecture |
| **`graph.json` + Graphify MCP** | Claude's machine-readable project memory — queried, not read |
| **Git** | Synchronization/distribution — every teammate gets the *same* graph via `git pull` |
| **`CLAUDE.md`** | Project rules/context — what the graph *means* and how Claude should act on it |

Nobody has to regenerate the graph to benefit from it — it's committed to git like any
other project artifact. You only regenerate it when the codebase has changed enough that
the graph is stale (see "Updating the Hive Mind" below).

## Hive Mind Architecture

```
Developer
   ↓
Git repository
   ├── source code
   ├── CLAUDE.md
   └── graphify-out/
       ├── graph.json          ← the graph (nodes, edges, communities)
       ├── GRAPH_REPORT.md     ← plain-language summary of the graph
       ├── graph.html          ← standalone interactive visualization (no tools needed)
       └── obsidian/           ← one .md note per graph node + wikilinks
           └── graph.canvas    ← pre-arranged visual layout
                ↓
     Obsidian  ⇆  Claude Code (Graphify MCP)
                ↓
        Shared project understanding
```

Every teammate who clones this repo and runs `git pull` gets the *exact same* graph —
same nodes, same edges, same community labels — because it's committed, not
locally-generated-and-forgotten. Regenerating it (see below) is only needed after real
code changes, and the update should itself be committed so the next `git pull` carries it
forward.

---

## Setting Up the Hive Mind

Assume a fresh Windows machine that already has **Python 3.11+**, **uv** (or `pip`),
**Claude Code**, and **Obsidian** installed — this guide does not (re)install any of
those. If one is genuinely missing, install it via its own official instructions first,
then come back here.

### Step 1 — Clone the repository

```powershell
git clone <repository-url>
cd sih
```

At this point `graphify-out/graph.json`, `GRAPH_REPORT.md`, `graph.html`, and
`graphify-out/obsidian/` are **already on disk** — they came from git. You do not need to
run graphify yet just to look around.

### Step 2 — Install the graphify CLI (one-time, per machine)

The graph is committed, but querying it (via Claude Code's Graphify MCP tools, or the
`graphify` CLI) still requires the `graphify` package installed locally — it's not
bundled inside `graph.json`.

```powershell
uv tool install graphifyy
# or, without uv:
pip install graphifyy
```

Verify it's on PATH:

```powershell
graphify --help
```

### Step 3 — Open the project in Claude Code

```powershell
claude
```

The project's `.claude/skills/graphify/` and `.claude/settings.json` (committed to git)
are already wired in — Claude Code will treat any codebase question as a graph query
first, per the "graphify" section in `CLAUDE.md`. You do **not** need to run a fresh
`/graphify` extraction; the graph already exists and is checked into git. Running
`/graphify` again on an unchanged repo would just re-spend tokens rebuilding what you
already have.

### Step 4 — Register the Graphify MCP server (one-time, per machine)

This gives Claude Code the live `mcp__graphify__*` tools (`query_graph`, `get_node`,
`get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, `shortest_path`) instead of
only the `/graphify` slash command. The server needs the **absolute path** to the Python
interpreter that owns your `graphify` install — this is machine-specific, which is why
it's never committed to git (see `.gitignore`).

```powershell
$graphifyPython = Join-Path (Split-Path (Get-Command graphify).Source) "python.exe"
$graphPath = (Resolve-Path "graphify-out/graph.json").Path

claude mcp add graphify -- $graphifyPython -m graphify.serve $graphPath
```

Restart/reopen the Claude Code session if it was already running. Confirm the tools are
available by asking Claude something like "what are the god nodes in this repo?" — it
should call `mcp__graphify__god_nodes` rather than grepping the filesystem.

> If your MCP client is Claude Desktop instead of Claude Code, add the equivalent block
> to `claude_desktop_config.json` (see `.claude/skills/graphify/references/exports.md`):
> ```json
> { "mcpServers": { "graphify": {
>     "command": "<value of $graphifyPython above>",
>     "args": ["-m", "graphify.serve", "<value of $graphPath above>"]
> } } }
> ```

### Step 5 — Open the Obsidian vault

1. Open Obsidian.
2. **Open folder as vault** → select `graphify-out/obsidian/` inside your clone.
3. Use Obsidian's **Graph View** for the literal visual map, or open `graph.canvas` for
   the pre-arranged layout. Every note is cross-linked via `[[wikilinks]]` and tagged by
   community (e.g. `#community/Stage_A/C/D_Provider_Contracts`).

That's it — you now have the same Hive Mind as everyone else on the team: Claude Code
queries the graph via MCP, you browse it visually via Obsidian, and both stay in sync
through git.

---

## Updating the Hive Mind when the codebase changes

The graph goes stale the moment code changes and nobody rebuilds it — a stale graph is
actively misleading, not just outdated, so treat regeneration as part of a normal change,
not an afterthought.

**Manual update** (recommended default — run after a meaningful batch of changes, before
committing):

```powershell
graphify . --update
```

This re-extracts only new/changed files (incremental, cheap) and rewrites `graph.json`,
`GRAPH_REPORT.md`, and `graph.html`. Regenerate the Obsidian vault too if you want the
notes/wikilinks to reflect the change:

```powershell
graphify . --update --obsidian
```

Then commit the regenerated artifacts like any other change:

```powershell
git add graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/graph.html graphify-out/obsidian
git commit -m "chore: update Hive Mind graph"
git push
```

**Automatic on every commit** (optional, install once per machine):

```powershell
graphify hook install
```

This installs a post-commit hook that detects changed files via `git diff HEAD~1` and
rebuilds the graph automatically after each commit — no manual `--update` needed for code
changes. Doc/PRD/CLAUDE.md changes still need a manual `--update` (the hook only tracks
code diffs). Remove it with `graphify hook uninstall`.

**Continuous watch mode** (optional, for long working sessions):

```powershell
graphify . --watch
```

Rebuilds automatically as you save files — no LLM calls needed for structural (code)
changes, since AST extraction is deterministic.

Whichever workflow you use, the point is the same: **the graph is only useful to your
teammates if you commit the update.** A locally-fresh, never-pushed graph doesn't help
anyone but you.

---

## What's committed vs. ignored, and why

| Path | Git status | Why |
|---|---|---|
| `graphify-out/graph.json` | **Committed** | The shared graph itself — the whole point of the Hive Mind |
| `graphify-out/GRAPH_REPORT.md` | **Committed** | Human-readable summary of the graph |
| `graphify-out/graph.html` | **Committed** | Standalone interactive visualization, no tooling required to view |
| `graphify-out/obsidian/` | **Committed** | The shared Obsidian vault (669 notes + `graph.canvas`) |
| `graphify-out/manifest.json` | Ignored | Per-file mtime/hash cache for incremental `--update` — timestamps are absolute and machine-specific; committing it churns every commit with zero shared value |
| `graphify-out/cost.json` | Ignored | Local LLM token/cost usage log, not project knowledge |
| `graphify-out/cache/` | Ignored | Regenerable AST/semantic extraction cache |
| `graphify-out/.graphify_*` | Ignored | Internal pipeline intermediates; `.graphify_python`/`.graphify_root` in particular hold an **absolute, per-machine path** — committing them would point teammates at your local interpreter |
| `.claude/settings.json` | **Committed** | Shared project hooks (graph-first read/search enforcement) |
| `.claude/skills/graphify/` | **Committed** | The installed graphify skill, so every teammate's Claude Code has it without a separate install step |
| `.claude/settings.local.json` | Ignored | Personal permission overrides, not shared config |
| `.mcp.json` | Ignored | Can embed an absolute, machine-specific interpreter path (see Step 4 above) |

This list reflects what was actually found in `graphify-out/` at the time of writing
(checked file-by-file, not assumed) — see `.gitignore` for the enforced rules.
