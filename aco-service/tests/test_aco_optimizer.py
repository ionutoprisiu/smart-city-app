"""Unit tests for ``ACOOptimizer`` constructor guards."""

from __future__ import annotations

import pytest

from app.algorithms.aco import ACOOptimizer


def test_aco_rejects_empty_matrix() -> None:
    with pytest.raises(ValueError, match="cannot be empty"):
        ACOOptimizer([])


def test_aco_rejects_single_node_matrix() -> None:
    with pytest.raises(ValueError, match="At least 2 points"):
        ACOOptimizer([[0.0]])


def test_aco_runs_on_two_by_two_matrix() -> None:
    m = [[0.0, 1.0], [1.0, 0.0]]
    route, cost = ACOOptimizer(m).optimize()
    assert route == [0, 1]
    assert cost == pytest.approx(1.0)
