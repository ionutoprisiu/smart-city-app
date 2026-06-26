from __future__ import annotations

import pytest

from app.algorithms.nearest_neighbor import nearest_neighbor


def test_rejects_empty_matrix() -> None:
    with pytest.raises(ValueError, match="cannot be empty"):
        nearest_neighbor([])


def test_rejects_single_node_matrix() -> None:
    with pytest.raises(ValueError, match="At least 2 points"):
        nearest_neighbor([[0.0]])


def test_route_is_anchored_at_zero_and_visits_all() -> None:
    matrix = [
        [0.0, 2.0, 9.0, 10.0],
        [2.0, 0.0, 6.0, 4.0],
        [9.0, 6.0, 0.0, 3.0],
        [10.0, 4.0, 3.0, 0.0],
    ]
    route, cost = nearest_neighbor(matrix)
    assert route[0] == 0
    assert sorted(route) == [0, 1, 2, 3]
    assert cost > 0


def test_greedy_picks_closest_next() -> None:
    matrix = [
        [0.0, 1.0, 5.0],
        [1.0, 0.0, 1.0],
        [5.0, 1.0, 0.0],
    ]
    route, cost = nearest_neighbor(matrix)
    assert route == [0, 1, 2]
    assert cost == pytest.approx(2.0)
