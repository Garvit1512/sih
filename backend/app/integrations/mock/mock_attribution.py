"""Deterministic Stage D mock (PRD §31). See mock_detection.py for the pattern rationale.

Only called by the orchestrator when Stage B routing allows it (likely-vessel or
insufficient-evidence) -- this provider never decides on its own whether to run.
"""

from __future__ import annotations

import json

from app.core.errors import CaseNotFoundError
from app.core.paths import CASES_DIR
from app.schemas.attribution import AttributionResult


class MockAttributionProvider:
    def get_result(self, case_id: str) -> AttributionResult:
        path = CASES_DIR / case_id / "attribution.json"
        if not path.exists():
            raise CaseNotFoundError(f"No mock attribution data for case '{case_id}'.")
        with path.open(encoding="utf-8") as f:
            return AttributionResult.model_validate(json.load(f))
