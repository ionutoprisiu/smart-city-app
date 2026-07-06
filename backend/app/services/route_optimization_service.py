"""Bridges the Visit City request to aco-service.

Loads the chosen attractions from the DB, forwards them to aco-service (which owns
the fixed UTCN start), and reshapes the reply for the client. All the optimization
happens in aco-service; this file just translates in and out.
"""
from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.exceptions import (
    BadGatewayError,
    ServiceUnavailableError,
    ValidationAppError,
)
from app.integrations.aco_client import AcoServiceError, optimize as aco_optimize
from app.models.tourist_attraction import TouristAttraction

log = logging.getLogger(__name__)


def optimize_route(
    db: Session,
    attraction_ids: list[int],
    routing_profile: str,
    *,
    time_budget_minutes: float | None = None,
    visit_durations: dict[int, float] | None = None,
) -> dict[str, Any]:
    if not attraction_ids:
        raise ValidationAppError("At least 1 attraction required")

    profile = _normalize_routing_profile(routing_profile)
    attractions = _find_attractions_ordered(db, attraction_ids)
    body = _build_aco_body(attractions, profile, time_budget_minutes, visit_durations)

    log.info("Calling ACO optimize with routingProfile=%s", profile)
    try:
        raw = aco_optimize(body)
    except AcoServiceError as exc:
        # aco-service down/unreachable -> 503 so the client can retry, not a 500.
        raise ServiceUnavailableError(str(exc)) from exc

    response = _parse_aco_response(raw)
    _enrich_step_names(response, attractions)
    log.info("Route optimized: %s km, %s min", response.get("totalDistance"), response.get("totalTime"))
    return response


def _normalize_routing_profile(routing_profile: str | None) -> str:
    if not routing_profile or not str(routing_profile).strip():
        return "driving"
    profile = str(routing_profile).strip().lower()
    if profile not in ("driving", "foot"):
        raise ValidationAppError("routingProfile must be 'driving' or 'foot'")
    return profile


def _find_attractions_ordered(db: Session, ids: list[int]) -> list[TouristAttraction]:
    rows = (
        db.execute(
            select(TouristAttraction).where(
                TouristAttraction.id.in_(ids),
                TouristAttraction.is_active.is_(True),
            )
        )
        .scalars()
        .all()
    )
    if len(rows) != len(ids):
        found = {a.id for a in rows}
        missing = [i for i in ids if i not in found]
        raise ValidationAppError(f"Attractions not found: {missing}")
    by_id = {a.id: a for a in rows}
    return [by_id[i] for i in ids]


def _build_aco_body(
    attractions: list[TouristAttraction],
    routing_profile: str,
    time_budget_minutes: float | None = None,
    visit_durations: dict[int, float] | None = None,
) -> dict[str, Any]:
    # Only attractions + profile are sent; aco-service injects the fixed UTCN
    # start anchor itself (single source of truth for the start point).
    body: dict[str, Any] = {
        "attractions": [
            {
                "id": a.id,
                "latitude": a.latitude,
                "longitude": a.longitude,
            }
            for a in attractions
        ],
        "routingProfile": routing_profile,
        "useOsrm": True,
    }
    if time_budget_minutes is not None:
        # Orienteering mode: the catalog importance score is the prize, the
        # guide's visit durations are the per-node time price.
        body["timeBudgetMinutes"] = time_budget_minutes
        durations = visit_durations or {}
        for entry, attraction in zip(body["attractions"], attractions):
            entry["score"] = attraction.importance_score
            duration = durations.get(attraction.id)
            if duration is not None:
                entry["visitDurationMinutes"] = duration
    return body


def _parse_aco_response(body: dict[str, Any]) -> dict[str, Any]:
    steps_data = body.get("steps")
    path = body.get("path")
    if steps_data is None or path is None:
        raise BadGatewayError("Invalid ACO response")

    steps: list[dict[str, Any]] = []
    for s in steps_data:
        step: dict[str, Any] = {
            "order": int(s["order"]),
            "attractionId": int(s["attractionId"]),
            "attractionName": s.get("attractionName") or "",
            "latitude": float(s["latitude"]),
            "longitude": float(s["longitude"]),
        }
        if s.get("distanceToNext") is not None:
            step["distanceToNext"] = float(s["distanceToNext"])
        if s.get("estimatedVisitTime") is not None:
            step["estimatedVisitTime"] = int(s["estimatedVisitTime"])
        steps.append(step)

    route_geometry = body.get("routeGeometry") or path
    route_segments = body.get("routeSegments") or []
    used_osrm = bool(body.get("usedOsrm"))
    routing_profile = body.get("routingProfile") or "driving"

    total_time_val = int(body["totalTime"])
    travel_min = body.get("travelTimeMinutes")
    visit_min = body.get("visitTimeMinutes")

    result = {
        "steps": steps,
        "totalDistance": float(body["totalDistance"]),
        "totalTime": total_time_val,
        "travelTimeMinutes": int(travel_min) if travel_min is not None else total_time_val,
        "visitTimeMinutes": int(visit_min) if visit_min is not None else 0,
        "path": path,
        "routeGeometry": route_geometry,
        "routeSegments": route_segments,
        "usedOsrm": used_osrm,
        "routingProfile": str(routing_profile),
    }
    # Orienteering extras (present only on budget-constrained runs).
    if body.get("collectedScore") is not None:
        result["collectedScore"] = float(body["collectedScore"])
        result["skippedAttractionIds"] = [int(i) for i in body.get("skippedAttractionIds", [])]
        result["timeBudgetMinutes"] = body.get("timeBudgetMinutes")
    return result


def _enrich_step_names(
    response: dict[str, Any],
    attractions: list[TouristAttraction],
) -> None:
    # The start step (id 0) keeps the name aco-service assigned; only attraction
    # steps need their real catalog names filled in (aco only knows ids).
    name_map = {a.id: a.name for a in attractions}
    for step in response["steps"]:
        attraction_id = int(step["attractionId"])
        if attraction_id != 0:
            step["attractionName"] = name_map.get(attraction_id, "Unknown")
