"""HTTP client for the OSRM routing engine (`/table` and `/route`).

This module is the only place that talks HTTP to OSRM. It returns plain
data structures (matrices, segments, durations); higher-level decisions
(fallback to haversine, cost-matrix selection) live in the service layer.
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

DEFAULT_TIMEOUT = 25.0
SUPPORTED_PROFILES = ("driving", "foot")


def normalize_profile(profile: str) -> str:
    p = (profile or "driving").strip().lower()
    if p not in SUPPORTED_PROFILES:
        log.warning("Unknown OSRM profile '%s', using driving", profile)
        return "driving"
    return p


async def fetch_matrices(
    points: list[dict], profile: str = "driving"
) -> tuple[list[list[float]] | None, list[list[float]] | None]:
    """Return `(distance_km_matrix, duration_sec_matrix)` from OSRM `/table`.

    On any failure (HTTP error, non-Ok response), returns `(None, None)` so
    the caller can fall back to a haversine-only matrix.
    """
    prof = normalize_profile(profile)
    base = settings.osrm_url_for_profile(prof)
    coords = ";".join(f"{p['longitude']},{p['latitude']}" for p in points)
    url = f"{base}/table/v1/{prof}/{coords}?annotations=distance,duration"

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            response = await client.get(url)
            response.raise_for_status()
            data = response.json()

        if data.get("code") != "Ok":
            log.warning("OSRM table failed: %s, falling back to Haversine", data.get("code"))
            return None, None

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
                dist_m[i][j] = MISSING_EDGE_KM if dd is None else float(dd) / 1000.0
                if raw_t is not None:
                    tt = raw_t[i][j]
                    dur_s[i][j] = MISSING_EDGE_SEC if tt is None else float(tt)
                else:
                    dur_s[i][j] = MISSING_EDGE_SEC

        log.info("OSRM matrices built for %d points (profile=%s)", n, prof)
        return dist_m, dur_s
    except Exception as exc:
        log.warning("OSRM request failed (%s), falling back to Haversine", exc)
        return None, None


async def fetch_route_segments(
    ordered_points: list[dict], profile: str = "driving"
) -> tuple[list[list[dict]], list[float]]:
    """Per-leg OSRM `/route` geometry plus per-leg duration (seconds).

    On any failure, falls back to straight lines and zero durations.
    """
    prof = normalize_profile(profile)
    base = settings.osrm_url_for_profile(prof)
    if len(ordered_points) < 2:
        return (
            [[{"latitude": p["latitude"], "longitude": p["longitude"]} for p in ordered_points]],
            [],
        )

    segments: list[list[dict]] = []
    leg_durations_sec: list[float] = []
    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
            for i in range(len(ordered_points) - 1):
                a, b = ordered_points[i], ordered_points[i + 1]
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
                    segments.append(_anchor_segment(segment, a, b))
                else:
                    leg_durations_sec.append(0.0)
                    segments.append(_straight_line(a, b))
    except Exception as exc:
        log.warning("OSRM segment request failed (%s), falling back to straight lines", exc)
        segments = [_straight_line(a, b) for a, b in _consecutive_pairs(ordered_points)]
        leg_durations_sec = [0.0] * (len(ordered_points) - 1)

    return segments, leg_durations_sec


def _consecutive_pairs(points: list[dict]):
    for i in range(len(points) - 1):
        yield points[i], points[i + 1]


def _straight_line(a: dict, b: dict) -> list[dict]:
    return [
        {"latitude": a["latitude"], "longitude": a["longitude"]},
        {"latitude": b["latitude"], "longitude": b["longitude"]},
    ]


def _anchor_segment(segment: list[dict], start: dict, end: dict) -> list[dict]:
    """Snap segment ends to requested POIs only when OSRM is already close.

    Prepending/appending arbitrary coordinates created short diagonal "chords"
    off the road network (triangle artifacts at junctions).
    """
    if not segment:
        return _straight_line(start, end)

    anchored = list(segment)
    snap_km = 0.12

    d0_km = haversine_distance(
        start["latitude"], start["longitude"], anchored[0]["latitude"], anchored[0]["longitude"]
    )
    if d0_km <= snap_km or is_same_point(
        anchored[0]["latitude"], anchored[0]["longitude"], start["latitude"], start["longitude"]
    ):
        anchored[0] = {"latitude": start["latitude"], "longitude": start["longitude"]}

    d1_km = haversine_distance(
        end["latitude"], end["longitude"], anchored[-1]["latitude"], anchored[-1]["longitude"]
    )
    if d1_km <= snap_km or is_same_point(
        anchored[-1]["latitude"], anchored[-1]["longitude"], end["latitude"], end["longitude"]
    ):
        anchored[-1] = {"latitude": end["latitude"], "longitude": end["longitude"]}

    return anchored
