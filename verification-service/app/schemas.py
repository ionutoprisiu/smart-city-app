from pydantic import BaseModel


class VerificationResponse(BaseModel):
    userId: int
    status: str
    score: float | None = None
    reason: str
    ocrData: dict | None = None
