# Greedy nearest-neighbour heuristic — the fast baseline for ACO.
from __future__ import annotations

from app.common.distance import calculate_route_cost


def nearest_neighbor(cost_matrix: list[list[float]]) -> tuple[list[int], float]:
    if not cost_matrix:
        raise ValueError("Cost matrix cannot be empty")
    if len(cost_matrix) < 2:
        raise ValueError("At least 2 points are required")

    num_points = len(cost_matrix)
    route = [0]
    unvisited = set(range(1, num_points))

    while unvisited:
        current = route[-1]
        nxt = min(unvisited, key=lambda j: cost_matrix[current][j])  # always hop to the cheapest next
        route.append(nxt)
        unvisited.discard(nxt)

    return route, calculate_route_cost(route, cost_matrix)
