# Data provenance

## Infrastructure (`infrastructure/`)

`platforms.geojson` and `pipelines.geojson` are a **small, hand-verified static
dataset**, not sourced from Global Energy Monitor or OpenStreetMap yet (PRD §16).
Every coordinate here is **synthetic/placeholder**, constructed specifically to make the
three demo cases below produce their intended Stage B hypothesis — they do not
represent real offshore infrastructure. This must be replaced with (or supplemented by)
verified public data, or clearly-labelled hand-verified real infrastructure, before any
claim of realism is made in the demo.

| Feature | ID | Purpose |
|---|---|---|
| Platform P-17 | `P-17` | Placed ~1.7 km from `OS-002`'s drift origin so the platform-proximity check fires within the default `TRIAGE_PLATFORM_RADIUS_KM=5.0` threshold. |
| Pipeline PL-04 | `PL-04` | Placed ~1.5 km from `OS-003`'s drift origin so the pipeline-proximity check fires within the default `TRIAGE_PIPELINE_RADIUS_KM=2.0` threshold. |

## Cases (`cases/`)

All three cases (`OS-001`, `OS-002`, `OS-003`) use deterministic, hand-authored mock
`detection.json`/`drift.json`/`attribution.json` fixtures — never randomly generated
(PRD §28).

`OS-001` is the required real, documented historical spill (PRD §4.5/§59) — **its
coordinates and metadata are currently PROVISIONAL placeholders**, not a real incident.
It must be replaced with a specific ITOPF- or NOAA ERMA-sourced case (known location and
timing) before it is presented as historical ground truth. See the architecture audit
plan §11.5.

## Thresholds

`TRIAGE_PLATFORM_RADIUS_KM` / `TRIAGE_PIPELINE_RADIUS_KM` (see `backend/app/core/config.py`)
are placeholder values (5.0 km / 2.0 km) pending explicit team sign-off (PRD §57).
