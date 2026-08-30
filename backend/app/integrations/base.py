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
    def get_result(self, case_id: str) -> DriftResult: ...


class AttributionProvider(Protocol):
    def get_result(self, case_id: str) -> AttributionResult: ...
