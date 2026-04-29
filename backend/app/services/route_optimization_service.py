"""Build the ACO request, call the integration client, and shape the response."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations import aco_client
from app.integrations.aco_client import AcoServiceError
from app.models.tourist_attraction import TouristAttraction

log = logging.getLogger(__name__)


def optimize_route(
    db: Session,
    attraction_ids: list[int],
    start_lat: float | None,
    start_lon: float | None,
    routing_profile: str,
) -> dict[str, Any]:
    if not attraction_ids:
        raise ValueError("At least 1 attraction required")
    has_start = start_lat is not None and start_lon is not None
    if len(attraction_ids) < 2 and not has_start:
        raise ValueError("Provide at least 2 attractions, or 1 attraction with a start location")

    profile = _normalize_routing_profile(routing_profile)
    attractions = _find_attractions_ordered(db, attraction_ids)
    body = _build_aco_body(attractions, start_lat, start_lon, profile)

    log.info("Calling ACO optimize with routingProfile=%s", profile)
    try:
        raw = aco_client.optimize(body)
    except AcoServiceError as exc:
        # Re-raise as RuntimeError so the API layer can map to a sensible HTTP code.
        raise RuntimeError(str(exc)) from exc

    response = _parse_aco_response(raw)
    _enrich_step_names(response, attractions)
    log.info("Route optimized: %s km, %s min", response.get("totalDistance"), response.get("totalTime"))
    return response


def _normalize_routing_profile(routing_profile: str | None) -> str:
    if not routing_profile or not str(routing_profile).strip():
        return "driving"
    profile = str(routing_profile).strip().lower()
    if profile not in ("driving", "foot"):
        raise ValueError("routingProfile must be 'driving' or 'foot'")
    return profile


def _find_attractions_ordered(db: Session, ids: list[int]) -> list[TouristAttraction]:
    rows = (
        db.execute(
            select(TouristAttraction).where(
                TouristAttraction.id.in_(ids),
                TouristAttraction.is_active == True,  # noqa: E712
            )
        )
        .scalars()
        .all()
    )
    if len(rows) != len(ids):
        found = {a.id for a in rows}
        missing = [i for i in ids if i not in found]
        raise ValueError(f"Attractions not found: {missing}")
    by_id = {a.id: a for a in rows}
    return [by_id[i] for i in ids]


def _build_aco_body(
    attractions: list[TouristAttraction],
    start_lat: float | None,
    start_lon: float | None,
    routing_profile: str,
) -> dict[str, Any]:
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
    }
    if start_lat is not None:
        body["startLatitude"] = start_lat
    if start_lon is not None:
        body["startLongitude"] = start_lon
    return body


def _parse_aco_response(body: dict[str, Any]) -> dict[str, Any]:
    steps_data = body.get("steps")
    path = body.get("path")
    if steps_data is None or path is None:
        raise RuntimeError("Invalid ACO response")

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

    return {
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


def _enrich_step_names(response: dict[str, Any], attractions: list[TouristAttraction]) -> None:
    name_map = {a.id: a.name for a in attractions}
    for step in response["steps"]:
        attraction_id = int(step["attractionId"])
        if attraction_id == 0:
            step["attractionName"] = "Your Location"
        else:
            step["attractionName"] = name_map.get(attraction_id, "Unknown")
