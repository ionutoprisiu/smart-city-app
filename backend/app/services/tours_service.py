"""Tours domain: guide-curated collections of catalog attractions.

A tour records only WHICH attractions to visit; opening it optimizes the visiting
ORDER with ACO (the same route_optimization_service the manual flow uses). Only
verified guides may create tours, which is what ties the verification module to
the core: it gates who can publish trip content.
"""
from __future__ import annotations

from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.common.exceptions import NotFoundError, ValidationAppError
from app.models.enums import Role
from app.models.tour import Tour, TourAttraction
from app.models.tourist_attraction import TouristAttraction
from app.models.user import User
from app.schemas.tours import TourAttractionRef, TourCreateRequest, TourDetail, TourSummary
from app.services.route_optimization_service import optimize_route


def list_tours(db: Session) -> list[TourSummary]:
    rows = db.execute(
        select(Tour, func.count(TourAttraction.id).label("cnt"))
        .outerjoin(TourAttraction, TourAttraction.tour_id == Tour.id)
        .where(Tour.status == "ACTIVE")
        .group_by(Tour.id)
        .order_by(Tour.created_at.desc())
    ).all()
    return [_to_summary(tour, int(cnt or 0)) for tour, cnt in rows]


def list_my_tours(db: Session, user_id: int) -> list[TourSummary]:
    rows = db.execute(
        select(Tour, func.count(TourAttraction.id).label("cnt"))
        .outerjoin(TourAttraction, TourAttraction.tour_id == Tour.id)
        .where(Tour.status == "ACTIVE", Tour.created_by == user_id)
        .group_by(Tour.id)
        .order_by(Tour.created_at.desc())
    ).all()
    return [_to_summary(tour, int(cnt or 0)) for tour, cnt in rows]


def get_tour(db: Session, tour_id: int) -> TourDetail:
    tour = _get_active_tour(db, tour_id)
    attractions = _tour_attractions_ordered(db, tour_id)
    return TourDetail(
        id=tour.id,
        title=tour.title,
        description=tour.description,
        city=tour.city,
        routingProfile=tour.routing_profile,
        createdBy=tour.created_by,
        createdAt=tour.created_at,
        attractions=[
            TourAttractionRef(
                attractionId=a.id,
                name=a.name,
                category=a.category,
                latitude=a.latitude,
                longitude=a.longitude,
                visitDurationMinutes=duration,
            )
            for a, duration in attractions
        ],
    )


def optimize_tour(
    db: Session, tour_id: int, time_budget_minutes: float | None = None
) -> dict[str, Any]:
    # Opening a tour = run ACO on its attractions, using the tour's profile.
    # With a time budget the run becomes an Orienteering Problem: the optimizer
    # also picks WHICH of the guide's candidates fit the tourist's time.
    tour = _get_active_tour(db, tour_id)
    rows = db.execute(
        select(TourAttraction.attraction_id, TourAttraction.visit_duration_minutes)
        .where(TourAttraction.tour_id == tour_id)
        .order_by(TourAttraction.position, TourAttraction.id)
    ).all()
    if not rows:
        raise ValidationAppError("Tour has no attractions")
    attraction_ids = [attraction_id for attraction_id, _ in rows]
    visit_durations = {attraction_id: float(duration) for attraction_id, duration in rows}
    return optimize_route(
        db,
        attraction_ids,
        tour.routing_profile,
        time_budget_minutes=time_budget_minutes,
        visit_durations=visit_durations,
    )


def create_tour(db: Session, req: TourCreateRequest, creator_user_id: int) -> TourDetail:
    _ensure_guide(db, creator_user_id)
    profile = _normalize_profile(req.routingProfile)
    durations = _validate_durations(req)
    attractions = _validate_attractions(db, req.attractionIds)

    tour = Tour(
        title=req.title.strip(),
        description=(req.description or "").strip() or None,
        city="Cluj-Napoca",
        routing_profile=profile,
        created_by=creator_user_id,
        status="ACTIVE",
    )
    db.add(tour)
    db.flush()  # get tour.id before inserting the links
    for position, attraction in enumerate(attractions):
        db.add(TourAttraction(
            tour_id=tour.id,
            attraction_id=attraction.id,
            position=position,
            visit_duration_minutes=durations.get(attraction.id, DEFAULT_VISIT_MINUTES),
        ))
    db.commit()
    return get_tour(db, tour.id)


