"""POST /api/detect (PRD §29).

MVP scope: serves the case's mock/real Stage A result. Arbitrary SAR image upload is a
stretch feature (PRD §4.5/§6), not implemented here.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.integrations.stage_a import get_detection_provider
from app.schemas.detection import DetectionResult

router = APIRouter(prefix="/api", tags=["detection"])


class DetectRequest(BaseModel):
    case_id: str


@router.post("/detect")
def detect(request: DetectRequest) -> DetectionResult:
    return get_detection_provider().get_result(request.case_id)
