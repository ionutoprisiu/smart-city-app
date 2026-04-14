from pydantic import BaseModel

from app.models.enums import VerificationStatus


class VerificationSubmitResponse(BaseModel):
    userId: int
    status: VerificationStatus
    score: float | None = None
    reason: str


class VerificationStatusResponse(BaseModel):
    userId: int
    status: VerificationStatus
    score: float | None = None
    reason: str | None = None
    ocrData: dict | None = None
