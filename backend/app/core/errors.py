"""Typed domain exceptions mapped to structured HTTP error envelopes (PRD §51/§59).

Every error response is `{"error": {"type", "message", "request_id"}}` — never a raw
Python stack trace (CLAUDE.md §38).
"""

from __future__ import annotations

import uuid

from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base class for domain errors with a stable HTTP status and error type."""

    status_code: int = 500
    error_type: str = "internal_error"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class CaseNotFoundError(AppError):
    status_code = 404
    error_type = "case_not_found"


class InvestigationNotFoundError(AppError):
    status_code = 404
    error_type = "investigation_not_found"


class UpstreamContractError(AppError):
    """Raised when a Stage A/C/D response fails schema validation (PRD §51)."""

    status_code = 502
    error_type = "upstream_contract_error"


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "type": exc.error_type,
                "message": exc.message,
                "request_id": str(uuid.uuid4()),
            }
        },
    )


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "type": "internal_error",
                "message": "An unexpected error occurred.",
                "request_id": str(uuid.uuid4()),
            }
        },
    )
