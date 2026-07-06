from __future__ import annotations

from datetime import datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_current_user_id, get_db
from app.core.security import hash_password
from app.db.base import Base
from app.main import app as fastapi_app
from app.models.enums import Role, VerificationStatus
from app.models.user import User


def _seed_user(db: Session, *, status: VerificationStatus, role: Role = Role.USER) -> int:
    user = User(
        email=f"{status.value.lower()}@test.com",
        password=hash_password("secret"),
        first_name="Test",
        last_name="User",
        role=role.value,
        is_verified=status == VerificationStatus.APPROVED,
        is_approved=status == VerificationStatus.APPROVED,
        verification_status=status.value,
        verification_score=0.562 if status != VerificationStatus.NOT_SUBMITTED else None,
        verification_reason="Approved by admin" if status == VerificationStatus.APPROVED else None,
        created_at=datetime.now(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.id


@pytest.fixture()
def client_factory():
    engines: list[Any] = []

    def _make(*, status: VerificationStatus, role: Role = Role.USER) -> TestClient:
        engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        engines.append(engine)
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        Base.metadata.create_all(bind=engine)

        def override_get_db():
            db = TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        fastapi_app.dependency_overrides[get_db] = override_get_db
        test_client = TestClient(fastapi_app)
        db = TestingSessionLocal()
        user_id = _seed_user(db, status=status, role=role)
        db.close()
        test_client.user_id = user_id  # type: ignore[attr-defined]
        return test_client

    yield _make
    fastapi_app.dependency_overrides.clear()


def _get_status(client: TestClient) -> dict[str, Any]:
    user_id = client.user_id  # type: ignore[attr-defined]
    fastapi_app.dependency_overrides[get_current_user_id] = lambda: user_id
    try:
        response = client.get("/api/verification/status")
    finally:
        fastapi_app.dependency_overrides.pop(get_current_user_id, None)
    assert response.status_code == 200
    return response.json()


def test_get_status_returns_admin_approved_status(client_factory) -> None:
    client = client_factory(status=VerificationStatus.APPROVED)
    body = _get_status(client)
    assert body["status"] == "APPROVED"
    assert body["reason"] == "Approved by admin"
    assert body["score"] == pytest.approx(0.562)
    assert body["role"] == "USER"
    assert body["isVerified"] is True
    assert body["canSubmit"] is False
    assert body["canAccessGuideFlow"] is True
    assert body["submitBlockedReason"] == "Your identity is already verified."


def test_get_status_not_submitted_can_submit(client_factory) -> None:
    client = client_factory(status=VerificationStatus.NOT_SUBMITTED)
    body = _get_status(client)
    assert body["canSubmit"] is True
    assert body["submitBlockedReason"] is None
    assert body["canAccessGuideFlow"] is True


def test_get_status_manual_review_blocks_submit(client_factory) -> None:
    client = client_factory(status=VerificationStatus.MANUAL_REVIEW)
    body = _get_status(client)
    assert body["canSubmit"] is False
    assert "admin review" in body["submitBlockedReason"].lower()


def test_get_status_rejected_blocks_submit(client_factory) -> None:
    client = client_factory(status=VerificationStatus.REJECTED)
    body = _get_status(client)
    assert body["canSubmit"] is False
    assert "locked" in body["submitBlockedReason"].lower()


def test_get_status_organizer_blocks_submit(client_factory) -> None:
    client = client_factory(status=VerificationStatus.APPROVED, role=Role.GUIDE)
    body = _get_status(client)
    assert body["canSubmit"] is False
    assert body["submitBlockedReason"] == "You are already a guide."
