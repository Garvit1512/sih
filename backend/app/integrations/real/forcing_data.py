"""Loads the persisted synthetic forcing-field parameters behind `RealDriftProvider`.

`data/synthetic_forcing/<case_id>/current_field.json` is generated once by
`backend/scripts/generate_synthetic_datasets.py`, not derived inline at request time --
see docs/stage-c-d-integration-plan.md §6. This mirrors how `MockDriftProvider` loads a
per-case fixture, and is deliberately not just recomputing
`derive_idealized_current_parameters(case_id)` on every call: persisting it makes the
"dataset" behind Stage C an inspectable, version-controlled file, the same as a real
forcing-data cache would be, even though its contents are synthetic.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

from app.core.errors import CaseNotFoundError
from app.core.paths import SYNTHETIC_FORCING_DIR


@dataclass(frozen=True)
class CurrentFieldParameters:
    base_speed_mps: float
    base_bearing_deg: float
    disclosure: str


def load_current_parameters(case_id: str) -> CurrentFieldParameters:
    path = SYNTHETIC_FORCING_DIR / case_id / "current_field.json"
    if not path.exists():
        raise CaseNotFoundError(
            f"No synthetic forcing data for case '{case_id}'. Run "
            "backend/scripts/generate_synthetic_datasets.py to generate it."
        )
    with path.open(encoding="utf-8") as f:
        raw = json.load(f)
    return CurrentFieldParameters(
        base_speed_mps=raw["base_speed_mps"],
        base_bearing_deg=raw["base_bearing_deg"],
        disclosure=raw["disclosure"],
    )
