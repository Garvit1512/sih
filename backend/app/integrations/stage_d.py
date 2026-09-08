"""Stage D provider selection (PRD §67/§68). Swaps mock <-> real via config, with zero
change required in Stage B, orchestration, or the frontend."""

from __future__ import annotations

from app.core.config import settings
from app.integrations.base import AttributionProvider
from app.integrations.mock.mock_attribution import MockAttributionProvider
from app.integrations.real.real_attribution import RealAttributionProvider


def get_attribution_provider() -> AttributionProvider:
    if settings.stage_d_mode == "mock":
        return MockAttributionProvider()
    return RealAttributionProvider()
