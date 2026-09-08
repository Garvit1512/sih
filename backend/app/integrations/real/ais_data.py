"""Loads the persisted synthetic AIS scenario behind `RealAttributionProvider`.

`data/synthetic_ais/<case_id>/scenario.json` is generated once by
`backend/scripts/generate_synthetic_datasets.py` (which calls `generate_scenario()` in
`ais_generator.py`), not generated inline at request time -- see
docs/stage-c-d-integration-plan.md §7. This mirrors how `MockAttributionProvider` loads
a per-case fixture, and makes the synthetic AIS dataset an inspectable,
version-controlled file rather than something that only exists inside a function call.
"""

from __future__ import annotations

import json
from datetime import datetime

from app.core.errors import CaseNotFoundError
from app.core.paths import SYNTHETIC_AIS_DIR
from app.integrations.real.ais_generator import AISReport, AISTrack


def load_scenario(case_id: str) -> list[AISTrack]:
    path = SYNTHETIC_AIS_DIR / case_id / "scenario.json"
    if not path.exists():
        raise CaseNotFoundError(
            f"No synthetic AIS scenario for case '{case_id}'. Run "
            "backend/scripts/generate_synthetic_datasets.py to generate it."
        )
    with path.open(encoding="utf-8") as f:
        raw = json.load(f)

    tracks = []
    for track in raw["tracks"]:
        reports = [
            AISReport(
                timestamp=datetime.fromisoformat(r["timestamp"]),
                lat=r["lat"],
                lon=r["lon"],
                speed_knots=r["speed_knots"],
                course_deg=r["course_deg"],
            )
            for r in track["reports"]
        ]
        tracks.append(
            AISTrack(
                vessel_id=track["vessel_id"],
                vessel_name=track["vessel_name"],
                reports=reports,
            )
        )
    return tracks
