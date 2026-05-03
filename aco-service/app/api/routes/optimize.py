"""`/optimize` endpoint — thin handler that delegates to `route_service`."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from app.schemas.route import OptimizeRequest, OptimizeResponse
from app.services import route_service

log = logging.getLogger(__name__)

router = APIRouter(tags=["optimize"])


@router.post(
    "/optimize",
    response_model=OptimizeResponse,
    summary="Optimize visit order",
    description=(
        "Builds a cost matrix (OSRM or Haversine), runs ACO anchored at the optional start point, "
        "and returns ordered steps with distances and optional per-leg geometry."
    ),
)
async def optimize_route(request: OptimizeRequest) -> OptimizeResponse:
    try:
        return await route_service.optimize(request)
    except ValueError as exc:
        log.warning("Validation error: %s", exc)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        log.error("Error optimizing route: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
