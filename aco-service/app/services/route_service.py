"""Orchestrates route optimization.

Build the candidate point list (start + attractions), pick a cost matrix
(OSRM duration when available, otherwise haversine distance), run ACO,
and shape the response with per-leg geometry and travel-time estimates.
"""

from __future__ import annotations

import logging

from app.algorithms.aco import ACOOptimizer
from app.common.distance import (
    MISSING_EDGE_SEC,
    calculate_distance_matrix,
    calculate_route_distance,
)
from app.core.config import settings
from app.integrations import osrm_client
from app.schemas.route import OptimizeRequest, OptimizeResponse, RouteStepResponse

log = logging.getLogger(__name__)


async def optimize(request: OptimizeRequest) -> OptimizeResponse:
    """Top-level entry point for `/optimize`."""
    has_start = request.startLatitude is not None and request.startLongitude is not None
    profile = osrm_client.normalize_profile(request.routingProfile)
    attractions = _attractions_to_points(request)

    log.info(
        "Optimizing route: %d attractions, start=%s, OSRM=%s, profile=%s",
        len(attractions), has_start, request.useOsrm, profile,
    )

    if len(attractions) == 1 and has_start:
        return await _single_destination(attractions[0], request, profile)

    points = _build_points(request, attractions, has_start)
    distance_matrix, duration_matrix, used_osrm = await _build_matrices(points, profile, request.useOsrm)

    cost_matrix = duration_matrix if (used_osrm and duration_matrix is not None) else distance_matrix
    best_route, _ = ACOOptimizer(cost_matrix).optimize()
    best_distance_km = calculate_route_distance(best_route, distance_matrix)

    ordered = [points[i] for i in best_route]
    route_geometry: list[dict] = []
    route_segments: list[list[dict]] = []
    leg_durations_sec: list[float] = []
    if used_osrm:
        route_segments, leg_durations_sec = await osrm_client.fetch_route_segments(ordered, profile)
        for segment in route_segments:
            route_geometry.extend(segment)

    response = _build_response(
        points,
        best_route,
        best_distance_km,
        distance_matrix,
        route_geometry,
        route_segments,
        used_osrm,
        profile,
        duration_matrix,
        leg_durations_sec,
    )
    log.info(
        "Route optimized: %.3f km, travel=%dm profile=%s OSRM=%s",
        response.totalDistance, response.travelTimeMinutes, profile, used_osrm,
    )
    return response


def _attractions_to_points(request: OptimizeRequest) -> list[dict]:
    return [
        {"id": attr.id, "latitude": attr.latitude, "longitude": attr.longitude}
        for attr in request.attractions
    ]


def _build_points(request: OptimizeRequest, attractions: list[dict], has_start: bool) -> list[dict]:
    points: list[dict] = []
    if has_start:
        points.append({
            "id": 0,
            "latitude": request.startLatitude,
            "longitude": request.startLongitude,
        })
    points.extend(attractions)
    return points


async def _build_matrices(
    points: list[dict], profile: str, use_osrm: bool
) -> tuple[list[list[float]], list[list[float]] | None, bool]:
    """Return `(distance_km_matrix, duration_sec_matrix, used_osrm)`."""
    if use_osrm:
        dist_m, dur_m = await osrm_client.fetch_matrices(points, profile)
        if dist_m is not None:
            return dist_m, dur_m, True
    return calculate_distance_matrix(points), None, False


