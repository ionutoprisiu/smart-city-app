"""Pydantic models for in-process support Q&A matching."""

from datetime import datetime

from pydantic import BaseModel, Field


class SupportQaCandidate(BaseModel):
    questionId: int
    question: str = Field(min_length=1, max_length=8000)
    answer: str = Field(min_length=1, max_length=8000)
    questionAt: datetime | None = None
    answerAt: datetime | None = None


class SupportMatchResponse(BaseModel):
    matchedQuestionId: int | None = None
    confidence: float = 0.0
    reason: str = ""
