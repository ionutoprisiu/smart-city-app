from __future__ import annotations

from app.common.distance import (
    calculate_distance_matrix,
    calculate_route_cost,
    calculate_route_distance,
    haversine_distance,
)


def test_haversine_zero_distance() -> None:
    assert haversine_distance(46.77, 23.59, 46.77, 23.59) == 0.0


def test_haversine_symmetric() -> None:
    a = haversine_distance(46.77, 23.59, 46.78, 23.60)
    b = haversine_distance(46.78, 23.60, 46.77, 23.59)
    assert abs(a - b) < 1e-9


def test_distance_matrix_is_symmetric_and_zero_diagonal() -> None:
    points = [
        {"latitude": 46.77, "longitude": 23.59},
        {"latitude": 46.78, "longitude": 23.60},
        {"latitude": 46.79, "longitude": 23.61},
    ]
    matrix = calculate_distance_matrix(points)
    n = len(matrix)
    for i in range(n):
        assert matrix[i][i] == 0.0
        for j in range(i + 1, n):
            assert abs(matrix[i][j] - matrix[j][i]) < 1e-9


def test_route_distance_and_cost_sum_edges() -> None:
    matrix = [[0.0, 1.0, 2.0], [1.0, 0.0, 3.0], [2.0, 3.0, 0.0]]
    assert calculate_route_distance([0, 1, 2], matrix) == 1.0 + 3.0
    assert calculate_route_cost([0, 2, 1], matrix) == 2.0 + 3.0
    assert calculate_route_distance([0], matrix) == 0.0
