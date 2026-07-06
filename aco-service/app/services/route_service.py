"""Orchestrates one /optimize request: build points, fetch the cost matrix,
run ACO, fetch the road geometry, and assemble the response. The heavy lifting
lives in the algorithm and OSRM modules; this file only wires the steps together.
"""
from __future__ import annotations

import logging

from app.algorithms.aco import ACOOptimizer
from app.algorithms.orienteering import OrienteeringACO
from app.common.distance import (
    MISSING_EDGE_SEC,
    calculate_distance_matrix,
    calculate_route_cost,
)
from app.core.config import settings
from app.core.route_start import (
    ROUTE_START_LATITUDE,
    ROUTE_START_LONGITUDE,
    ROUTE_START_NAME,
)
from app.integrations import osrm_client
from app.schemas.route import OptimizeRequest, OptimizeResponse, RouteStepResponse

log = logging.getLogger(__name__)

# Visit duration assumed when the caller does not provide one (minutes).
DEFAULT_VISIT_MINUTES = 15.0


async def optimize(request: OptimizeRequest) -> OptimizeResponse:
    profile = osrm_client.normalize_profile(request.routingProfile)
    attractions = _attractions_to_points(request)

    log.info(
        "Optimizing route: %d attractions, OSRM=%s, profile=%s, budget=%s",
        len(attractions), request.useOsrm, profile, request.timeBudgetMinutes,
    )

    points = _build_points(attractions)
    distance_matrix, duration_matrix, used_osrm = await _build_matrices(points, profile, request.useOsrm)

    if request.timeBudgetMinutes is not None:
        # Orienteering mode: pick the best-scoring subset that fits the budget.
        best_route, op_extras = _build_route_op(
            request, points, distance_matrix, duration_matrix, used_osrm, profile
        )
    else:
        best_route = _build_route(points, distance_matrix, duration_matrix, used_osrm)
        op_extras = None

    best_distance_km = calculate_route_cost(best_route, distance_matrix)
    route_geometry, route_segments, leg_durations_sec = await _route_details(points, best_route, profile, used_osrm)

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
        op_extras,
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


def _build_points(attractions: list[dict]) -> list[dict]:
    # Index 0 is the fixed start anchor (UTCN); selected attractions follow.
    start = {"id": 0, "latitude": ROUTE_START_LATITUDE, "longitude": ROUTE_START_LONGITUDE}
    return [start, *attractions]


async def _build_matrices(
    points: list[dict], profile: str, use_osrm: bool
) -> tuple[list[list[float]], list[list[float]] | None, bool]:
    if use_osrm:
        dist_m, dur_m = await osrm_client.fetch_matrices(points, profile)
        if dist_m is not None:
            return dist_m, dur_m, True
    return calculate_distance_matrix(points), None, False


def _build_route(
    points: list[dict],
    distance_matrix: list[list[float]],
    duration_matrix: list[list[float]] | None,
    used_osrm: bool,
) -> list[int]:
    if len(points) == 2 and points[0]["id"] == 0:
        return [0, 1]  # start + one attraction: nothing to optimize

    # Optimize on TIME when OSRM is available (durations), else on Haversine distance.
    # ACO is metric-agnostic; only the numbers in the matrix change.
    cost_matrix = duration_matrix if (used_osrm and duration_matrix is not None) else distance_matrix
    best_route, _ = ACOOptimizer(cost_matrix, seed=settings.aco_seed_value).optimize()
    return best_route


def _minutes_matrix(
    distance_matrix: list[list[float]],
    duration_matrix: list[list[float]] | None,
    used_osrm: bool,
    profile: str,
) -> list[list[float]]:
    # The budget is expressed in minutes, so travel costs must be too: OSRM
    # durations are seconds, the Haversine fallback is km at a profile speed.
    if used_osrm and duration_matrix is not None:
        return [[sec / 60.0 for sec in row] for row in duration_matrix]
    speed = settings.walking_speed_kmh if profile == "foot" else settings.driving_speed_kmh
    return [[km / speed * 60.0 for km in row] for row in distance_matrix]


def _build_route_op(
    request: OptimizeRequest,
    points: list[dict],
    distance_matrix: list[list[float]],
    duration_matrix: list[list[float]] | None,
    used_osrm: bool,
    profile: str,
) -> tuple[list[int], dict]:
    minutes = _minutes_matrix(distance_matrix, duration_matrix, used_osrm, profile)
    # Index 0 is the anchor; scores/durations align with the points list. A
    # missing score defaults to 1 (all attractions equal -> maximize the count).
    scores = [0.0] + [
        a.score if a.score is not None else 1.0 for a in request.attractions
    ]
    service = [0.0] + [
        a.visitDurationMinutes if a.visitDurationMinutes is not None else DEFAULT_VISIT_MINUTES
        for a in request.attractions
    ]

    optimizer = OrienteeringACO(
        minutes,
        scores,
        request.timeBudgetMinutes,
        seed=settings.aco_seed_value,
        service_times=service,
    )
    best_route, collected = optimizer.optimize()

    visited = set(best_route)
    skipped_ids = [p["id"] for i, p in enumerate(points) if i not in visited and p["id"] != 0]
    visit_minutes = sum(service[i] for i in best_route)
    extras = {
        "collectedScore": round(collected, 3),
        "skippedAttractionIds": skipped_ids,
        "timeBudgetMinutes": request.timeBudgetMinutes,
        "visitMinutes": visit_minutes,
        "visitByIndex": {i: service[i] for i in best_route if i != 0},
    }
    return best_route, extras


