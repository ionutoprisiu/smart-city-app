"""Unit tests for OSRM response parsing and profile normalization."""

from __future__ import annotations

import pytest

from app.common.distance import MISSING_EDGE_KM, MISSING_EDGE_SEC
from app.integrations import osrm_client


def test_normalize_profile_defaults_and_maps() -> None:
    assert osrm_client.normalize_profile("driving") == "driving"
    assert osrm_client.normalize_profile("FOOT") == "foot"
    assert osrm_client.normalize_profile("unknown") == "driving"


def test_table_matrices_ok_converts_meters_to_km() -> None:
    points = [{"id": 0}, {"id": 1}]
    data = {
        "code": "Ok",
        "distances": [[0, 5000], [5000, 0]],
        "durations": [[0, 300], [400, 0]],
    }
    out = osrm_client._table_matrices_from_json(points, data)
    assert out is not None
    dist_m, dur_s = out
    assert dist_m[0][1] == pytest.approx(5.0)
    assert dist_m[1][0] == pytest.approx(5.0)
    assert dur_s[0][1] == 300.0
    assert dur_s[1][0] == 400.0


def test_table_matrices_not_ok_returns_none() -> None:
    points = [{"id": 0}, {"id": 1}]
    assert osrm_client._table_matrices_from_json(points, {"code": "NoRoute"}) is None


def test_table_matrices_null_distance_uses_sentinel() -> None:
    points = [{"id": 0}, {"id": 1}]
    data = {
        "code": "Ok",
        "distances": [[0, None], [1000, 0]],
        "durations": [[0, 60], [60, 0]],
    }
    out = osrm_client._table_matrices_from_json(points, data)
    assert out is not None
    dist_m, _dur = out
    assert dist_m[0][1] == MISSING_EDGE_KM


def test_table_matrices_missing_duration_column_uses_sentinel() -> None:
    points = [{"id": 0}, {"id": 1}]
    data = {"code": "Ok", "distances": [[0, 1000], [1000, 0]]}
    out = osrm_client._table_matrices_from_json(points, data)
    assert out is not None
    _dist_m, dur_s = out
    assert dur_s[0][1] == MISSING_EDGE_SEC
