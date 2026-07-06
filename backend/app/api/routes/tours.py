from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.schemas.tours import (
    TourCreateRequest,
    TourDetail,
    TourOptimizeRequest,
    TourSummary,
)
from app.services import tours_service

router = APIRouter(prefix="/tours", tags=["tours"])


@router.get("", response_model=list[TourSummary])
def list_tours(db: Session = Depends(get_db)) -> list[TourSummary]:
    return tours_service.list_tours(db)


# Defined before "/{tour_id}" so the literal path wins over the parameter.
@router.get("/mine", response_model=list[TourSummary])
def list_my_tours(
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> list[TourSummary]:
    return tours_service.list_my_tours(db, user_id)


@router.post("", response_model=TourDetail, status_code=201)
def create_tour(
    body: TourCreateRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> TourDetail:
    return tours_service.create_tour(db, body, user_id)


@router.get("/{tour_id}", response_model=TourDetail)
def get_tour(tour_id: int, db: Session = Depends(get_db)) -> TourDetail:
    return tours_service.get_tour(db, tour_id)


@router.post("/{tour_id}/optimize")
def optimize_tour(
    tour_id: int,
    body: TourOptimizeRequest | None = None,
    db: Session = Depends(get_db),
) -> dict:
    # Run ACO on the tour's attractions and return the optimized route. With a
    # time budget in the body, only the best-scoring subset that fits is kept.
    budget = body.timeBudgetMinutes if body is not None else None
    return {"data": tours_service.optimize_tour(db, tour_id, budget)}


@router.delete("/{tour_id}", status_code=204)
def delete_tour(
    tour_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
) -> Response:
    tours_service.delete_tour(db, tour_id, user_id)
    return Response(status_code=204)
