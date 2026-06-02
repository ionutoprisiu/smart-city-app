"""Reproducibility + solution-quality checks for the ACO optimizer.

These back the experimental claims in the thesis: a fixed seed yields identical
runs, and ACO is never worse than the greedy baseline and stays close to the
brute-force optimum on small instances.
"""

from __future__ import annotations

from app.algorithms.aco import ACOOptimizer
from app.algorithms.brute_force import brute_force
from app.algorithms.nearest_neighbor import nearest_neighbor
from app.common.distance import calculate_distance_matrix, calculate_route_cost

# A handful of Cluj-Napoca landmarks (lat, lon), index 0 acts as the anchor.
_CLUJ_POINTS = [
    {"latitude": 46.7693, "longitude": 23.5907},  # Piața Unirii
    {"latitude": 46.7712, "longitude": 23.5836},  # Cetățuia
    {"latitude": 46.7536, "longitude": 23.5719},  # Parcul Central / Cluj Arena area
    {"latitude": 46.7806, "longitude": 23.6228},  # Grădina Botanică (approx NE)
    {"latitude": 46.7667, "longitude": 23.5905},  # Teatrul Național
    {"latitude": 46.7585, "longitude": 23.5681},  # Hasdeu campus
]


def test_same_seed_gives_identical_results() -> None:
    matrix = calculate_distance_matrix(_CLUJ_POINTS)
    route_a, cost_a = ACOOptimizer(matrix, seed=42).optimize()
    route_b, cost_b = ACOOptimizer(matrix, seed=42).optimize()
    assert route_a == route_b
    assert cost_a == cost_b


def test_aco_not_worse_than_greedy() -> None:
    matrix = calculate_distance_matrix(_CLUJ_POINTS)
    aco_route, aco_cost = ACOOptimizer(matrix, seed=7).optimize()
    greedy_route, greedy_cost = nearest_neighbor(matrix)
    assert calculate_route_cost(aco_route, matrix) <= greedy_cost + 1e-9
    assert aco_cost <= greedy_cost + 1e-9


def test_aco_close_to_optimum_small_instance() -> None:
    matrix = calculate_distance_matrix(_CLUJ_POINTS)
    _, optimal_cost = brute_force(matrix)
    _, aco_cost = ACOOptimizer(matrix, seed=7).optimize()
    # ACO is heuristic; require it within 5% of the exact optimum here.
    assert aco_cost <= optimal_cost * 1.05
