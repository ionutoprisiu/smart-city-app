from __future__ import annotations

import math

EARTH_RADIUS_KM = 6371.0
MISSING_EDGE_KM = 1e6
MISSING_EDGE_SEC = 864_000.0


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1_r, lon1_r = math.radians(lat1), math.radians(lon1)
    lat2_r, lon2_r = math.radians(lat2), math.radians(lon2)
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_r) * math.cos(lat2_r) * math.sin(dlon / 2) ** 2
    return EARTH_RADIUS_KM * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def calculate_distance_matrix(points: list[dict]) -> list[list[float]]:
    n = len(points)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = haversine_distance(
                points[i]["latitude"],
                points[i]["longitude"],
                points[j]["latitude"],
                points[j]["longitude"],
            )
            matrix[i][j] = d
            matrix[j][i] = d
    return matrix


def calculate_route_cost(route: list[int], cost_matrix: list[list[float]]) -> float:
    """Sum the matrix edges along a route. Works for any cost (km or seconds)."""
    if len(route) < 2:
        return 0.0
    return sum(cost_matrix[route[i]][route[i + 1]] for i in range(len(route) - 1))


def is_same_point(lat1: float, lon1: float, lat2: float, lon2: float, eps: float = 1e-6) -> bool:
    return abs(lat1 - lat2) < eps and abs(lon1 - lon2) < eps
