"""Stage D provider selection (PRD §67/§68). Swaps mock <-> real via config, with zero
change required in Stage B, orchestration, or the frontend."""

from __future__ import annotations

from app.core.config import settings
from app.integrations.base import AttributionProvider
from app.integrations.mock.mock_attribution import MockAttributionProvider


def get_attribution_provider() -> AttributionProvider:
    if settings.stage_d_mode == "mock":
        return MockAttributionProvider()
    raise NotImplementedError(
        "RealAttributionProvider is not yet implemented. Stage D internals are owned by "
        "another team member; wire in their adapter here when available."
    )
