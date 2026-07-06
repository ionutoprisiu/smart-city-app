from __future__ import annotations

import pytest

from app.algorithms.orienteering import (
    OrienteeringACO,
    brute_force_orienteering,
    collected_score,
    greedy_orienteering,
    route_time,
)

# Symmetric 4-point instance built as a trap for the greedy ratio rule: node 1
# looks like the best deal from the start (score 5 for 1 time unit), but taking
# it strands the tourist — the cluster {2, 3} together is worth 8 and fits the
# budget only if chosen from the beginning.
TRAP_MATRIX = [
    [0.0, 1.0, 2.0, 2.0],
    [1.0, 0.0, 5.0, 5.0],
    [2.0, 5.0, 0.0, 0.5],
    [2.0, 5.0, 0.5, 0.0],
]
TRAP_SCORES = [0.0, 5.0, 4.0, 4.0]
TRAP_BUDGET = 3.0


def test_rejects_empty_matrix() -> None:
    with pytest.raises(ValueError, match="cannot be empty"):
        greedy_orienteering([], [], 10.0)


def test_rejects_mismatched_scores() -> None:
    matrix = [[0.0, 1.0], [1.0, 0.0]]
    with pytest.raises(ValueError, match="one entry per point"):
        brute_force_orienteering(matrix, [0.0], 10.0)


def test_rejects_nonpositive_budget() -> None:
    matrix = [[0.0, 1.0], [1.0, 0.0]]
    with pytest.raises(ValueError, match="budget must be positive"):
        OrienteeringACO(matrix, [0.0, 1.0], 0.0)


def test_too_small_budget_yields_empty_route() -> None:
    matrix = [[0.0, 10.0], [10.0, 0.0]]
    scores = [0.0, 7.0]
    for solver in (greedy_orienteering, brute_force_orienteering):
        route, score = solver(matrix, scores, 5.0)
        assert route == [0]
        assert score == 0.0
    route, score = OrienteeringACO(matrix, scores, 5.0, seed=0).optimize()
    assert route == [0]
    assert score == 0.0


def test_generous_budget_visits_everything() -> None:
    # With time to spare, the OP degenerates into "collect all prizes".
    route, score = OrienteeringACO(
        TRAP_MATRIX, TRAP_SCORES, budget=100.0, seed=0
    ).optimize()
    assert sorted(route) == [0, 1, 2, 3]
    assert score == pytest.approx(sum(TRAP_SCORES))


def test_routes_respect_the_budget() -> None:
    for seed in range(5):
        optimizer = OrienteeringACO(TRAP_MATRIX, TRAP_SCORES, TRAP_BUDGET, seed=seed)
        route, _ = optimizer.optimize()
        assert route_time(route, TRAP_MATRIX) <= TRAP_BUDGET + 1e-9
    route, _ = greedy_orienteering(TRAP_MATRIX, TRAP_SCORES, TRAP_BUDGET)
    assert route_time(route, TRAP_MATRIX) <= TRAP_BUDGET + 1e-9


def test_exact_search_escapes_the_greedy_trap() -> None:
    greedy_route, greedy_score = greedy_orienteering(TRAP_MATRIX, TRAP_SCORES, TRAP_BUDGET)
    exact_route, exact_score = brute_force_orienteering(TRAP_MATRIX, TRAP_SCORES, TRAP_BUDGET)
    assert greedy_route == [0, 1]  # lured by the high-ratio dead end
    assert greedy_score == pytest.approx(5.0)
    assert sorted(exact_route) == [0, 2, 3]  # the cluster is worth more
    assert exact_score == pytest.approx(8.0)


def test_aco_matches_the_exact_optimum_on_the_trap() -> None:
    _, exact_score = brute_force_orienteering(TRAP_MATRIX, TRAP_SCORES, TRAP_BUDGET)
    _, aco_score = OrienteeringACO(TRAP_MATRIX, TRAP_SCORES, TRAP_BUDGET, seed=0).optimize()
    assert aco_score == pytest.approx(exact_score)


def test_same_seed_reproduces_the_result() -> None:
    first = OrienteeringACO(TRAP_MATRIX, TRAP_SCORES, TRAP_BUDGET, seed=42).optimize()
    second = OrienteeringACO(TRAP_MATRIX, TRAP_SCORES, TRAP_BUDGET, seed=42).optimize()
    assert first == second


def test_service_times_shrink_what_fits() -> None:
    # Without visit durations both attractions fit; long visits leave room for one.
    matrix = [
        [0.0, 1.0, 1.0],
        [1.0, 0.0, 1.0],
        [1.0, 1.0, 0.0],
    ]
    scores = [0.0, 6.0, 5.0]
    no_service, _ = brute_force_orienteering(matrix, scores, budget=3.0)
    assert sorted(no_service) == [0, 1, 2]
    with_service, score = brute_force_orienteering(
        matrix, scores, budget=3.0, service_times=[0.0, 1.5, 1.5]
    )
    assert with_service == [0, 1]  # only the higher-prize visit fits now
    assert score == pytest.approx(6.0)


def test_route_time_includes_service() -> None:
    matrix = [[0.0, 2.0], [2.0, 0.0]]
    assert route_time([0, 1], matrix) == pytest.approx(2.0)
    assert route_time([0, 1], matrix, [0.5, 1.0]) == pytest.approx(3.5)


def test_collected_score_ignores_the_anchor() -> None:
    assert collected_score([0, 2, 1], [9.0, 3.0, 4.0]) == pytest.approx(7.0)


def test_exact_search_is_capped() -> None:
    n = 12
    matrix = [[float(i != j) for j in range(n)] for i in range(n)]
    with pytest.raises(ValueError, match="limited to"):
        brute_force_orienteering(matrix, [0.0] * n, 5.0)
