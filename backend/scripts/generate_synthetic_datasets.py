"""Generates the persisted synthetic datasets behind the real (non-mock) Stage C/D
engines: `data/synthetic_forcing/<case_id>/current_field.json` and
`data/synthetic_ais/<case_id>/scenario.json` for every curated demo case.

See docs/stage-c-d-integration-plan.md §6/§7. Run this once whenever a case is added or
the underlying generation logic changes; the providers (`RealDriftProvider`,
`RealAttributionProvider`) only ever read these files, they never generate inline. Safe
to re-run: fully deterministic, overwrites with identical content given identical code.

Usage (from `backend/`, with the project's venv active):

    python scripts/generate_synthetic_datasets.py
"""

from __future__ import annotations

import json
from pathlib import Path

from app.core.config import settings
from app.core.paths import CASES_DIR, SYNTHETIC_AIS_DIR, SYNTHETIC_FORCING_DIR
from app.integrations.mock.mock_detection import MockDetectionProvider
from app.integrations.real.ais_generator import generate_scenario, serialize_tracks
from app.integrations.real.attribution_scoring import compute_drift_bearing
from app.integrations.real.drift_physics import derive_idealized_current_parameters
from app.integrations.real.real_drift import SYNTHETIC_FORCING_DISCLOSURE, RealDriftProvider

CASE_IDS = sorted(p.name for p in CASES_DIR.iterdir() if p.is_dir())


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def generate_forcing_data(case_id: str) -> None:
    base_speed_mps, base_bearing_deg = derive_idealized_current_parameters(case_id)
    _write_json(
        SYNTHETIC_FORCING_DIR / case_id / "current_field.json",
        {
            "case_id": case_id,
            "base_speed_mps": round(base_speed_mps, 4),
            "base_bearing_deg": round(base_bearing_deg, 2),
            "disclosure": SYNTHETIC_FORCING_DISCLOSURE,
        },
    )


def generate_ais_scenario(case_id: str) -> None:
    # Reads the current_field.json just written above via RealDriftProvider, so the AIS
    # scenario is generated against the same origin/bearing the real drift engine
    # actually produces -- not recomputed independently and potentially inconsistent.
    detection = MockDetectionProvider().get_result(case_id)
    drift = RealDriftProvider().get_result(case_id, detection=detection)
    drift_bearing = compute_drift_bearing(drift.hindcast.path)

    tracks = generate_scenario(
        case_id=case_id,
        origin=drift.hindcast.origin,
        origin_time_window=drift.hindcast.origin_time_window,
        drift_bearing_deg=drift_bearing,
        background_count=settings.attribution_background_vessel_count,
    )
    _write_json(
        SYNTHETIC_AIS_DIR / case_id / "scenario.json",
        {
            "case_id": case_id,
            "generated_from_drift_origin": {
                "lat": drift.hindcast.origin.lat,
                "lon": drift.hindcast.origin.lon,
            },
            "disclosure": (
                "AIS tracks shown in this demonstration are synthetically generated "
                "for controlled validation and do not represent live vessel traffic."
            ),
            "tracks": serialize_tracks(tracks),
        },
    )


def main() -> None:
    for case_id in CASE_IDS:
        generate_forcing_data(case_id)
        generate_ais_scenario(case_id)
        print(f"generated synthetic forcing + AIS data for {case_id}")


if __name__ == "__main__":
    main()
