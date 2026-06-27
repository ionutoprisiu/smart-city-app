from __future__ import annotations

from fastapi import APIRouter

from app.schemas.route import OptimizeRequest, OptimizeResponse
from app.services import route_service

router = APIRouter(tags=["optimize"])


@router.post("/optimize", response_model=OptimizeResponse, summary="Optimize visit order")
async def optimize_route(request: OptimizeRequest) -> OptimizeResponse:
    return await route_service.optimize(request)
