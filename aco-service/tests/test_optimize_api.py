"""HTTP tests for ``POST /optimize`` with OSRM integration mocked."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient


def _body_start_and_one_attraction() -> dict[str, Any]:
    return {
        "attractions": [{"id": 101, "latitude": 46.78, "longitude": 23.60}],
        "startLatitude": 46.77,
        "startLongitude": 23.59,
        "useOsrm": True,
        "routingProfile": "driving",
    }


@pytest.fixture
def mock_osrm_single_leg(monkeypatch: pytest.MonkeyPatch) -> None:
    """Deterministic matrices + segment for start + one attraction (no ACO randomness)."""

    async def fetch_matrices(
        points: list[dict], profile: str
    ) -> tuple[list[list[float]] | None, list[list[float]] | None]:
        assert len(points) == 2
        assert profile == "driving"
        dist = [[0.0, 2.5], [2.5, 0.0]]
        dur = [[0.0, 600.0], [600.0, 0.0]]
        return dist, dur

    async def fetch_route_segments(
        ordered_points: list[dict], profile: str
    ) -> tuple[list[list[dict]], list[float]]:
        assert len(ordered_points) == 2
        assert profile == "driving"
        a, b = ordered_points[0], ordered_points[1]
        seg = [
            {"latitude": a["latitude"], "longitude": a["longitude"]},
            {"latitude": b["latitude"], "longitude": b["longitude"]},
        ]
        return [seg], [600.0]

    monkeypatch.setattr("app.integrations.osrm_client.fetch_matrices", fetch_matrices)
    monkeypatch.setattr("app.integrations.osrm_client.fetch_route_segments", fetch_route_segments)


def test_optimize_single_attraction_with_osrm_mock(
    client: TestClient, mock_osrm_single_leg: None
) -> None:
    r = client.post("/optimize", json=_body_start_and_one_attraction())
    assert r.status_code == 200
    data = r.json()
    assert data["usedOsrm"] is True
    assert data["routingProfile"] == "driving"
    assert len(data["steps"]) == 2
    assert data["steps"][0]["attractionId"] == 0
    assert data["steps"][1]["attractionId"] == 101
    assert data["steps"][0]["distanceToNext"] == pytest.approx(2.5)
    assert data["steps"][1]["distanceToNext"] is None
    assert data["totalDistance"] == pytest.approx(2.5)
    assert data["travelTimeMinutes"] >= 1


def test_optimize_haversine_no_osrm_three_points(client: TestClient) -> None:
    body = {
        "attractions": [
            {"id": 1, "latitude": 46.77, "longitude": 23.59},
            {"id": 2, "latitude": 46.78, "longitude": 23.60},
        ],
        "startLatitude": 46.76,
        "startLongitude": 23.58,
        "useOsrm": False,
        "routingProfile": "foot",
    }
    r = client.post("/optimize", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["usedOsrm"] is False
    assert data["routingProfile"] == "foot"
    assert len(data["steps"]) == 3
    assert {s["attractionId"] for s in data["steps"]} == {0, 1, 2}
    assert data["totalDistance"] > 0


def test_optimize_invalid_body_too_few_points(client: TestClient) -> None:
    r = client.post(
        "/optimize",
        json={
            "attractions": [{"id": 1, "latitude": 46.77, "longitude": 23.59}],
            "useOsrm": False,
        },
    )
    assert r.status_code == 422


def test_optimize_invalid_routing_profile(client: TestClient) -> None:
    r = client.post(
        "/optimize",
        json={
            "attractions": [
                {"id": 1, "latitude": 46.77, "longitude": 23.59},
                {"id": 2, "latitude": 46.78, "longitude": 23.60},
            ],
            "useOsrm": False,
            "routingProfile": "cycling",
        },
    )
    assert r.status_code == 422


def test_optimize_use_osrm_true_but_table_fails_falls_back_to_haversine(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    segment_calls: list[str] = []

    async def fetch_matrices(
        _points: list[dict], _profile: str
    ) -> tuple[list[list[float]] | None, list[list[float]] | None]:
        return None, None

    async def fetch_route_segments(_ordered: list[dict], _profile: str) -> tuple[list[list[dict]], list[float]]:
        segment_calls.append("called")
        raise AssertionError("segments must not run when OSRM matrices are unavailable")

    monkeypatch.setattr("app.integrations.osrm_client.fetch_matrices", fetch_matrices)
    monkeypatch.setattr("app.integrations.osrm_client.fetch_route_segments", fetch_route_segments)

    body = {
        "attractions": [
            {"id": 1, "latitude": 46.77, "longitude": 23.59},
            {"id": 2, "latitude": 46.78, "longitude": 23.60},
        ],
        "startLatitude": 46.76,
        "startLongitude": 23.58,
        "useOsrm": True,
        "routingProfile": "driving",
    }
    r = client.post("/optimize", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["usedOsrm"] is False
    assert segment_calls == []


@pytest.fixture
def mock_osrm_single_leg_foot(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fetch_matrices(points: list[dict], profile: str) -> tuple[list[list[float]] | None, list[list[float]] | None]:
        assert profile == "foot"
        assert len(points) == 2
        return [[0.0, 1.2], [1.2, 0.0]], [[0.0, 400.0], [400.0, 0.0]]

    async def fetch_route_segments(ordered_points: list[dict], profile: str) -> tuple[list[list[dict]], list[float]]:
        assert profile == "foot"
        a, b = ordered_points[0], ordered_points[1]
        seg = [
            {"latitude": a["latitude"], "longitude": a["longitude"]},
            {"latitude": b["latitude"], "longitude": b["longitude"]},
        ]
        return [seg], [400.0]

    monkeypatch.setattr("app.integrations.osrm_client.fetch_matrices", fetch_matrices)
    monkeypatch.setattr("app.integrations.osrm_client.fetch_route_segments", fetch_route_segments)


def test_optimize_single_attraction_foot_profile_with_osrm_mock(
    client: TestClient, mock_osrm_single_leg_foot: None
) -> None:
    body = {
        **_body_start_and_one_attraction(),
        "routingProfile": "foot",
    }
    r = client.post("/optimize", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["usedOsrm"] is True
    assert data["routingProfile"] == "foot"
    assert data["totalDistance"] == pytest.approx(1.2)


def test_optimize_three_points_stub_aco_order_and_osrm_segments(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ACO is stubbed so visit order is deterministic; OSRM matrices + segments are mocked."""

    class StubACO:
        def __init__(self, _cost_matrix: list[list[float]]) -> None:
            pass

        def optimize(self) -> tuple[list[int], float]:
            return [0, 2, 1], 999.0

    async def fetch_matrices(
        points: list[dict], profile: str
    ) -> tuple[list[list[float]] | None, list[list[float]] | None]:
        assert len(points) == 3
        assert profile == "driving"
        dist_km = [
            [0.0, 10.0, 1.0],
            [10.0, 0.0, 10.0],
            [1.0, 10.0, 0.0],
        ]
        dur_s = [
            [0.0, 600.0, 60.0],
            [600.0, 0.0, 600.0],
            [60.0, 600.0, 0.0],
        ]
        return dist_km, dur_s

    async def fetch_route_segments(
        ordered_points: list[dict], profile: str
    ) -> tuple[list[list[dict]], list[float]]:
        assert profile == "driving"
        assert [p["id"] for p in ordered_points] == [0, 2, 1]
        segs: list[list[dict]] = []
        durs: list[float] = []
        for a, b in zip(ordered_points, ordered_points[1:], strict=False):
            segs.append(
                [
                    {"latitude": a["latitude"], "longitude": a["longitude"]},
                    {"latitude": b["latitude"], "longitude": b["longitude"]},
                ]
            )
            durs.append(120.0)
        return segs, durs

    monkeypatch.setattr("app.services.route_service.ACOOptimizer", StubACO)
    monkeypatch.setattr("app.integrations.osrm_client.fetch_matrices", fetch_matrices)
    monkeypatch.setattr("app.integrations.osrm_client.fetch_route_segments", fetch_route_segments)

    body = {
        "attractions": [
            {"id": 1, "latitude": 46.77, "longitude": 23.59},
            {"id": 2, "latitude": 46.79, "longitude": 23.61},
        ],
        "startLatitude": 46.76,
        "startLongitude": 23.58,
        "useOsrm": True,
        "routingProfile": "driving",
    }
    r = client.post("/optimize", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["usedOsrm"] is True
    assert [s["attractionId"] for s in data["steps"]] == [0, 2, 1]
    assert data["totalDistance"] == pytest.approx(11.0)


def test_optimize_value_error_returns_400(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def bad_value(_request: Any) -> Any:
        raise ValueError("simulated business validation")

    monkeypatch.setattr("app.services.route_service.optimize", bad_value)
    r = client.post("/optimize", json=_body_start_and_one_attraction())
    assert r.status_code == 400
    assert "simulated business validation" in r.json().get("detail", "")


def test_optimize_internal_error_returns_500(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def boom(_request: Any) -> Any:
        raise RuntimeError("simulated internal failure")

    monkeypatch.setattr("app.services.route_service.optimize", boom)
    r = client.post("/optimize", json=_body_start_and_one_attraction())
    assert r.status_code == 500
    assert "simulated internal failure" in r.json().get("detail", "")
