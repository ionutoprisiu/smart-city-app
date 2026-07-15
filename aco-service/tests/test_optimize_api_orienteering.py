from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

# All tests run the Haversine fallback (useOsrm=False) so travel minutes are a
# pure function of coordinates and the configured walking speed (4 km/h).
# Attraction 1 sits ~150 m from the UTCN anchor (a couple of minutes on foot);
# attraction 2 is ~15 km away (hours of walking) — a clear keep/skip contrast.
NEAR = {"id": 1, "latitude": 46.7735, "longitude": 23.5865, "score": 5.0, "visitDurationMinutes": 10.0}
FAR = {"id": 2, "latitude": 46.90, "longitude": 23.80, "score": 9.0, "visitDurationMinutes": 10.0}


def _op_body(budget: float, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "attractions": [NEAR, FAR],
        "useOsrm": False,
        "routingProfile": "foot",
        "timeBudgetMinutes": budget,
    }
    body.update(overrides)
    return body


def test_tight_budget_keeps_the_near_attraction_and_skips_the_far_one(
    client: TestClient,
) -> None:
    r = client.post("/optimize", json=_op_body(30.0))
    assert r.status_code == 200
    data = r.json()
    assert [s["attractionId"] for s in data["steps"]] == [0, 1]
    assert data["skippedAttractionIds"] == [2]
    assert data["collectedScore"] == 5.0
    assert data["timeBudgetMinutes"] == 30.0
    assert data["visitTimeMinutes"] == 10
    assert data["steps"][1]["estimatedVisitTime"] == 10
    assert data["totalTime"] <= 30


def test_generous_budget_visits_everything(client: TestClient) -> None:
    r = client.post("/optimize", json=_op_body(1440.0))
    assert r.status_code == 200
    data = r.json()
    assert {s["attractionId"] for s in data["steps"]} == {0, 1, 2}
    assert data["skippedAttractionIds"] == []
    assert data["collectedScore"] == 14.0
    assert data["visitTimeMinutes"] == 20


def test_budget_too_small_returns_start_only(client: TestClient) -> None:
    # One minute is not even enough to walk to the nearest attraction and visit it.
    r = client.post("/optimize", json=_op_body(1.0))
    assert r.status_code == 200
    data = r.json()
    assert [s["attractionId"] for s in data["steps"]] == [0]
    assert sorted(data["skippedAttractionIds"]) == [1, 2]
    assert data["collectedScore"] == 0.0
    assert data["totalTime"] == 0


def test_invalid_budget_is_rejected(client: TestClient) -> None:
    for bad in (0, -30, 100000):
        r = client.post("/optimize", json=_op_body(bad))
        assert r.status_code == 422


def test_classic_request_visits_everything_but_still_counts_visit_time(
    client: TestClient,
) -> None:
    # No budget -> visit everything; the OP selection extras stay neutral, but
    # the provided visit durations still count toward the reported total (a tour
    # opened with "no limit" honestly includes the time spent at each stop).
    body = _op_body(30.0)
    del body["timeBudgetMinutes"]
    r = client.post("/optimize", json=body)
    assert r.status_code == 200
    data = r.json()
    assert {s["attractionId"] for s in data["steps"]} == {0, 1, 2}
    assert data["collectedScore"] is None
    assert data["skippedAttractionIds"] == []
    assert data["timeBudgetMinutes"] is None
    assert data["visitTimeMinutes"] == 20  # 10' + 10', both attractions visited
    assert data["totalTime"] == data["travelTimeMinutes"] + 20
