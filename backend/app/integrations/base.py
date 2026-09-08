"""Adapter interfaces for Stages A/C/D (PRD §67/§68).

The orchestrator, Stage B, and Stage E depend only on these Protocols -- never on the
mock or real implementations directly -- so `MockStageX` can be swapped for
`RealStageX` without touching frontend, reporting, or triage code.
"""

from __future__ import annotations

from typing import Protocol

from app.schemas.attribution import AttributionResult
from app.schemas.detection import DetectionResult
from app.schemas.drift import DriftResult


class DetectionProvider(Protocol):
    def get_result(self, case_id: str) -> DetectionResult: ...


class DriftProvider(Protocol):
    def get_result(self, case_id: str, detection: DetectionResult | None = None) -> DriftResult:
        """`detection` is optional for signature compatibility with `MockDriftProvider`,
        which ignores it (its fixture is self-contained). `RealDriftProvider` requires
        it -- a real engine seeds particles from the detected spill's centroid and
        timestamp. The orchestrator always supplies it (see
        docs/stage-c-d-integration-plan.md)."""
        ...


class AttributionProvider(Protocol):
    def get_result(self, case_id: str, drift: DriftResult | None = None) -> AttributionResult:
        """`drift` is optional for signature compatibility with
        `MockAttributionProvider`, which ignores it (its fixture is self-contained).
        `RealAttributionProvider` requires it -- real candidate filtering/scoring needs
        the hindcast origin, time window, and path. The orchestrator always supplies it
        (see docs/stage-c-d-integration-plan.md)."""
        ...
