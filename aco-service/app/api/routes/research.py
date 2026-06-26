from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from app.schemas.research import BenchmarkSet, CompareRequest
from app.services import research_service

log = logging.getLogger(__name__)

router = APIRouter(prefix="/research", tags=["research"])


@router.get("/sets", response_model=list[BenchmarkSet], summary="List benchmark sets")
def list_sets() -> list[dict]:
    return research_service.list_sets()


@router.post("/compare", summary="Compare algorithms on a benchmark set")
def compare(request: CompareRequest) -> dict:
    try:
        aco_params = request.acoParams.model_dump() if request.acoParams else None
        pso_params = request.psoParams.model_dump() if request.psoParams else None
        return research_service.compare(
            set_name=request.setName,
            runs=request.runs,
            seed=request.seed,
            aco_params=aco_params,
            pso_params=pso_params,
        )
    except ValueError as exc:
        log.warning("Research validation error: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
