from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.common.exceptions import ValidationAppError
from app.schemas.tours import TourCreateRequest
from app.services.tours_service import _validate_durations


def _register(client: TestClient) -> str:
    suffix = uuid.uuid4().hex[:12]
    resp = client.post(
        "/api/auth/register",
        json={
            "email": f"tours_{suffix}@example.com",
            "password": "password123",
            "firstName": "Tours",
            "lastName": "Tester",
        },
    )
    assert resp.status_code == 201
    return resp.json()["accessToken"]


def test_list_tours_requires_authentication(client: TestClient) -> None:
    resp = client.get("/api/tours")
    assert resp.status_code == 401


def test_list_tours_returns_a_list_for_authenticated_users(client: TestClient) -> None:
    token = _register(client)
    resp = client.get("/api/tours", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_tour_requires_authentication(client: TestClient) -> None:
    resp = client.post("/api/tours", json={"title": "x", "attractionIds": [1]})
    assert resp.status_code == 401


def test_regular_user_cannot_create_a_tour(client: TestClient) -> None:
    # A freshly registered USER is not a verified guide, so tour creation is forbidden.
    token = _register(client)
    resp = client.post(
        "/api/tours",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Turul meu", "routingProfile": "foot", "attractionIds": [1]},
    )
    assert resp.status_code == 403


def test_create_tour_rejects_empty_attractions(client: TestClient) -> None:
    token = _register(client)
    resp = client.post(
        "/api/tours",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "Gol", "attractionIds": []},
    )
    assert resp.status_code == 422  # blocked by schema validation before the service


def test_optimize_requires_authentication(client: TestClient) -> None:
    resp = client.post("/api/tours/1/optimize", json={"timeBudgetMinutes": 120})
    assert resp.status_code == 401


def test_optimize_rejects_invalid_budget(client: TestClient) -> None:
    # Schema validation fires before the tour lookup, so any id works here.
    token = _register(client)
    for bad in (0, -30, 100000):
        resp = client.post(
            "/api/tours/1/optimize",
            headers={"Authorization": f"Bearer {token}"},
            json={"timeBudgetMinutes": bad},
        )
        assert resp.status_code == 422


def test_optimize_missing_tour_returns_404(client: TestClient) -> None:
    token = _register(client)
    resp = client.post(
        "/api/tours/999999/optimize",
        headers={"Authorization": f"Bearer {token}"},
        json={"timeBudgetMinutes": 120},
    )
    assert resp.status_code == 404


def test_durations_must_match_attractions() -> None:
    req = TourCreateRequest(
        title="T", attractionIds=[1, 2, 3], visitDurationsMinutes=[10.0, 20.0]
    )
    with pytest.raises(ValidationAppError, match="one entry per attraction"):
        _validate_durations(req)


def test_durations_out_of_range_are_rejected() -> None:
    req = TourCreateRequest(
        title="T", attractionIds=[1, 2], visitDurationsMinutes=[10.0, 700.0]
    )
    with pytest.raises(ValidationAppError, match="between 0 and 600"):
        _validate_durations(req)


def test_durations_map_first_occurrence_wins() -> None:
    # Duplicated attraction ids keep the first duration (ids are deduped downstream).
    req = TourCreateRequest(
        title="T", attractionIds=[7, 7, 9], visitDurationsMinutes=[30.0, 45.0, 20.0]
    )
    assert _validate_durations(req) == {7: 30.0, 9: 20.0}


def test_no_durations_yields_empty_map() -> None:
    req = TourCreateRequest(title="T", attractionIds=[1, 2])
    assert _validate_durations(req) == {}
