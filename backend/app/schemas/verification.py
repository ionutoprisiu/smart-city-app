from pydantic import BaseModel

from app.models.enums import Role, VerificationStatus


class VerificationSubmitResponse(BaseModel):
    userId: int
    status: VerificationStatus
    role: Role
    isVerified: bool
    score: float | None = None
    reason: str


class VerificationStatusResponse(BaseModel):
    userId: int
    status: VerificationStatus
    role: Role
    isVerified: bool
    score: float | None = None
    reason: str | None = None
    metadata: dict | None = None
    canSubmit: bool = False
    submitBlockedReason: str | None = None
    canAccessOrganizerFlow: bool = False
    organizerFlowBlockedReason: str | None = None
