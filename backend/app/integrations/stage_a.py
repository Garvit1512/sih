"""Stage A provider selection (PRD §67/§68). Swaps mock <-> real via config, with zero
change required in Stage B, orchestration, or the frontend."""

from __future__ import annotations

from app.core.config import settings
from app.integrations.base import DetectionProvider
from app.integrations.mock.mock_detection import MockDetectionProvider


def get_detection_provider() -> DetectionProvider:
    if settings.stage_a_mode == "mock":
        return MockDetectionProvider()
    raise NotImplementedError(
        "RealDetectionProvider is not yet implemented. Stage A internals are owned by "
        "another team member; wire in their adapter here when available."
    )
