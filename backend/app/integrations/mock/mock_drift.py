"""Deterministic Stage C mock (PRD §31). See mock_detection.py for the pattern rationale."""

from __future__ import annotations

import json

from app.core.errors import CaseNotFoundError
from app.core.paths import CASES_DIR
from app.integrations.validation import validate_stage_result
from app.schemas.detection import DetectionResult
from app.schemas.drift import DriftResult


class MockDriftProvider:
    def get_result(self, case_id: str, detection: DetectionResult | None = None) -> DriftResult:
        # `detection` is part of the Protocol (RealDriftProvider needs it) but unused
        # here -- the mock fixture is already self-contained per case.
        path = CASES_DIR / case_id / "drift.json"
        if not path.exists():
            raise CaseNotFoundError(f"No mock drift data for case '{case_id}'.")
        with path.open(encoding="utf-8") as f:
            raw = json.load(f)
        return validate_stage_result(DriftResult, raw, stage="C", case_id=case_id)
