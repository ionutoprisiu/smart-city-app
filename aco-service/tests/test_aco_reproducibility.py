from __future__ import annotations

from app.algorithms.aco import ACOOptimizer
from app.algorithms.brute_force import brute_force
from app.algorithms.nearest_neighbor import nearest_neighbor
from app.common.distance import calculate_distance_matrix, calculate_route_cost

_CLUJ_POINTS = [
    {"latitude": 46.7693, "longitude": 23.5907},
    {"latitude": 46.7712, "longitude": 23.5836},
    {"latitude": 46.7536, "longitude": 23.5719},
    {"latitude": 46.7806, "longitude": 23.6228},
    {"latitude": 46.7667, "longitude": 23.5905},
    {"latitude": 46.7585, "longitude": 23.5681},
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
    assert aco_cost <= optimal_cost * 1.05
