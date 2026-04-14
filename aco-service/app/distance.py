import logging
import math
import os

import httpx

logger = logging.getLogger(__name__)

_DEFAULT_PUBLIC = "https://router.project-osrm.org"

MISSING_EDGE_KM = 1e6
MISSING_EDGE_SEC = 864_000.0  # 10 days


def osrm_base_url_for_profile(profile: str) -> str:
    """Per-mode OSRM base URL (env: OSRM_FOOT_BASE_URL / OSRM_DRIVING_BASE_URL)."""
    prof = normalize_osrm_profile(profile)
    if prof == "foot":
        raw = os.environ.get("OSRM_FOOT_BASE_URL") or os.environ.get("OSRM_BASE_URL") or _DEFAULT_PUBLIC
    else:
        raw = os.environ.get("OSRM_DRIVING_BASE_URL") or os.environ.get("OSRM_BASE_URL") or _DEFAULT_PUBLIC
    return raw.rstrip("/")


def normalize_osrm_profile(profile: str) -> str:
    p = (profile or "driving").strip().lower()
    if p not in ("driving", "foot"):
        logger.warning("Unknown OSRM profile '%s', using driving", profile)
        return "driving"
    return p


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    lat1_r, lon1_r = math.radians(lat1), math.radians(lon1)
    lat2_r, lon2_r = math.radians(lat2), math.radians(lon2)
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def calculate_distance_matrix(attractions: list[dict]) -> list[list[float]]:
    n = len(attractions)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = haversine_distance(
                attractions[i]["latitude"],
                attractions[i]["longitude"],
                attractions[j]["latitude"],
                attractions[j]["longitude"],
            )
            matrix[i][j] = d
            matrix[j][i] = d
    return matrix


async def calculate_osrm_matrices(
    attractions: list[dict], profile: str = "driving"
) -> tuple[list[list[float]] | None, list[list[float]] | None]:
    """Returns (distance_km_matrix, duration_sec_matrix) or (None, None) on failure."""
    prof = normalize_osrm_profile(profile)
    base = osrm_base_url_for_profile(profile)
    coords = ";".join(f"{a['longitude']},{a['latitude']}" for a in attractions)
    url = f"{base}/table/v1/{prof}/{coords}?annotations=distance,duration"

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

        if data.get("code") != "Ok":
            logger.warning("OSRM table failed: %s, falling back to Haversine", data.get("code"))
            return None, None

        raw_d = data["distances"]
        raw_t = data.get("durations")
        n = len(attractions)
        dist_m = [[0.0] * n for _ in range(n)]
        dur_s = [[0.0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i == j:
                    continue
                dd = raw_d[i][j]
                dist_m[i][j] = MISSING_EDGE_KM if dd is None else float(dd) / 1000.0
                if raw_t is not None:
                    tt = raw_t[i][j]
                    dur_s[i][j] = MISSING_EDGE_SEC if tt is None else float(tt)
                else:
                    dur_s[i][j] = MISSING_EDGE_SEC

        logger.info("OSRM matrices built for %d points (profile=%s)", n, prof)
        return dist_m, dur_s

    except Exception as e:
        logger.warning("OSRM request failed (%s), falling back to Haversine", e)
        return None, None


async def calculate_osrm_distance_matrix(
    attractions: list[dict], profile: str = "driving"
) -> list[list[float]]:
    dist, _ = await calculate_osrm_matrices(attractions, profile)
    if dist is not None:
        return dist
    return calculate_distance_matrix(attractions)


async def fetch_osrm_route_segments(
    ordered_attractions: list[dict], profile: str = "driving"
) -> tuple[list[list[dict]], list[float]]:
    """Per-leg OSRM /route geometry + duration (seconds)."""
    prof = normalize_osrm_profile(profile)
    base = osrm_base_url_for_profile(profile)
    if len(ordered_attractions) < 2:
        return (
            [[{"latitude": a["latitude"], "longitude": a["longitude"]} for a in ordered_attractions]],
            [],
        )

    segments: list[list[dict]] = []
    leg_durations_sec: list[float] = []
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            for i in range(len(ordered_attractions) - 1):
                a = ordered_attractions[i]
                b = ordered_attractions[i + 1]
                coords = f"{a['longitude']},{a['latitude']};{b['longitude']},{b['latitude']}"
                url = f"{base}/route/v1/{prof}/{coords}?overview=full&geometries=geojson"

                response = await client.get(url)
                response.raise_for_status()
                data = response.json()

                if data.get("code") == "Ok" and data.get("routes"):
                    route0 = data["routes"][0]
                    leg_durations_sec.append(float(route0.get("duration", 0)))
                    geometry = route0["geometry"]["coordinates"]
                    segment = [{"latitude": c[1], "longitude": c[0]} for c in geometry]
                    segment = _anchor_segment_to_points(segment, a, b)
                    segments.append(segment)
                else:
                    leg_durations_sec.append(0.0)
                    segments.append([
                        {"latitude": a["latitude"], "longitude": a["longitude"]},
                        {"latitude": b["latitude"], "longitude": b["longitude"]},
                    ])
    except Exception as e:
        logger.warning("OSRM segment request failed (%s), falling back to straight lines", e)
        segments = []
        leg_durations_sec = []
        for i in range(len(ordered_attractions) - 1):
            a = ordered_attractions[i]
            b = ordered_attractions[i + 1]
            segments.append([
                {"latitude": a["latitude"], "longitude": a["longitude"]},
                {"latitude": b["latitude"], "longitude": b["longitude"]},
            ])
            leg_durations_sec.append(0.0)

    return segments, leg_durations_sec


def calculate_route_distance(route: list[int], distance_matrix: list[list[float]]) -> float:
    if len(route) < 2:
        return 0.0
    return sum(distance_matrix[route[i]][route[i + 1]] for i in range(len(route) - 1))


def calculate_route_cost(route: list[int], cost_matrix: list[list[float]]) -> float:
    if len(route) < 2:
        return 0.0
    return sum(cost_matrix[route[i]][route[i + 1]] for i in range(len(route) - 1))


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
