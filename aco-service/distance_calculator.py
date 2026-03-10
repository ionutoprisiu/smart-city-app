import math
import logging
import httpx

logger = logging.getLogger(__name__)

OSRM_BASE_URL = "https://router.project-osrm.org"


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    lat1_rad, lon1_rad = math.radians(lat1), math.radians(lon1)
    lat2_rad, lon2_rad = math.radians(lat2), math.radians(lon2)
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def calculate_distance_matrix(attractions: list[dict]) -> list[list[float]]:
    n = len(attractions)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = haversine_distance(
                attractions[i]['latitude'], attractions[i]['longitude'],
                attractions[j]['latitude'], attractions[j]['longitude'],
            )
            matrix[i][j] = d
            matrix[j][i] = d
    return matrix


async def calculate_osrm_distance_matrix(attractions: list[dict]) -> list[list[float]]:
    coords = ";".join(
        f"{a['longitude']},{a['latitude']}" for a in attractions
    )
    url = f"{OSRM_BASE_URL}/table/v1/driving/{coords}?annotations=distance"

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

        if data.get("code") != "Ok":
            logger.warning(f"OSRM table failed: {data.get('code')}, falling back to Haversine")
            return calculate_distance_matrix(attractions)

        raw = data["distances"]
        n = len(attractions)
        matrix = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                matrix[i][j] = raw[i][j] / 1000.0

        logger.info(f"OSRM distance matrix built for {n} points")
        return matrix

    except Exception as e:
        logger.warning(f"OSRM request failed ({e}), falling back to Haversine")
        return calculate_distance_matrix(attractions)


async def fetch_osrm_route(ordered_attractions: list[dict]) -> list[dict]:
    segments = await fetch_osrm_route_segments(ordered_attractions)
    all_points = []
    for seg in segments:
        all_points.extend(seg)
    return all_points


async def fetch_osrm_route_segments(ordered_attractions: list[dict]) -> list[list[dict]]:
    """Fetch route geometry per leg so overlapping roads show distinct colors."""
    if len(ordered_attractions) < 2:
        return [[{"latitude": a["latitude"], "longitude": a["longitude"]} for a in ordered_attractions]]

    segments = []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            for i in range(len(ordered_attractions) - 1):
                a = ordered_attractions[i]
                b = ordered_attractions[i + 1]
                coords = f"{a['longitude']},{a['latitude']};{b['longitude']},{b['latitude']}"
                url = f"{OSRM_BASE_URL}/route/v1/driving/{coords}?overview=full&geometries=geojson"

                response = await client.get(url)
                response.raise_for_status()
                data = response.json()

                if data.get("code") == "Ok" and data.get("routes"):
                    geometry = data["routes"][0]["geometry"]["coordinates"]
                    segment = [{"latitude": c[1], "longitude": c[0]} for c in geometry]
                    segment = _anchor_segment_to_points(segment, a, b)
                    segments.append(segment)
                else:
                    segments.append([
                        {"latitude": a["latitude"], "longitude": a["longitude"]},
                        {"latitude": b["latitude"], "longitude": b["longitude"]},
                    ])
    except Exception as e:
        logger.warning(f"OSRM segment request failed ({e}), falling back to straight lines")
        for i in range(len(ordered_attractions) - 1):
            a = ordered_attractions[i]
            b = ordered_attractions[i + 1]
            segments.append([
                {"latitude": a["latitude"], "longitude": a["longitude"]},
                {"latitude": b["latitude"], "longitude": b["longitude"]},
            ])

    return segments


def _anchor_segment_to_points(segment: list[dict], start: dict, end: dict) -> list[dict]:
    """Ensure polyline touches exact selected points, not only OSRM snapped road points."""
    if not segment:
        return [
            {"latitude": start["latitude"], "longitude": start["longitude"]},
            {"latitude": end["latitude"], "longitude": end["longitude"]},
        ]

    anchored = segment

    first = anchored[0]
    if not _is_same_point(first["latitude"], first["longitude"], start["latitude"], start["longitude"]):
        anchored = [{"latitude": start["latitude"], "longitude": start["longitude"]}, *anchored]

    last = anchored[-1]
    if not _is_same_point(last["latitude"], last["longitude"], end["latitude"], end["longitude"]):
        anchored = [*anchored, {"latitude": end["latitude"], "longitude": end["longitude"]}]

    return anchored


def _is_same_point(lat1: float, lon1: float, lat2: float, lon2: float, eps: float = 1e-6) -> bool:
    return abs(lat1 - lat2) < eps and abs(lon1 - lon2) < eps


def calculate_route_distance(route: list[int], distance_matrix: list[list[float]]) -> float:
    if len(route) < 2:
        return 0.0
    return sum(distance_matrix[route[i]][route[i + 1]] for i in range(len(route) - 1))
