# 2-opt local search (path anchored at node 0): reverse segments while it shortens
# the path. Used over a NN start and as refinement on top of ACO.
from __future__ import annotations

from app.algorithms.nearest_neighbor import nearest_neighbor
from app.common.distance import calculate_route_cost


def two_opt(
    cost_matrix: list[list[float]],
    initial_route: list[int] | None = None,
) -> tuple[list[int], float]:
    if not cost_matrix:
        raise ValueError("Cost matrix cannot be empty")
    if len(cost_matrix) < 2:
        raise ValueError("At least 2 points are required")

    # Without a starting tour, refine the greedy nearest-neighbour route.
    route = list(initial_route) if initial_route is not None else nearest_neighbor(cost_matrix)[0]
    n = len(route)
    if n < 4:
        return route, calculate_route_cost(route, cost_matrix)

    d = cost_matrix
    improved = True
    while improved:
        improved = False
        # Node 0 (the fixed start) never moves, so i starts at 1.
        for i in range(1, n - 1):
            for j in range(i + 1, n):
                # Reversing positions i..j only changes the edges at the segment's
                # ends: (i-1, i) and (j, j+1). Compare old vs new for those edges.
                before = d[route[i - 1]][route[i]]
                after = d[route[i - 1]][route[j]]
                if j + 1 < n:  # open path: the last node has no outgoing edge
                    before += d[route[j]][route[j + 1]]
                    after += d[route[i]][route[j + 1]]
                if after + 1e-12 < before:
                    route[i : j + 1] = reversed(route[i : j + 1])
                    improved = True

    return route, calculate_route_cost(route, cost_matrix)
