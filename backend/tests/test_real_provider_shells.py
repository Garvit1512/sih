"""Stage C/D real-provider factory wiring (docs/stage-c-d-integration-plan.md §5.1).

`get_drift_provider()`/`get_attribution_provider()` must always return something
conforming to the Protocol -- never raise themselves -- so the orchestrator, Stage B,
and Stage E stay indifferent to mock vs. real (`app/integrations/base.py`'s stated
purpose). `RealDriftProvider`/`RealAttributionProvider` now do real work when given
their required context (`detection`/`drift`); calling them standalone without it raises
a clear `ValueError` rather than doing something undefined."""

from __future__ import annotations

import pytest

from app.core.config import Settings
from app.integrations.real.real_attribution import RealAttributionProvider
from app.integrations.real.real_drift import RealDriftProvider
from app.integrations.stage_c import get_drift_provider
from app.integrations.stage_d import get_attribution_provider


def test_get_drift_provider_returns_real_shell_without_raising(monkeypatch):
    monkeypatch.setattr(
        "app.integrations.stage_c.settings", Settings(stage_c_mode="real")
    )
    provider = get_drift_provider()
    assert isinstance(provider, RealDriftProvider)


def test_real_drift_provider_requires_detection():
    with pytest.raises(ValueError, match="requires `detection`"):
        RealDriftProvider().get_result("OS-001")


def test_get_attribution_provider_returns_real_shell_without_raising(monkeypatch):
    monkeypatch.setattr(
        "app.integrations.stage_d.settings", Settings(stage_d_mode="real")
    )
    provider = get_attribution_provider()
    assert isinstance(provider, RealAttributionProvider)


def test_real_attribution_provider_requires_drift():
    with pytest.raises(ValueError, match="requires `drift`"):
        RealAttributionProvider().get_result("OS-001")
