# Satellite-Based Oil Spill Investigation Platform (SIH 2026)

An explainable decision-support platform combining satellite oil-spill detection,
source-type triage, ocean drift modelling, and AIS-correlated vessel attribution into a
guided investigation workflow.

This is a decision-support lead list, not a legal determination system.

See `prd.md` for the full product requirements and `CLAUDE.md` for engineering rules and
ownership boundaries. See `docs/contracts.md` for the frozen cross-stage API contracts.

## Ownership

This repository is owned by the developer responsible for:

- Stage B — Source-Type Triage
- Stage E — Investigator's Dossier
- Backend/API and cross-stage integration
- React/Mapbox frontend

Stage A (SAR detection), Stage C (drift modelling), and Stage D (AIS attribution) are
owned by other team members and integrated via mock/real adapters (see
`backend/app/integrations/`).

## Repository layout

```
backend/    FastAPI service — Stage B triage engine, orchestration, Stage E reporting
frontend/   React + TypeScript + Mapbox investigation UI
data/       Curated demo cases and infrastructure (platform/pipeline) datasets
docs/       Frozen contract reference and architecture decisions
```

## Getting started

### Backend

```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

Backend runs at http://localhost:8000. Health check: `GET /api/health`.

### Frontend

```
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173. Requires `MAPBOX_TOKEN` in `frontend/.env`
(copy from `.env.example`).

## Demo cases

Three curated, deterministic cases demonstrate that Stage B actually gates vessel
attribution rather than always blaming a vessel:

| Case | Hypothesis | Stage D runs? |
|---|---|---|
| OS-001 | likely-vessel | yes |
| OS-002 | likely-platform | no |
| OS-003 | likely-pipeline | no |

See `data/README.md` for dataset provenance.
