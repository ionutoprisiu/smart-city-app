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
from app.services import verification_storage


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
    pending = User(
        email="pending@test.com",
        password=hash_password("secret"),
        first_name="Pending",
        last_name="User",
        role=Role.USER.value,
        is_verified=False,
        is_approved=False,
        verification_status=VerificationStatus.MANUAL_REVIEW.value,
        verification_score=0.55,
        verification_reason="Low face match score",
        created_at=now,
    )
    db.add_all([admin, pending])
    db.commit()
    db.refresh(admin)
    db.refresh(pending)
    return {"admin_id": admin.id, "pending_id": pending.id}


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


def test_non_admin_cannot_list_pending(client: TestClient) -> None:
    pending_id = client.ids["pending_id"]  # type: ignore[attr-defined]
    response = client.get("/api/admin/verifications/pending", headers=_auth_header(pending_id))
    assert response.status_code == 403


def test_admin_lists_all_verification_sections(client: TestClient) -> None:
    admin_id = client.ids["admin_id"]  # type: ignore[attr-defined]
    response = client.get("/api/admin/verifications", headers=_auth_header(admin_id))
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["verificationStatus"] == "MANUAL_REVIEW"


def test_admin_lists_pending_verifications(client: TestClient) -> None:
    admin_id = client.ids["admin_id"]  # type: ignore[attr-defined]
    response = client.get("/api/admin/verifications/pending", headers=_auth_header(admin_id))
    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["email"] == "pending@test.com"
    assert items[0]["verificationStatus"] == "MANUAL_REVIEW"


def test_admin_approves_and_rejects(client: TestClient) -> None:
    admin_id = client.ids["admin_id"]  # type: ignore[attr-defined]
    pending_id = client.ids["pending_id"]  # type: ignore[attr-defined]
    headers = _auth_header(admin_id)

    approve = client.post(f"/api/admin/verifications/{pending_id}/approve", headers=headers)
    assert approve.status_code == 200
    assert approve.json()["verificationStatus"] == "APPROVED"
    assert approve.json()["verificationReason"] == "Aprobat de administrator"

    empty = client.get("/api/admin/verifications/pending", headers=headers)
    assert empty.json()["items"] == []


def test_admin_rejects_with_reason(client: TestClient) -> None:
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
        headers = _auth_header(ids["admin_id"])
        verification_storage.save_verification_images(
            ids["pending_id"], b"fake-id-card", b"fake-selfie"
        )
        reject = test_client.post(
            f"/api/admin/verifications/{ids['pending_id']}/reject",
            headers=headers,
            json={"reason": "ID photo unreadable"},
        )
        assert reject.status_code == 200
        body = reject.json()
        # Respingerea șterge complet cererea: stare resetată, documente șterse,
        # utilizatorul poate depune una nouă de la zero.
        assert body["verificationStatus"] == "NOT_SUBMITTED"
        assert body["verificationReason"] == "ID photo unreadable"
        assert verification_storage.id_card_path(ids["pending_id"]) is None
        assert verification_storage.selfie_path(ids["pending_id"]) is None
        assert body["idCardImageUrl"] is None
        assert body["faceImageUrl"] is None
        # Cererea respinsă nu mai apare în coada de moderare.
        listing = test_client.get("/api/admin/verifications", headers=headers)
        assert listing.status_code == 200
        listed_ids = [item["userId"] for item in listing.json()["items"]]
        assert ids["pending_id"] not in listed_ids
    fastapi_app.dependency_overrides.clear()


def test_rejected_user_can_resubmit_directly(client: TestClient) -> None:
    # After a rejection there is no admin unlock step anymore: the user may
    # simply upload new documents right away.
    admin_id = client.ids["admin_id"]  # type: ignore[attr-defined]
    pending_id = client.ids["pending_id"]  # type: ignore[attr-defined]
    headers = _auth_header(admin_id)

    reject = client.post(
        f"/api/admin/verifications/{pending_id}/reject",
        headers=headers,
        json={"reason": "Try again with better lighting"},
    )
    assert reject.status_code == 200
    assert reject.json()["verificationStatus"] == "NOT_SUBMITTED"

    status = client.get(
        "/api/verification/status", headers=_auth_header(pending_id)
    )
    assert status.status_code == 200
    body = status.json()
    assert body["canSubmit"] is True
    assert body["submitBlockedReason"] is None
