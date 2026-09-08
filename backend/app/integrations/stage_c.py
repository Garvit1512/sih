"""Stage C provider selection (PRD §67/§68). Swaps mock <-> real via config, with zero
change required in Stage B, orchestration, or the frontend."""

from __future__ import annotations

from app.core.config import settings
from app.integrations.base import DriftProvider
from app.integrations.mock.mock_drift import MockDriftProvider
from app.integrations.real.real_drift import RealDriftProvider


def get_drift_provider() -> DriftProvider:
    if settings.stage_c_mode == "mock":
        return MockDriftProvider()
    return RealDriftProvider()
