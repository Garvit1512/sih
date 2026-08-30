from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import attribution, cases, detection, drift, investigation, report, triage
from app.core.config import settings
from app.core.errors import AppError, app_error_handler, unhandled_error_handler
from app.core.logging import configure_logging

configure_logging(debug=settings.debug)

app = FastAPI(title="Oil Spill Investigation Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_allowed_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(Exception, unhandled_error_handler)

app.include_router(cases.router)
app.include_router(detection.router)
app.include_router(drift.router)
app.include_router(triage.router)
app.include_router(attribution.router)
app.include_router(investigation.router)
app.include_router(report.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
