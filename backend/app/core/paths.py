"""Central filesystem paths for the curated case/infrastructure datasets.

`data/` lives at the repo root (shared between backend loading and documentation), not
nested under `backend/` -- see docs/decisions.md #5.
"""

from __future__ import annotations

from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent
DATA_DIR = REPO_ROOT / "data"
CASES_DIR = DATA_DIR / "cases"
INFRASTRUCTURE_DIR = DATA_DIR / "infrastructure"

# Persisted synthetic datasets behind the real (non-mock) Stage C/D engines -- see
# docs/stage-c-d-integration-plan.md §6/§7. Generated once per case by
# backend/scripts/generate_synthetic_datasets.py, not computed inline on every request.
SYNTHETIC_FORCING_DIR = DATA_DIR / "synthetic_forcing"
SYNTHETIC_AIS_DIR = DATA_DIR / "synthetic_ais"
