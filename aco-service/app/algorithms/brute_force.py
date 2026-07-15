# Exact TSP over every permutation — the benchmark optimum, O(n!), capped at ~12 points.
from __future__ import annotations

from itertools import permutations

from app.common.distance import calculate_route_cost

DEFAULT_MAX_POINTS = 12


def brute_force(cost_matrix: list[list[float]], max_points: int = DEFAULT_MAX_POINTS) -> tuple[list[int], float]:
    if not cost_matrix:
        raise ValueError("Cost matrix cannot be empty")
    if len(cost_matrix) < 2:
        raise ValueError("At least 2 points are required")

    num_points = len(cost_matrix)
    if num_points > max_points:
        raise ValueError(f"Brute force is limited to {max_points} points (got {num_points})")

    best_route: list[int] = []
    best_cost = float("inf")
    # Node 0 stays fixed as the start; permute only the attractions after it.
    for perm in permutations(range(1, num_points)):
        route = [0, *perm]
        cost = calculate_route_cost(route, cost_matrix)
        if cost < best_cost:
            best_cost = cost
            best_route = route

    return best_route, best_cost
