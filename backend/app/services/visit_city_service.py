from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.enums import AttractionCategory
from app.models.tourist_attraction import TouristAttraction
from app.services import attraction_discovery_service, preferences_service
from app.services.route_optimization_service import optimize_route

CLUJ_CENTER_LAT = 46.7712
CLUJ_CENTER_LON = 23.5898
CLUJ_RADIUS_KM = 12.0
CLUJ = "Cluj-Napoca"

# Per-rank weight added on top of importance for a preferred category.
PREFERENCE_BONUS = 10.0


def get_attractions(
    db: Session,
    category: str | None,
    q: str | None,
    user_id: int | None = None,
) -> list[dict[str, Any]]:
    if category and str(category).strip():
        try:
            cat_enum = AttractionCategory[category.strip().upper()]
        except KeyError:
            cat_enum = None
        if cat_enum:
            rows = db.execute(
                select(TouristAttraction)
                .where(
                    TouristAttraction.category == cat_enum.value,
                    TouristAttraction.is_active.is_(True),
                )
                .order_by(TouristAttraction.importance_score.desc(), TouristAttraction.name)
            ).scalars().all()
            return [_map_to_dict(a) for a in rows]

    if q and str(q).strip():
        rows = db.execute(_select_active_by_text(q.strip())).scalars().all()
        return [_map_to_dict(a) for a in rows]

    return _personalized_default(db, user_id)


def _personalized_default(db: Session, user_id: int | None) -> list[dict[str, Any]]:
    """Full active catalog, ranked by importance with optional preference boost."""
    rows = db.execute(_select_all_active_by_importance()).scalars().all()
    cats = preferences_service.get_ordered_categories(db, user_id)
    if not cats:
        return [_map_to_dict(a) for a in rows]

    weight = {cat: (len(cats) - idx) for idx, cat in enumerate(cats)}

    def category_bonus(cat: str) -> int:
        if cat in weight:
            return weight[cat]
        # Fortresses ride along with the "Monument/history" preference.
        if cat == AttractionCategory.FORTRESS.value and AttractionCategory.MONUMENT.value in weight:
            return weight[AttractionCategory.MONUMENT.value]
        return 0

    ranked = sorted(
        rows,
        key=lambda a: (
            -((a.importance_score or 0.0) + PREFERENCE_BONUS * category_bonus(a.category)),
            (a.name or "").lower(),
        ),
    )
    return [_map_to_dict(a) for a in ranked]


def sync_attractions(db: Session) -> dict[str, Any]:
    """Discover all Cluj attractions from Overpass and upsert them all (no cap)."""
    discovered = attraction_discovery_service.discover_attractions(
        CLUJ_CENTER_LAT, CLUJ_CENTER_LON, CLUJ_RADIUS_KM
    )
    normalized = [a for a in discovered if a.name and str(a.name).strip()]
    upserted = _batch_upsert(db, normalized)
    total = db.execute(
        select(func.count())
        .select_from(TouristAttraction)
        .where(TouristAttraction.is_active.is_(True))
    ).scalar_one()
    return {
        "discovered": len(discovered),
        "processed": len(upserted),
        "totalActive": int(total),
    }


def get_live_attractions(db: Session, q: str | None, limit: int | None) -> list[dict[str, Any]]:
    capped = max(1, min(limit or 300, 500))
    query = (q or "").strip().lower()

    discovered = attraction_discovery_service.discover_attractions(CLUJ_CENTER_LAT, CLUJ_CENTER_LON, CLUJ_RADIUS_KM)
    seen_names = {
        (a.name or "").strip().lower()
        for a in discovered
        if a.name and str(a.name).strip()
    }

    normalized = [
        a
        for a in discovered
        if a.name and str(a.name).strip()
        and (
            not query
            or query in (a.name or "").lower()
            or (a.description and query in (a.description or "").lower())
        )
    ]

    upserted = _batch_upsert(db, normalized)

    if not query:
        db_matches = db.execute(_select_all_active_ordered()).scalars().all()
    else:
        db_matches = db.execute(_select_active_by_text(query)).scalars().all()

    merged: dict[int, TouristAttraction] = {a.id: a for a in upserted}
    for a in db_matches:
        n = (a.name or "").strip().lower()
        if n and n not in seen_names:
            merged[a.id] = a

    sorted_list = sorted(merged.values(), key=lambda x: (x.name or "").lower())[:capped]
    return [_map_to_dict(a) for a in sorted_list]


def optimize_route_api(
    db: Session,
    attraction_ids: list[int],
    start_lat: float | None,
    start_lon: float | None,
    routing_profile: str,
) -> dict[str, Any]:
    return optimize_route(db, attraction_ids, start_lat, start_lon, routing_profile)


def _select_all_active_ordered():
    return (
        select(TouristAttraction)
        .where(TouristAttraction.is_active.is_(True))
        .order_by(TouristAttraction.name)
    )


def _select_all_active_by_importance():
    return (
        select(TouristAttraction)
        .where(TouristAttraction.is_active.is_(True))
        .order_by(TouristAttraction.importance_score.desc(), TouristAttraction.name)
    )


def _select_active_by_text(term: str):
    pattern = f"%{term}%"
    return (
        select(TouristAttraction)
        .where(
            TouristAttraction.is_active.is_(True),
            or_(
                func.lower(TouristAttraction.name).like(func.lower(pattern)),
                func.lower(TouristAttraction.description).like(func.lower(pattern)),
            ),
        )
        .order_by(TouristAttraction.name)
    )


def _map_to_dict(a: TouristAttraction) -> dict[str, Any]:
    return {
        "id": a.id,
        "name": a.name,
        "description": a.description or "",
        "latitude": a.latitude,
        "longitude": a.longitude,
        "city": a.city,
        "category": a.category,
        "imageUrl": a.image_url,
        "importanceScore": a.importance_score,
        "isActive": a.is_active,
    }


def _find_existing(db: Session, discovered: TouristAttraction) -> TouristAttraction | None:
    return (
        db.execute(
            select(TouristAttraction)
            .where(
                func.lower(TouristAttraction.name) == func.lower(discovered.name),
                func.lower(TouristAttraction.city) == func.lower(CLUJ),
                func.abs(TouristAttraction.latitude - discovered.latitude) < 0.0005,
                func.abs(TouristAttraction.longitude - discovered.longitude) < 0.0005,
            )
            .order_by(TouristAttraction.id)
            .limit(1)
        )
        .scalars()
        .first()
    )


def _batch_upsert(db: Session, attractions: list[TouristAttraction]) -> list[TouristAttraction]:
    result: list[TouristAttraction] = []
    new_items: list[TouristAttraction] = []
    changed = False
    for a in attractions:
        existing = _find_existing(db, a)
        if existing:
            if (existing.importance_score or 0.0) != (a.importance_score or 0.0):
                existing.importance_score = a.importance_score
                changed = True
            result.append(existing)
        else:
            new_items.append(a)
            result.append(a)
    if new_items:
        db.add_all(new_items)
    if new_items or changed:
        db.commit()
        for item in new_items:
            db.refresh(item)
    return result
