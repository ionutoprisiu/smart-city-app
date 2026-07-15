from __future__ import annotations

from fastapi import APIRouter

from app.schemas.research import BenchmarkSet, CompareRequest
from app.services import research_service

router = APIRouter(prefix="/research", tags=["research"])


@router.get("/sets", response_model=list[BenchmarkSet], summary="List benchmark sets")
def list_sets() -> list[dict]:
    return research_service.list_sets()


@router.post("/compare", summary="Compare algorithms on a benchmark set")
def compare(request: CompareRequest) -> dict:
    return research_service.compare(
        set_name=request.setName,
        runs=request.runs,
        seed=request.seed,
    )
