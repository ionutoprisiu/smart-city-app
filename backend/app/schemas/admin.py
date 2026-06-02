from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import Role, VerificationStatus


class AdminVerificationItem(BaseModel):
    userId: int
    email: str
    firstName: str
    lastName: str
    verificationStatus: VerificationStatus
    verificationScore: float | None = None
    verificationReason: str | None = None
    idCardImageUrl: str | None = None
    faceImageUrl: str | None = None
    createdAt: datetime | None = None


class AdminVerificationListResponse(BaseModel):
    items: list[AdminVerificationItem]


class AdminRejectRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=255)


class AdminUserItem(BaseModel):
    userId: int
    email: str
    firstName: str
    lastName: str
    role: Role
    verificationStatus: VerificationStatus
    isVerified: bool


class AdminUserListResponse(BaseModel):
    items: list[AdminUserItem]