def delete_tour(db: Session, tour_id: int, user_id: int) -> None:
    tour = _get_active_tour(db, tour_id)
    user = _ensure_user(db, user_id)
    if tour.created_by != user.id and user.role != Role.ADMIN.value:
        raise PermissionError("Only the tour's guide can delete it")
    db.execute(delete(TourAttraction).where(TourAttraction.tour_id == tour_id))
    tour.status = "DELETED"  # soft delete the tour row itself
    db.commit()


# --- helpers ------------------------------------------------------------------

DEFAULT_VISIT_MINUTES = 15.0


def _validate_durations(req: TourCreateRequest) -> dict[int, float]:
    """Map attraction id -> visit duration; first occurrence wins on duplicates."""
    if req.visitDurationsMinutes is None:
        return {}
    if len(req.visitDurationsMinutes) != len(req.attractionIds):
        raise ValidationAppError(
            "visitDurationsMinutes must have one entry per attraction"
        )
    durations: dict[int, float] = {}
    for attraction_id, duration in zip(req.attractionIds, req.visitDurationsMinutes):
        if not 0 < duration <= 600:
            raise ValidationAppError("Visit durations must be between 0 and 600 minutes")
        durations.setdefault(attraction_id, float(duration))
    return durations


def _to_summary(tour: Tour, count: int) -> TourSummary:
    return TourSummary(
        id=tour.id,
        title=tour.title,
        description=tour.description,
        city=tour.city,
        routingProfile=tour.routing_profile,
        createdBy=tour.created_by,
        attractionCount=count,
        createdAt=tour.created_at,
    )


def _get_active_tour(db: Session, tour_id: int) -> Tour:
    tour = db.execute(
        select(Tour).where(Tour.id == tour_id, Tour.status == "ACTIVE")
    ).scalar_one_or_none()
    if tour is None:
        raise NotFoundError("Tour not found")
    return tour


def _tour_attractions_ordered(
    db: Session, tour_id: int
) -> list[tuple[TouristAttraction, float]]:
    rows = db.execute(
        select(TouristAttraction, TourAttraction.visit_duration_minutes)
        .join(TourAttraction, TourAttraction.attraction_id == TouristAttraction.id)
        .where(TourAttraction.tour_id == tour_id)
        .order_by(TourAttraction.position, TourAttraction.id)
    ).all()
    return [(attraction, float(duration)) for attraction, duration in rows]


def _validate_attractions(db: Session, ids: list[int]) -> list[TouristAttraction]:
    rows = db.execute(
        select(TouristAttraction).where(
            TouristAttraction.id.in_(ids),
            TouristAttraction.is_active.is_(True),
        )
    ).scalars().all()
    by_id = {a.id: a for a in rows}
    missing = [i for i in ids if i not in by_id]
    if missing:
        raise ValidationAppError(f"Attractions not found: {missing}")
    # Preserve the order the guide chose and drop duplicates.
    seen: set[int] = set()
    ordered: list[TouristAttraction] = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            ordered.append(by_id[i])
    return ordered


def _normalize_profile(profile: str | None) -> str:
    p = (profile or "driving").strip().lower()
    if p not in ("foot", "driving"):
        raise ValidationAppError("routingProfile must be 'foot' or 'driving'")
    return p


def _ensure_user(db: Session, user_id: int) -> User:
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise ValidationAppError("User not found")
    return user


def _ensure_guide(db: Session, user_id: int) -> User:
    user = _ensure_user(db, user_id)
    if user.role not in (Role.GUIDE.value, Role.ADMIN.value):
        raise PermissionError("Only verified guides can create tours")
    return user
