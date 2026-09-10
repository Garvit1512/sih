# Stage A — SAR Oil Spill Detection & Characterization

Scope Stage A of the SIH 26143 pipeline. In `docs/staged-build-reference.md` terms this
package covers **Stage 3** (corpus preprocessing), **Stage 6** (segmentation model),
**Stage 7** (inference + mask-to-polygon vectorization), **Stage 8** (look-alike
confidence), **Stage 9** (geometric properties) and **Stage 10** (evaluation harness).

## Status — read this before quoting any number

| Piece | State |
|---|---|
| Preprocessing, dataset loading, palette decoding (Stage 3) | Code complete, tested |
| Model + loss + checkpointing (Stage 6) | Code complete, **not yet trained** |
| Vectorization, WGS84 output (Stage 7) | Code complete, tested |
| Look-alike confidence (Stage 8) | Code complete, tested |
| Geometric properties (Stage 9) | Code complete, tested |
| Evaluation harness (Stage 10) | Code complete, tested — **no metrics produced yet** |
| Backend integration (`STAGE_A_MODE=real`) | Wired and tested |
| Trained weights | **Do not exist.** No training run has happened. |
| IoU / Dice numbers | **Do not exist.** Anything quoted before a training run is fabricated. |

The pipeline is verified end-to-end against synthesized model output — 42 tests covering
axis order, metric geometry, confidence discrimination, metric arithmetic, and conformance
to the frozen `DetectionResult` schema. What has *not* happened is a real training run,
because that needs a GPU. Until `python -m stage_a.cli train` has actually been run on the
public corpus, Stage A has no accuracy figure, and per CLAUDE.md §60 the correct thing to
say about it is **"not yet evaluated"** — not an estimate.

## Where to train

Training needs CUDA or Apple Silicon. Options, in order of convenience:

1. **Google Colab free tier (T4 GPU)** — `notebooks/colab_train.ipynb` in this directory
   downloads the corpus, trains, evaluates, and hands back a `best.pt`. No local setup.
2. **Apple Silicon (M1-M4)** — works natively via PyTorch's MPS backend. `resolve_device()`
   selects it automatically. Expect hours, not days, with the default pretrained encoder.
3. **CPU** — a smoke test only. The training script warns when it lands here.

## Usage

```bash
# 1. Train (Stage 6)
python -m stage_a.cli train --data-root stage_a/data/raw/oil-spill --epochs 40

# 2. Measure on the official held-out split (Stage 10)
python -m stage_a.cli evaluate \
    --data-root stage_a/data/raw/oil-spill \
    --checkpoint stage_a/checkpoints/best.pt

# 3. Produce a case detection artifact (Stages 7-9)
python -m stage_a.cli detect \
    --scene path/to/OS-001.tif \
    --case-id OS-001 \
    --detected-at 2026-08-29T10:30:00Z \
    --checkpoint stage_a/checkpoints/best.pt
```

Step 3 writes `data/cases/OS-001/detection.real.json`. Setting `STAGE_A_MODE=real` in
`.env` makes the backend serve that artifact instead of the hand-authored mock — with no
change to Stage B, orchestration, reporting, or the frontend, per PRD §67.

## The dataset

The public 5-class SAR oil-spill corpus (Krestenitis et al.), classes: `sea_surface`,
`oil_spill`, `look_alike`, `ship`, `land`. Two things about it are load-bearing:

- **The official train/test split is preserved, never re-drawn.** Re-shuffling leaks
  near-duplicate scenes across the boundary and inflates every metric with no symptom.
- **The RGB label palette in `config.py` is a documented default, not an assumption.**
  `rgb_to_class_indices` reports colours it cannot map instead of folding them into the
  background class. If you see that warning, fix the palette before trusting any metric —
  a silent fold corrupts the class distribution and therefore every number downstream.

## Design decisions worth knowing

**Loss is cross-entropy + Dice.** Oil-spill pixels are a small minority; cross-entropy
alone is optimized by predicting "sea surface" everywhere, which scores well and is
useless. `test_evaluate.py::test_predicting_only_the_majority_class_is_visibly_punished`
pins that failure mode.

**Checkpoints are selected on oil-spill IoU, not loss or mean IoU.** The mean is dominated
by sea surface. Selecting on it produces a "best" checkpoint that is best at the easy part.

**Augmentation is geometry-only.** No brightness or contrast jitter: in SAR, backscatter
intensity *is* the physical signal separating oil from water, so perturbing it trains the
model to ignore the one cue that matters.

**Measurements are computed in a local equal-area projection, never in degrees.**
`polygon.area` on EPSG:4326 gives square degrees — a plausible-looking number that is
wrong by a latitude-dependent factor. See `test_geometry.py`.

**Inference is tiled with overlap**, and the demo reads a written artifact rather than
running a live forward pass (Stage 39's case artifact store), so a judge sees identical
output every run and the demo never waits on a model.

## Open contract issue for the team

`DetectionResult` has no representation for **"Stage A ran successfully and found
nothing."** `spill` is required, and so is its polygon.

`pipeline.detect_scene` therefore raises `NoDetectionError` rather than emitting a
zero-area polygon to satisfy the schema — a fabricated polygon would make Stage C seed a
drift run from a meaningless centroid and Stage B triage a spill that does not exist.

Per CLAUDE.md §72 this is raised, not silently worked around. A clean negative is a real
possible outcome of a detector and the contract should probably be able to express it, but
that is a frozen-contract change affecting Stage B, Stage E and the eventual frontend, so
it needs team sign-off rather than a unilateral edit.

## Tests

```bash
python -m pytest stage_a/tests -q      # 42 tests, no GPU or dataset required
```

They run without torch, without the corpus, and without trained weights: model output is
synthesized so the contract boundary and the geospatial maths stay verifiable anywhere.