async def _single_destination(
    attraction: dict, request: OptimizeRequest, profile: str
) -> OptimizeResponse:
    start = {
        "id": 0,
        "latitude": request.startLatitude,
        "longitude": request.startLongitude,
    }
    points = [start, attraction]
    distance_matrix, duration_matrix, used_osrm = await _build_matrices(points, profile, request.useOsrm)
    distance = distance_matrix[0][1]

    route_geometry: list[dict] = []
    route_segments: list[list[dict]] = []
    leg_durations_sec: list[float] = []
    if used_osrm:
        route_segments, leg_durations_sec = await osrm_client.fetch_route_segments(points, profile)
        for segment in route_segments:
            route_geometry.extend(segment)

    travel_min = _travel_time_minutes([0, 1], distance, duration_matrix, profile, leg_durations_sec)

    steps = [
        RouteStepResponse(
            order=1, attractionId=0, attractionName="Your Location",
            latitude=start["latitude"], longitude=start["longitude"],
            distanceToNext=round(distance, 3),
        ),
        RouteStepResponse(
            order=2, attractionId=attraction["id"],
            attractionName=f"Attraction {attraction['id']}",
            latitude=attraction["latitude"], longitude=attraction["longitude"],
            distanceToNext=None,
        ),
    ]
    path = [
        {"latitude": start["latitude"], "longitude": start["longitude"]},
        {"latitude": attraction["latitude"], "longitude": attraction["longitude"]},
    ]

    return OptimizeResponse(
        steps=steps,
        totalDistance=round(distance, 3),
        totalTime=travel_min,
        travelTimeMinutes=travel_min,
        visitTimeMinutes=0,
        path=path,
        routeGeometry=route_geometry if route_geometry else path,
        routeSegments=route_segments,
        usedOsrm=used_osrm,
        routingProfile=profile,
    )


def _build_response(
    points: list[dict],
    best_route: list[int],
    best_distance: float,
    distance_matrix: list[list[float]],
    route_geometry: list[dict],
    route_segments: list[list[dict]],
    used_osrm: bool,
    profile: str,
    duration_matrix: list[list[float]] | None,
    leg_durations_sec: list[float],
) -> OptimizeResponse:
    steps: list[RouteStepResponse] = []
    path: list[dict] = []

    for i, route_index in enumerate(best_route):
        point = points[route_index]
        is_start = point["id"] == 0

        distance_to_next: float | None = None
        if i < len(best_route) - 1:
            next_index = best_route[i + 1]
            distance_to_next = round(distance_matrix[route_index][next_index], 3)

        steps.append(RouteStepResponse(
            order=i + 1,
            attractionId=point["id"],
            attractionName="Your Location" if is_start else f"Attraction {point['id']}",
            latitude=point["latitude"],
            longitude=point["longitude"],
            distanceToNext=distance_to_next,
        ))
        path.append({"latitude": point["latitude"], "longitude": point["longitude"]})

    travel_min = _travel_time_minutes(
        best_route, best_distance, duration_matrix, profile, leg_durations_sec,
    )
    return OptimizeResponse(
        steps=steps,
        totalDistance=round(best_distance, 3),
        totalTime=travel_min,
        travelTimeMinutes=travel_min,
        visitTimeMinutes=0,
        path=path,
        routeGeometry=route_geometry if route_geometry else path,
        routeSegments=route_segments,
        usedOsrm=used_osrm,
        routingProfile=profile,
    )


def _travel_time_minutes(
    route: list[int],
    distance_km: float,
    duration_matrix: list[list[float]] | None,
    profile: str,
    leg_durations_sec: list[float] | None,
) -> int:
    """Pick the most credible travel-time estimate available."""
    table_sec = 0.0
    if duration_matrix is not None and len(route) >= 2:
        for i in range(len(route) - 1):
            a, b = route[i], route[i + 1]
            table_sec += float(duration_matrix[a][b])

    leg_sec = 0.0
    if leg_durations_sec:
        leg_sec = sum(float(d) for d in leg_durations_sec if d and d > 0)

    # Prefer the per-edge OSRM table when the per-leg /route durations look
    # implausibly small (e.g. snapping artifacts).
    if (
        table_sec > 0
        and table_sec < (MISSING_EDGE_SEC * max(2, len(route)))
        and leg_sec > 0
        and leg_sec < table_sec * 0.45
    ):
        return max(1, int(round(table_sec / 60.0)))

    if leg_sec > 0:
        return max(1, int(round(leg_sec / 60.0)))

    if table_sec > 0 and table_sec < (MISSING_EDGE_SEC * max(2, len(route))):
        return max(1, int(round(table_sec / 60.0)))

    speed = settings.walking_speed_kmh if profile == "foot" else settings.driving_speed_kmh
    return max(1, int(round((distance_km / speed) * 60)))
