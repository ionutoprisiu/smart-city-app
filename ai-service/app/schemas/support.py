"""Pydantic models for support match API requests and responses."""

from pydantic import BaseModel, Field


class SupportQaCandidate(BaseModel):
    questionId: int
    question: str = Field(min_length=1, max_length=8000)
    answer: str = Field(min_length=1, max_length=8000)


class SupportMatchRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    candidates: list[SupportQaCandidate] = Field(default_factory=list, max_length=80)


class SupportMatchResponse(BaseModel):
    matchedQuestionId: int | None = None
    confidence: float = 0.0
    reason: str = ""
