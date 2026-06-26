from __future__ import annotations

import pytest

from app.algorithms.brute_force import brute_force
from app.algorithms.pso import PSOOptimizer
from app.common.distance import calculate_distance_matrix


def _matrix() -> list[list[float]]:
    points = [
        {"latitude": 46.77, "longitude": 23.59},
        {"latitude": 46.78, "longitude": 23.58},
        {"latitude": 46.76, "longitude": 23.60},
        {"latitude": 46.75, "longitude": 23.55},
        {"latitude": 46.79, "longitude": 23.56},
    ]
    return calculate_distance_matrix(points)


def test_pso_requires_at_least_two_points() -> None:
    with pytest.raises(ValueError, match="At least 2 points"):
        PSOOptimizer([[0.0]])


def test_pso_reproducible_with_seed() -> None:
    matrix = _matrix()
    route_a, cost_a = PSOOptimizer(matrix, seed=21).optimize()
    route_b, cost_b = PSOOptimizer(matrix, seed=21).optimize()
    assert route_a == route_b
    assert cost_a == cost_b


def test_pso_finds_reasonable_tour_on_small_instance() -> None:
    matrix = _matrix()
    _, pso_cost = PSOOptimizer(matrix, seed=7, max_iterations=300).optimize()
    _, optimal_cost = brute_force(matrix)
    assert pso_cost <= optimal_cost * 1.05
