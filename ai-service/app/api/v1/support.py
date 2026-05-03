"""Support matching HTTP endpoints."""

from fastapi import APIRouter

from app.schemas.support import SupportMatchRequest, SupportMatchResponse
from app.services.support_matching import match_history

router = APIRouter()


@router.post("/match", response_model=SupportMatchResponse)
async def support_match(req: SupportMatchRequest) -> SupportMatchResponse:
    """Match a user message to prior Q&A in the same context (LLM + lexical fallback)."""
    return match_history(req.message, req.candidates)
