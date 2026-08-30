"""Deterministic Stage A mock (PRD §31).

Reads a hand-authored, fixed `detection.json` per case -- never randomly generated -- so
a judge sees identical output on every run (CLAUDE.md §28).
"""

from __future__ import annotations

import json

from app.core.errors import CaseNotFoundError
from app.core.paths import CASES_DIR
from app.schemas.detection import DetectionResult


class MockDetectionProvider:
    def get_result(self, case_id: str) -> DetectionResult:
        path = CASES_DIR / case_id / "detection.json"
        if not path.exists():
            raise CaseNotFoundError(f"No mock detection data for case '{case_id}'.")
        with path.open(encoding="utf-8") as f:
            return DetectionResult.model_validate(json.load(f))
