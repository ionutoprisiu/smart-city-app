from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db, get_optional_current_user_id
from app.schemas.preferences import PreferencesResponse, PreferencesUpdate
from app.schemas.visit_city import OptimizeRouteBody
from app.services import preferences_service, visit_city_service

router = APIRouter(prefix="/visit-city", tags=["visit-city"])


def _runtime_status_code(exc: RuntimeError) -> int:
    msg = str(exc)
    if "ACO" in msg or "not available" in msg:
        return 503
    return 502


@router.get("/attractions")
def get_attractions(
    category: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    user_id: int | None = Depends(get_optional_current_user_id),
) -> dict:
    data = visit_city_service.get_attractions(db, category, q, user_id=user_id)
    return {"data": data}


@router.get("/preferences", response_model=PreferencesResponse)
def get_preferences(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> PreferencesResponse:
    data = preferences_service.get_preferences(db, user_id)
    return PreferencesResponse(**data)


@router.put("/preferences", response_model=PreferencesResponse)
def update_preferences(
    body: PreferencesUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> PreferencesResponse:
    data = preferences_service.save_preferences(db, user_id, body.categories)
    return PreferencesResponse(**data)


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
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=_runtime_status_code(exc), detail=str(exc)) from exc
