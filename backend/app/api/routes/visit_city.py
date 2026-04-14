from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.schemas.visit_city import OptimizeRouteBody
from app.services import visit_city_service

router = APIRouter(prefix="/visit-city", tags=["visit-city"])


@router.get("/attractions")
def get_attractions(
    category: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
) -> dict:
    data = visit_city_service.get_attractions(db, category, q)
    return {"data": data}


@router.get("/attractions/live")
def get_live_attractions(
    q: str | None = None,
    limit: int | None = None,
    db: Session = Depends(get_db),
) -> dict:
    data = visit_city_service.get_live_attractions(db, q, limit)
    return {"data": data}


@router.post("/optimize")
def optimize_route(
    body: OptimizeRouteBody,
    db: Session = Depends(get_db),
) -> dict:
    try:
        data = visit_city_service.optimize_route_api(
            db,
            body.attractionIds,
            body.startLatitude,
            body.startLongitude,
            body.routingProfile,
        )
        return {"data": data}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        msg = str(e)
        code = 503 if "ACO" in msg or "not available" in msg else 502
        raise HTTPException(status_code=code, detail=msg) from e
