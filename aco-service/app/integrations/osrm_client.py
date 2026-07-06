"""Client for the two OSRM endpoints used by the optimizer:

  * /table  -> cost matrices (duration + distance) between all points, for ACO;
  * /route  -> the real road geometry for the final ordered tour, for the map.

Every network path degrades gracefully: on any failure it returns None (matrix)
or straight-line fallbacks (geometry), so the request never hard-fails.
"""
from __future__ import annotations

import logging

import httpx

from app.common.distance import (
    MISSING_EDGE_KM,
    MISSING_EDGE_SEC,
    haversine_distance,
    is_same_point,
)
from app.core.config import settings

log = logging.getLogger(__name__)

SUPPORTED_PROFILES = ("driving", "foot")


def normalize_profile(profile: str) -> str:
    p = (profile or "driving").strip().lower()
    if p not in SUPPORTED_PROFILES:
        log.warning("Unknown OSRM profile '%s', using driving", profile)
        return "driving"
    return p


def _table_matrices_from_json(points: list[dict], data: dict) -> tuple[list[list[float]], list[list[float]]] | None:
    if data.get("code") != "Ok":
        log.warning("OSRM table failed: %s, falling back to Haversine", data.get("code"))
        return None

    raw_d = data["distances"]
    raw_t = data.get("durations")
    n = len(points)
    dist_m = [[0.0] * n for _ in range(n)]
    dur_s = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            dd = raw_d[i][j]
            # OSRM returns metres; convert to km. None = unroutable pair -> sentinel.
            dist_m[i][j] = MISSING_EDGE_KM if dd is None else float(dd) / 1000.0
            if raw_t is not None:
                tt = raw_t[i][j]
                dur_s[i][j] = MISSING_EDGE_SEC if tt is None else float(tt)
            else:
                dur_s[i][j] = MISSING_EDGE_SEC
    return dist_m, dur_s


async def fetch_matrices(
    points: list[dict], profile: str = "driving"
) -> tuple[list[list[float]] | None, list[list[float]] | None]:
    prof = normalize_profile(profile)
    base = settings.osrm_url_for_profile(prof)
    # OSRM wants lon,lat (not lat,lon); annotations asks for BOTH matrices at once.
    coords = ";".join(f"{p['longitude']},{p['latitude']}" for p in points)
    url = f"{base}/table/v1/{prof}/{coords}?annotations=distance,duration"

    try:
        async with httpx.AsyncClient(timeout=settings.http_osrm_timeout_seconds) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        log.warning("OSRM request failed (%s), falling back to Haversine", exc)
        return None, None

    parsed = _table_matrices_from_json(points, data)
    if parsed is None:
        return None, None
    dist_m, dur_s = parsed
    log.info("OSRM matrices built for %d points (profile=%s)", len(points), prof)
    return dist_m, dur_s


async def fetch_route_segments(
    ordered_points: list[dict], profile: str = "driving"
) -> tuple[list[list[dict]], list[float]]:
    _geometry, segments, durations = await fetch_route_details(ordered_points, profile)
    return segments, durations


