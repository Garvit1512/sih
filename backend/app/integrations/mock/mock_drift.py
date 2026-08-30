"""Deterministic Stage C mock (PRD §31). See mock_detection.py for the pattern rationale."""

from __future__ import annotations

import json

from app.core.errors import CaseNotFoundError
from app.core.paths import CASES_DIR
from app.schemas.drift import DriftResult


class MockDriftProvider:
    def get_result(self, case_id: str) -> DriftResult:
        path = CASES_DIR / case_id / "drift.json"
        if not path.exists():
            raise CaseNotFoundError(f"No mock drift data for case '{case_id}'.")
        with path.open(encoding="utf-8") as f:
            return DriftResult.model_validate(json.load(f))
