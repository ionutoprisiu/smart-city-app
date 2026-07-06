from __future__ import annotations

import pytest

from app.algorithms.two_opt import two_opt
from app.common.distance import calculate_route_cost
from app.algorithms.nearest_neighbor import nearest_neighbor


def test_rejects_empty_matrix() -> None:
    with pytest.raises(ValueError, match="cannot be empty"):
        two_opt([])


def test_route_is_anchored_at_zero_and_visits_all() -> None:
    matrix = [
        [0.0, 2.0, 9.0, 10.0],
        [2.0, 0.0, 6.0, 4.0],
        [9.0, 6.0, 0.0, 3.0],
        [10.0, 4.0, 3.0, 0.0],
    ]
    route, _ = two_opt(matrix)
    assert route[0] == 0
    assert sorted(route) == [0, 1, 2, 3]


def test_never_worsens_the_starting_route() -> None:
    # 2-opt must return a route no worse than the nearest-neighbour start.
    matrix = [
        [0.0, 2.0, 9.0, 10.0, 7.0],
        [2.0, 0.0, 6.0, 4.0, 3.0],
        [9.0, 6.0, 0.0, 3.0, 8.0],
        [10.0, 4.0, 3.0, 0.0, 5.0],
        [7.0, 3.0, 8.0, 5.0, 0.0],
    ]
    _, nn_cost = nearest_neighbor(matrix)
    _, refined_cost = two_opt(matrix)
    assert refined_cost <= nn_cost + 1e-9


def test_uncrosses_a_known_bad_route() -> None:
    # Four points on a line (0-1-2-3). The crossing tour 0->2->1->3 is worse than
    # the straight 0->1->2->3; 2-opt should reverse the middle and fix it.
    matrix = [
        [0.0, 1.0, 2.0, 3.0],
        [1.0, 0.0, 1.0, 2.0],
        [2.0, 1.0, 0.0, 1.0],
        [3.0, 2.0, 1.0, 0.0],
    ]
    route, cost = two_opt(matrix, initial_route=[0, 2, 1, 3])
    assert route == [0, 1, 2, 3]
    assert cost == pytest.approx(calculate_route_cost([0, 1, 2, 3], matrix))
