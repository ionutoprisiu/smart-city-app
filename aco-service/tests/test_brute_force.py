"""Unit tests for the exact brute-force TSP reference."""

from __future__ import annotations

import pytest

from app.algorithms.brute_force import brute_force
from app.algorithms.nearest_neighbor import nearest_neighbor
from app.common.distance import calculate_route_cost


def test_rejects_empty_matrix() -> None:
    with pytest.raises(ValueError, match="cannot be empty"):
        brute_force([])


def test_rejects_instances_above_limit() -> None:
    matrix = [[0.0] * 4 for _ in range(4)]
    with pytest.raises(ValueError, match="limited to 3 points"):
        brute_force(matrix, max_points=3)


def test_finds_known_optimum() -> None:
    # Optimal open tour from 0 is 0 -> 1 -> 3 -> 2 (cost 1 + 1 + 1 = 3).
    matrix = [
        [0.0, 1.0, 8.0, 8.0],
        [1.0, 0.0, 8.0, 1.0],
        [8.0, 8.0, 0.0, 1.0],
        [8.0, 1.0, 1.0, 0.0],
    ]
    route, cost = brute_force(matrix)
    assert route[0] == 0
    assert cost == pytest.approx(3.0)


def test_optimum_never_worse_than_greedy() -> None:
    matrix = [
        [0.0, 2.0, 9.0, 10.0, 7.0],
        [2.0, 0.0, 6.0, 4.0, 3.0],
        [9.0, 6.0, 0.0, 3.0, 8.0],
        [10.0, 4.0, 3.0, 0.0, 5.0],
        [7.0, 3.0, 8.0, 5.0, 0.0],
    ]
    _, optimal_cost = brute_force(matrix)
    greedy_route, _ = nearest_neighbor(matrix)
    assert optimal_cost <= calculate_route_cost(greedy_route, matrix) + 1e-9
