from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.schemas.visit_city import OptimizeRouteBody
from app.services import visit_city_service
from app.services.route_optimization_service import optimize_route

router = APIRouter(prefix="/visit-city", tags=["visit-city"])


@router.get("/attractions")
def get_attractions(
    category: str | None = None,
    q: str | None = None,
    _user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    data = visit_city_service.get_attractions(db, category, q)
    return {"data": data}


@router.get("/attractions/live")
def get_live_attractions(
    q: str | None = None,
    limit: int | None = None,
    _user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    data = visit_city_service.get_live_attractions(db, q, limit)
    return {"data": data}


@router.post("/optimize")
def optimize(
    body: OptimizeRouteBody,
    _user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    data = optimize_route(db, body.attractionIds, body.routingProfile)
    return {"data": data}
