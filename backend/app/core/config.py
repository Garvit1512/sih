"""Typed application configuration (PRD §57/§58).

Thresholds and stage-provider modes must never be hardcoded into business logic —
everything here is overridable via environment variables / `.env`. Threshold defaults
below are placeholders pending explicit team sign-off (see docs/decisions.md and the
architecture audit plan §11).
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

    # Stage B thresholds — PLACEHOLDER, not yet team-approved (see plan §11.1)
    triage_platform_radius_km: float = 5.0
    triage_pipeline_radius_km: float = 2.0

    # Upstream stage integration mode
    stage_a_mode: Literal["mock", "real"] = "mock"
    stage_c_mode: Literal["mock", "real"] = "mock"
    stage_d_mode: Literal["mock", "real"] = "mock"


settings = Settings()
