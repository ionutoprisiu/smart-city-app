from __future__ import annotations

from datetime import datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.main import app as fastapi_app
from app.models.enums import Role, VerificationStatus
from app.models.user import User


def _seed(db: Any) -> dict[str, int]:
    now = datetime.now()
    admin = User(
        email="admin@test.com",
        password=hash_password("secret"),
        first_name="Admin",
        last_name="User",
        role=Role.ADMIN.value,
        is_verified=True,
        is_approved=True,
        verification_status=VerificationStatus.APPROVED.value,
        created_at=now,
    )
    verified_user = User(
        email="verified@test.com",
        password=hash_password("secret"),
        first_name="Verified",
        last_name="User",
        role=Role.USER.value,
        is_verified=True,
        is_approved=True,
        verification_status=VerificationStatus.APPROVED.value,
        created_at=now,
    )
    organizer = User(
        email="organizer@test.com",
        password=hash_password("secret"),
        first_name="Organizer",
        last_name="User",
        role=Role.GUIDE.value,
        is_verified=True,
        is_approved=True,
        verification_status=VerificationStatus.APPROVED.value,
        created_at=now,
    )
    db.add_all([admin, verified_user, organizer])
    db.commit()
    db.refresh(admin)
    db.refresh(verified_user)
    db.refresh(organizer)
    return {
        "admin_id": admin.id,
        "verified_user_id": verified_user.id,
        "organizer_id": organizer.id,
    }


@pytest.fixture()
def client() -> TestClient:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as test_client:
        db = TestingSessionLocal()
        ids = _seed(db)
        db.close()
        test_client.ids = ids  # type: ignore[attr-defined]
        yield test_client
    fastapi_app.dependency_overrides.clear()


def _auth_header(user_id: int) -> dict[str, str]:
    token = create_access_token(user_id)
    return {"Authorization": f"Bearer {token}"}


def test_admin_promotes_verified_user(client: TestClient) -> None:
    admin_id = client.ids["admin_id"]  # type: ignore[attr-defined]
    user_id = client.ids["verified_user_id"]  # type: ignore[attr-defined]
    headers = _auth_header(admin_id)

    response = client.post(f"/api/admin/users/{user_id}/promote-guide", headers=headers)
    assert response.status_code == 200
    assert response.json()["role"] == "GUIDE"


def test_admin_demotes_organizer_to_user(client: TestClient) -> None:
    admin_id = client.ids["admin_id"]  # type: ignore[attr-defined]
    organizer_id = client.ids["organizer_id"]  # type: ignore[attr-defined]
    headers = _auth_header(admin_id)

    response = client.post(f"/api/admin/users/{organizer_id}/demote-user", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "USER"
    assert body["isVerified"] is False
    assert body["verificationStatus"] == "NOT_SUBMITTED"


def test_cannot_promote_after_demote_without_reverification(client: TestClient) -> None:
    admin_id = client.ids["admin_id"]  # type: ignore[attr-defined]
    organizer_id = client.ids["organizer_id"]  # type: ignore[attr-defined]
    headers = _auth_header(admin_id)

    demote = client.post(f"/api/admin/users/{organizer_id}/demote-user", headers=headers)
    assert demote.status_code == 200

    promote = client.post(f"/api/admin/users/{organizer_id}/promote-guide", headers=headers)
    assert promote.status_code == 400


def test_demoted_organizer_can_resubmit_verification(client: TestClient) -> None:
    admin_id = client.ids["admin_id"]  # type: ignore[attr-defined]
    organizer_id = client.ids["organizer_id"]  # type: ignore[attr-defined]
    admin_headers = _auth_header(admin_id)

    demote = client.post(f"/api/admin/users/{organizer_id}/demote-user", headers=admin_headers)
    assert demote.status_code == 200

    from app.api.deps import get_current_user_id

    fastapi_app.dependency_overrides[get_current_user_id] = lambda: organizer_id
    try:
        status = client.get("/api/verification/status")
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user_id, None)

    assert status.status_code == 200
    body = status.json()
    assert body["role"] == "USER"
    assert body["isVerified"] is False
    assert body["status"] == "NOT_SUBMITTED"
    assert body["canSubmit"] is True
    assert body["canAccessGuideFlow"] is True


def test_demote_rejects_regular_user(client: TestClient) -> None:
    admin_id = client.ids["admin_id"]  # type: ignore[attr-defined]
    user_id = client.ids["verified_user_id"]  # type: ignore[attr-defined]
    headers = _auth_header(admin_id)

    response = client.post(f"/api/admin/users/{user_id}/demote-user", headers=headers)
    assert response.status_code == 400


def test_admin_resets_user_verification(client: TestClient) -> None:
    admin_id = client.ids["admin_id"]  # type: ignore[attr-defined]
    user_id = client.ids["verified_user_id"]  # type: ignore[attr-defined]
    headers = _auth_header(admin_id)

    response = client.post(f"/api/admin/users/{user_id}/reset-verification", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["verificationStatus"] == "NOT_SUBMITTED"
    assert body["isVerified"] is False

    promote = client.post(f"/api/admin/users/{user_id}/promote-guide", headers=headers)
    assert promote.status_code == 400


def test_admin_updates_user(client: TestClient) -> None:
    admin_id = client.ids["admin_id"]  # type: ignore[attr-defined]
    user_id = client.ids["verified_user_id"]  # type: ignore[attr-defined]
    headers = _auth_header(admin_id)

    response = client.patch(
        f"/api/admin/users/{user_id}",
        headers=headers,
        json={
            "firstName": "Updated",
            "lastName": "Person",
            "email": "updated@test.com",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["firstName"] == "Updated"
    assert body["lastName"] == "Person"
    assert body["email"] == "updated@test.com"


def test_admin_deletes_user(client: TestClient) -> None:
    admin_id = client.ids["admin_id"]  # type: ignore[attr-defined]
    user_id = client.ids["verified_user_id"]  # type: ignore[attr-defined]
    headers = _auth_header(admin_id)

    response = client.delete(f"/api/admin/users/{user_id}", headers=headers)
    assert response.status_code == 204

    listing = client.get("/api/admin/users", headers=headers)
    assert listing.status_code == 200
    ids = [item["userId"] for item in listing.json()["items"]]
    assert user_id not in ids


def test_cannot_delete_admin_user(client: TestClient) -> None:
    admin_id = client.ids["admin_id"]  # type: ignore[attr-defined]
    headers = _auth_header(admin_id)

    response = client.delete(f"/api/admin/users/{admin_id}", headers=headers)
    assert response.status_code == 400
