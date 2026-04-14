import logging

from fastapi import APIRouter, HTTPException, status

from app.distance import (
    MISSING_EDGE_SEC,
    calculate_distance_matrix,
    calculate_osrm_matrices,
    calculate_route_distance,
    fetch_osrm_route_segments,
    normalize_osrm_profile,
    osrm_base_url_for_profile,
)
from app.optimizer import ACOOptimizer
from app.schemas import OptimizeRequest, OptimizeResponse, RouteStepResponse

logger = logging.getLogger(__name__)

router = APIRouter()

WALKING_SPEED_KMH = 4.0
DRIVING_SPEED_KMH = 28.0


@router.get("/")
def root() -> dict:
    return {"status": "ok", "service": "ACO Route Optimization", "version": "2.0.0"}


@router.get("/health")
def health_check() -> dict:
    return {"status": "healthy", "service": "ACO Route Optimization", "version": "2.0.0"}


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize_route(request: OptimizeRequest) -> OptimizeResponse:
    try:
        has_start = request.startLatitude is not None and request.startLongitude is not None
        attractions_data = _prepare_attractions_data(request)
        profile = normalize_osrm_profile(request.routingProfile)

        if request.useOsrm:
            logger.info("OSRM base for profile: %s", osrm_base_url_for_profile(profile))
        logger.info(
            "Optimizing route for %d attractions, start=%s, OSRM=%s, profile=%s",
            len(attractions_data), has_start, request.useOsrm, profile,
        )

        if len(attractions_data) == 1 and has_start:
            return await _single_destination_route(attractions_data[0], request, profile)

        all_points: list[dict] = []
        if has_start:
            all_points.append({
                "id": 0,
                "latitude": request.startLatitude,
                "longitude": request.startLongitude,
            })
        all_points.extend(attractions_data)

        duration_matrix: list[list[float]] | None = None
        used_osrm = False
        if request.useOsrm:
            dist_m, dur_m = await calculate_osrm_matrices(all_points, profile)
            if dist_m is not None:
                distance_matrix = dist_m
                duration_matrix = dur_m
                used_osrm = True
            else:
                distance_matrix = calculate_distance_matrix(all_points)
        else:
            distance_matrix = calculate_distance_matrix(all_points)

        cost_matrix = duration_matrix if (used_osrm and duration_matrix is not None) else distance_matrix

        optimizer = ACOOptimizer(cost_matrix)
        best_route, _ = optimizer.optimize()
        best_distance_km = calculate_route_distance(best_route, distance_matrix)

        ordered = [all_points[i] for i in best_route]
        route_geometry: list[dict] = []
        route_segments: list[list[dict]] = []
        leg_durations_sec: list[float] = []
        if used_osrm:
            route_segments, leg_durations_sec = await fetch_osrm_route_segments(ordered, profile)
            for seg in route_segments:
                route_geometry.extend(seg)

        response = _build_response(
            all_points, best_route, best_distance_km, distance_matrix,
            route_geometry, route_segments, used_osrm, profile, duration_matrix,
            leg_durations_sec,
        )
        logger.info(
            "Route optimized: %.3f km, travel=%dm profile=%s OSRM=%s",
            response.totalDistance, response.travelTimeMinutes, profile, used_osrm,
        )
        return response

    except ValueError as e:
        logger.warning("Validation error: %s", e)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error("Error optimizing route: %s", e, exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _prepare_attractions_data(request: OptimizeRequest) -> list[dict]:
    return [
        {
            "id": attr.id,
            "latitude": attr.latitude,
            "longitude": attr.longitude,
        }
        for attr in request.attractions
    ]


def _travel_time_minutes(
    best_route: list[int],
    best_distance_km: float,
    duration_matrix: list[list[float]] | None,
    routing_profile: str,
    leg_durations_sec: list[float] | None,
) -> int:
    """Travel time only (minutes), excluding visit time."""
    table_sec = 0.0
    if duration_matrix is not None and len(best_route) >= 2:
        for i in range(len(best_route) - 1):
            a, b = best_route[i], best_route[i + 1]
            table_sec += float(duration_matrix[a][b])

    leg_sec = 0.0
    if leg_durations_sec:
        leg_sec = sum(float(d) for d in leg_durations_sec if d and d > 0)

    if (
        table_sec > 0
        and table_sec < (MISSING_EDGE_SEC * max(2, len(best_route)))
        and leg_sec > 0
        and leg_sec < table_sec * 0.45
    ):
        return max(1, int(round(table_sec / 60.0)))

    if leg_sec > 0:
        return max(1, int(round(leg_sec / 60.0)))

    if table_sec > 0 and table_sec < (MISSING_EDGE_SEC * max(2, len(best_route))):
        return max(1, int(round(table_sec / 60.0)))

    if routing_profile == "foot":
        return max(1, int(round((best_distance_km / WALKING_SPEED_KMH) * 60)))
    return max(1, int(round((best_distance_km / DRIVING_SPEED_KMH) * 60)))


async def _single_destination_route(
    attraction: dict, request: OptimizeRequest, profile: str
) -> OptimizeResponse:
    start = {
        "id": 0,
        "latitude": request.startLatitude,
        "longitude": request.startLongitude,
    }
    points = [start, attraction]

    duration_matrix: list[list[float]] | None = None
    used_osrm = False
    if request.useOsrm:
        dist_m, dur_m = await calculate_osrm_matrices(points, profile)
        if dist_m is not None:
            distance_matrix = dist_m
            duration_matrix = dur_m
            used_osrm = True
        else:
            distance_matrix = calculate_distance_matrix(points)
    else:
        distance_matrix = calculate_distance_matrix(points)

    distance = distance_matrix[0][1]
    route_geometry: list[dict] = []
    route_segments: list[list[dict]] = []
    leg_durations_sec: list[float] = []
    if used_osrm:
        route_segments, leg_durations_sec = await fetch_osrm_route_segments(points, profile)
        for seg in route_segments:
            route_geometry.extend(seg)

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
    all_points: list[dict],
    best_route: list[int],
    best_distance: float,
    distance_matrix: list[list[float]],
    route_geometry: list[dict],
    route_segments: list[list[dict]],
    used_osrm: bool,
    routing_profile: str,
    duration_matrix: list[list[float]] | None,
    leg_durations_sec: list[float],
) -> OptimizeResponse:
    steps = []
    path = []

    for i, route_index in enumerate(best_route):
        point = all_points[route_index]
        is_start = point["id"] == 0

        distance_to_next = None
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
        best_route, best_distance, duration_matrix, routing_profile, leg_durations_sec,
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
        routingProfile=routing_profile,
    )
