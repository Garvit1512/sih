"""Real Stage A adapter — reads the artifact produced by the `stage_a` package.

Deliberately kept separate from the mock's file (`detection.real.json` vs
`detection.json`) so that mock and real are never confused for one another. A demo that
silently fell back to hand-authored fixtures while claiming to run a real model would be
the most damaging failure available to this integration, and a shared filename is exactly
how that happens.

The artifact is validated against `DetectionResult` on every read rather than trusted.
Per CLAUDE.md §46, an upstream payload that does not satisfy the frozen schema fails
clearly and says so — it is never silently repaired.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.core.errors import CaseNotFoundError
from app.core.paths import CASES_DIR
from app.schemas.detection import DetectionResult

ARTIFACT_NAME = "detection.real.json"


class StageAContractError(RuntimeError):
    """Raised when a real Stage A artifact does not satisfy the frozen contract."""


class RealDetectionProvider:
    """Serves model-produced detection artifacts through the frozen contract."""

    def __init__(self, cases_dir: Path | None = None, artifact_name: str = ARTIFACT_NAME) -> None:
        self.cases_dir = cases_dir or CASES_DIR
        self.artifact_name = artifact_name

    def get_result(self, case_id: str) -> DetectionResult:
        path = self.cases_dir / case_id / self.artifact_name

        if not path.exists():
            raise CaseNotFoundError(
                f"No real Stage A artifact for case '{case_id}' at {path}. Produce one with: "
                f"python -m stage_a.cli detect --case-id {case_id} --scene <scene.tif> "
                f"--detected-at <UTC ISO> --checkpoint <best.pt>"
            )

        with path.open(encoding="utf-8") as handle:
            payload = json.load(handle)

        # Underscore-prefixed keys are Stage A's own provenance/evidence, not contract
        # fields. Stripping them keeps validation strict about what the contract declares.
        contract_payload = {k: v for k, v in payload.items() if not k.startswith("_")}

        try:
            return DetectionResult.model_validate(contract_payload)
        except Exception as exc:
            raise StageAContractError(
                f"Stage A response failed DetectionResult schema validation for case "
                f"'{case_id}' ({path}): {exc}"
            ) from exc