async def _route_details(
    points: list[dict],
    best_route: list[int],
    profile: str,
    used_osrm: bool,
) -> tuple[list[dict], list[list[dict]], list[float]]:
    route_geometry: list[dict] = []
    route_segments: list[list[dict]] = []
    leg_durations_sec: list[float] = []
    # Nothing to draw without OSRM, or when the budget was too tight to leave
    # the start point (single-node route).
    if not used_osrm or len(best_route) < 2:
        return route_geometry, route_segments, leg_durations_sec

    ordered = [points[i] for i in best_route]
    route_geometry, route_segments, leg_durations_sec = await osrm_client.fetch_route_details(
        ordered, profile
    )
    return route_geometry, route_segments, leg_durations_sec


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
    op_extras: dict | None = None,
) -> OptimizeResponse:
    steps: list[RouteStepResponse] = []
    path: list[dict] = []
    visit_by_index = (op_extras or {}).get("visitByIndex", {})

    for i, route_index in enumerate(best_route):
        point = points[route_index]
        is_start = point["id"] == 0

        distance_to_next: float | None = None
        if i < len(best_route) - 1:
            next_index = best_route[i + 1]
            distance_to_next = round(distance_matrix[route_index][next_index], 3)

        visit_min = visit_by_index.get(route_index)
        steps.append(RouteStepResponse(
            order=i + 1,
            attractionId=point["id"],
            attractionName=(
                ROUTE_START_NAME if is_start else f"Attraction {point['id']}"
            ),
            latitude=point["latitude"],
            longitude=point["longitude"],
            distanceToNext=distance_to_next,
            estimatedVisitTime=int(round(visit_min)) if visit_min is not None else None,
        ))
        path.append({"latitude": point["latitude"], "longitude": point["longitude"]})

    travel_min = _travel_time_minutes(
        best_route, best_distance, duration_matrix, profile, leg_durations_sec,
    )
    visit_total_min = int(round((op_extras or {}).get("visitMinutes", 0.0)))
    return OptimizeResponse(
        steps=steps,
        totalDistance=round(best_distance, 3),
        totalTime=travel_min + visit_total_min,
        travelTimeMinutes=travel_min,
        visitTimeMinutes=visit_total_min,
        path=path,
        routeGeometry=route_geometry if route_geometry else path,
        routeSegments=route_segments,
        usedOsrm=used_osrm,
        routingProfile=profile,
        collectedScore=(op_extras or {}).get("collectedScore"),
        skippedAttractionIds=(op_extras or {}).get("skippedAttractionIds", []),
        timeBudgetMinutes=(op_extras or {}).get("timeBudgetMinutes"),
    )


def _travel_time_minutes(
    route: list[int],
    distance_km: float,
    duration_matrix: list[list[float]] | None,
    profile: str,
    leg_durations_sec: list[float] | None,
) -> int:
    if len(route) < 2:
        return 0  # budget too tight to leave the start: no travel at all

    # Two OSRM time sources can disagree: the /table matrix and the /route legs.
    # We prefer the legs, but fall back to the table when the legs look implausibly
    # short (a snapping artifact), and to a speed estimate when there is no OSRM.
    missing_cap = MISSING_EDGE_SEC * max(2, len(route))

    table_sec = 0.0
    if duration_matrix is not None and len(route) >= 2:
        for i in range(len(route) - 1):
            a, b = route[i], route[i + 1]
            table_sec += float(duration_matrix[a][b])

    leg_sec = (
        sum(float(d) for d in leg_durations_sec if d and d > 0) if leg_durations_sec else 0.0
    )

    table_credible = 0 < table_sec < missing_cap
    leg_looks_too_short = leg_sec > 0 and leg_sec < table_sec * 0.45  # OSRM snapping
    if table_credible and leg_looks_too_short:
        return max(1, int(round(table_sec / 60.0)))
    if leg_sec > 0:
        return max(1, int(round(leg_sec / 60.0)))
    if table_credible:
        return max(1, int(round(table_sec / 60.0)))

    speed = settings.walking_speed_kmh if profile == "foot" else settings.driving_speed_kmh
    return max(1, int(round((distance_km / speed) * 60)))
