"""Auth: password hashing and JWT issuance."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password


def test_hash_and_verify_roundtrip() -> None:
    h = hash_password("my-secret-password")
    assert h.startswith("$2")
    assert verify_password("my-secret-password", h) is True
    assert verify_password("wrong", h) is False


def test_jwt_encode_decode_roundtrip() -> None:
    token = create_access_token(42)
    payload = decode_access_token(token)
    assert payload["sub"] == "42"


def test_register_and_login_return_bearer_token(client: TestClient) -> None:
    suffix = uuid.uuid4().hex[:12]
    email = f"jwt_test_{suffix}@example.com"
    reg = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "password123",
            "firstName": "JWT",
            "lastName": "Test",
        },
    )
    assert reg.status_code == 201
    body = reg.json()
    assert body.get("accessToken")
    token = body["accessToken"]

    mine = client.get("/api/activities/clubs/mine", headers={"Authorization": f"Bearer {token}"})
    assert mine.status_code == 200
    assert mine.json() == []

    login = client.post("/api/auth/login", json={"email": email, "password": "password123"})
    assert login.status_code == 200
    assert login.json().get("accessToken")
