"""Typed application configuration (PRD §57/§58).

Thresholds and stage-provider modes must never be hardcoded into business logic —
everything here is overridable via environment variables / `.env`. Threshold defaults
below are placeholders pending explicit team sign-off (see docs/decisions.md #6-#8).
"""

from __future__ import annotations

from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"
    debug: bool = True
    api_timeout_seconds: int = 30
    cors_allowed_origin: str = "http://localhost:5173"

    # Stage B thresholds — PLACEHOLDER, not yet team-approved (see docs/decisions.md #6-#8)
    triage_platform_radius_km: float = 5.0
    triage_pipeline_radius_km: float = 2.0

    # Upstream stage integration mode
    stage_a_mode: Literal["mock", "real"] = "mock"
    stage_c_mode: Literal["mock", "real"] = "mock"
    stage_d_mode: Literal["mock", "real"] = "mock"

    # Stage C real-engine parameters (docs/stage-c-d-integration-plan.md). Drives a real
    # Lagrangian particle-advection simulation over an idealized, synthetic current
    # field -- not real oceanographic data. Engineering/demo-generation parameters, not
    # a legally-sensitive threshold like the triage radii above.
    drift_hindcast_hours: float = 6.0
    drift_forecast_hours: float = 24.0
    drift_step_minutes: float = 30.0
    drift_origin_time_window_pad_hours: float = 1.0
    drift_origin_tolerance_km_per_hour: float = 0.8

    # Stage D real-engine parameters (docs/stage-c-d-integration-plan.md). Drives
    # deterministic synthetic AIS scenario generation and scoring. The confidence
    # thresholds are PLACEHOLDER values, not yet team-approved, same status as the
    # Stage B radii above (see docs/decisions.md #12) -- they directly determine a
    # vessel's High/Medium/Low investigative label (CLAUDE.md §22).
    attribution_candidate_search_radius_km: float = 60.0
    attribution_time_window_pad_hours: float = 3.0
    attribution_background_vessel_count: int = 4
    attribution_proximity_weight: float = 0.5
    attribution_trajectory_weight: float = 0.5
    attribution_high_confidence_threshold: float = 70.0
    attribution_medium_confidence_threshold: float = 40.0


settings = Settings()