async def fetch_route_details(
    ordered_points: list[dict], profile: str = "driving"
) -> tuple[list[dict], list[list[dict]], list[float]]:
    if len(ordered_points) < 2:
        single = [{"latitude": p["latitude"], "longitude": p["longitude"]} for p in ordered_points]
        return single, [single] if single else [], []

    prof = normalize_profile(profile)
    base = settings.osrm_url_for_profile(prof)
    coords = ";".join(f"{p['longitude']},{p['latitude']}" for p in ordered_points)
    url = (
        f"{base}/route/v1/{prof}/{coords}"
        "?overview=full&geometries=geojson&steps=true&continue_straight=false"
    )

    try:
        async with httpx.AsyncClient(timeout=settings.http_osrm_timeout_seconds) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        log.warning("OSRM route request failed (%s), falling back to straight lines", exc)
        return _fallback_route_details(ordered_points)

    if data.get("code") != "Ok" or not data.get("routes"):
        log.warning("OSRM route failed: %s, falling back to straight lines", data.get("code"))
        return _fallback_route_details(ordered_points)

    route = data["routes"][0]
    full_geometry = _coords_from_geojson(route.get("geometry") or {})
    legs = route.get("legs") or []
    leg_durations_sec = [float(leg.get("duration", 0)) for leg in legs]
    segments = _legs_to_segments(legs)  # one road-snapped polyline per waypoint pair

    # If OSRM didn't give one clean leg per pair, re-split the full line ourselves.
    expected_legs = len(ordered_points) - 1
    if len(segments) != expected_legs or any(len(seg) < 2 for seg in segments):
        segments = _split_geometry_by_waypoints(full_geometry, ordered_points)

    if any(len(seg) < 2 for seg in segments):
        return _fallback_route_details(ordered_points)

    if len(full_geometry) < 2:
        full_geometry = _merge_segments(segments)

    return full_geometry, segments, leg_durations_sec


def _fallback_route_details(
    ordered_points: list[dict],
) -> tuple[list[dict], list[list[dict]], list[float]]:
    segments = [_straight_line(a, b) for a, b in _consecutive_pairs(ordered_points)]
    full_geometry = _merge_segments(segments)
    return full_geometry, segments, [0.0] * len(segments)


def _consecutive_pairs(points: list[dict]):
    for i in range(len(points) - 1):
        yield points[i], points[i + 1]


def _straight_line(a: dict, b: dict) -> list[dict]:
    return [
        {"latitude": a["latitude"], "longitude": a["longitude"]},
        {"latitude": b["latitude"], "longitude": b["longitude"]},
    ]


def _coords_from_geojson(geometry: dict) -> list[dict]:
    raw = geometry.get("coordinates") or []
    return [{"latitude": c[1], "longitude": c[0]} for c in raw]


def _append_merged_coords(target: list[dict], points: list[dict]) -> None:
    for j, point in enumerate(points):
        if j == 0 and target and is_same_point(
            target[-1]["latitude"],
            target[-1]["longitude"],
            point["latitude"],
            point["longitude"],
        ):
            continue
        target.append(point)


def _legs_to_segments(legs: list[dict]) -> list[list[dict]]:
    segments: list[list[dict]] = []
    for leg in legs:
        leg_coords: list[dict] = []
        for step in leg.get("steps", []):
            geom = step.get("geometry")
            if not geom:
                continue
            _append_merged_coords(leg_coords, _coords_from_geojson(geom))
        segments.append(leg_coords)
    return segments


def _merge_segments(segments: list[list[dict]]) -> list[dict]:
    merged: list[dict] = []
    for segment in segments:
        _append_merged_coords(merged, segment)
    return merged


def _split_geometry_by_waypoints(
    geometry: list[dict], ordered_points: list[dict]
) -> list[list[dict]]:
    if len(geometry) < 2 or len(ordered_points) < 2:
        return [_straight_line(a, b) for a, b in _consecutive_pairs(ordered_points)]

    # Walk the full polyline and cut it at the geometry point closest to each
    # waypoint, so every leg gets its own slice (search only moves forward).
    split_indices = [0]
    search_from = 0
    for waypoint in ordered_points[1:]:
        best = search_from
        best_d = float("inf")
        for i in range(search_from, len(geometry)):
            d = haversine_distance(
                geometry[i]["latitude"],
                geometry[i]["longitude"],
                waypoint["latitude"],
                waypoint["longitude"],
            )
            if d < best_d:
                best_d = d
                best = i
        split_indices.append(best)
        search_from = best
    split_indices[-1] = len(geometry) - 1

    segments: list[list[dict]] = []
    for i in range(len(split_indices) - 1):
        start = split_indices[i]
        end = split_indices[i + 1]
        if end <= start:
            segments.append(_straight_line(ordered_points[i], ordered_points[i + 1]))
            continue
        segments.append(list(geometry[start : end + 1]))
    return segments
