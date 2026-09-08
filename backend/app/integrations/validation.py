"""Shared schema-validation wrapper for Stage A/C/D providers (mock and real).

Turns a Pydantic `ValidationError` into `UpstreamContractError` with a stage- and
case-specific message, per CLAUDE.md §46 ("Stage A response failed DetectionResult
schema validation."). Both mock and real providers call this rather than
`Model.model_validate()` directly, so a malformed fixture and a malformed real response
fail identically -- see docs/stage-c-d-integration-plan.md §5.2.
"""

from __future__ import annotations

from typing import TypeVar

from pydantic import BaseModel, ValidationError

from app.core.errors import UpstreamContractError

ModelT = TypeVar("ModelT", bound=BaseModel)


def validate_stage_result(
    model_cls: type[ModelT], raw: object, *, stage: str, case_id: str
) -> ModelT:
    try:
        return model_cls.model_validate(raw)
    except ValidationError as exc:
        raise UpstreamContractError(
            f"Stage {stage} response for case '{case_id}' failed "
            f"{model_cls.__name__} schema validation: {exc}"
        ) from exc
