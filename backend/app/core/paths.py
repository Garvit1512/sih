"""Central filesystem paths for the curated case/infrastructure datasets.

`data/` lives at the repo root (shared between backend loading and documentation), not
nested under `backend/` -- see the architecture audit plan §2.
"""

from __future__ import annotations

from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent
DATA_DIR = REPO_ROOT / "data"
CASES_DIR = DATA_DIR / "cases"
INFRASTRUCTURE_DIR = DATA_DIR / "infrastructure"
