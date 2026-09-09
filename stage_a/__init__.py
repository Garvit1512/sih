"""Stage A — SAR oil-spill detection and characterization.

Scope Stage A of the SIH 26143 pipeline, decomposed in docs/staged-build-reference.md as
Stages 3 (corpus), 6 (segmentation model), 7 (vectorization), 8 (look-alike confidence),
9 (geometric properties) and 10 (evaluation harness).

This package is deliberately separate from `backend/`: it carries the heavy ML
dependencies (torch and friends), while the FastAPI service depends only on the frozen
`DetectionResult` contract. The seam between them is
`backend/app/integrations/real/real_detection.py`, which reads the artifact this package
produces — so the API never imports torch and the demo never waits on live inference.
"""

__all__ = ["config", "confidence", "geometry", "vectorize"]
