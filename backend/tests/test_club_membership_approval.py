from __future__ import annotations

import importlib
from datetime import UTC, datetime
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
from app.models.club import Club
from app.models.club_membership import ClubMembership
from app.models.enums import Role
from app.models.user import User


def _seed(db: Any) -> dict[str, int]:
    now = datetime.now(UTC)
    admin = User(
        email="club_admin@test.com",
        password=hash_password("x"),
        first_name="Club",
        last_name="Admin",
        role=Role.ORGANIZER.value,
        is_verified=True,
        is_approved=True,
        verification_status="APPROVED",
        created_at=now,
    )
    applicant = User(
        email="applicant@test.com",
        password=hash_password("x"),
        first_name="App",
        last_name="Licant",
        role=Role.USER.value,
        is_verified=True,
        is_approved=True,
        verification_status="APPROVED",
        created_at=now,
    )
    stranger = User(
        email="stranger@test.com",
        password=hash_password("x"),
        first_name="Str",
        last_name="Anger",
        role=Role.USER.value,
        is_verified=True,
        is_approved=True,
        verification_status="APPROVED",
        created_at=now,
    )
    db.add_all([admin, applicant, stranger])
    db.flush()

    club = Club(
        name="Approval Club",
        description=None,
        category="OTHER",
        city="Cluj-Napoca",
        visibility="APPROVAL_REQUIRED",
        status="ACTIVE",
        created_by=admin.id,
        created_at=now,
    )
    db.add(club)
    db.flush()
    db.add(
        ClubMembership(
            club_id=club.id,
            user_id=admin.id,
            role="CLUB_ADMIN",
            status="APPROVED",
        )
    )
    pending = ClubMembership(
        club_id=club.id,
        user_id=applicant.id,
        role="MEMBER",
        status="PENDING",
    )
    db.add(pending)
    db.commit()
    return {
        "club_id": club.id,
        "admin_id": admin.id,
        "applicant_id": applicant.id,
        "stranger_id": stranger.id,
        "membership_id": pending.id,
    }


@pytest.fixture
def api_client():
    importlib.import_module("app.models")

    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    sess = Session()
    ids = _seed(sess)

    def override_get_db():
        try:
            yield sess
        finally:
            pass

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as client:
        yield client, ids
    fastapi_app.dependency_overrides.clear()
    sess.close()
    Base.metadata.drop_all(engine)


def _auth(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def test_list_pending_as_club_admin(api_client: tuple[TestClient, dict[str, int]]) -> None:
    client, ids = api_client
    res = client.get(
        f"/api/activities/clubs/{ids['club_id']}/memberships/pending",
        headers=_auth(ids["admin_id"]),
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]["membershipId"] == ids["membership_id"]
    assert data[0]["userEmail"] == "applicant@test.com"


def test_list_pending_forbidden_for_non_admin(api_client: tuple[TestClient, dict[str, int]]) -> None:
    client, ids = api_client
    res = client.get(
        f"/api/activities/clubs/{ids['club_id']}/memberships/pending",
        headers=_auth(ids["stranger_id"]),
    )
    assert res.status_code == 403


def test_approve_membership(api_client: tuple[TestClient, dict[str, int]]) -> None:
    client, ids = api_client
    res = client.post(
        f"/api/activities/clubs/{ids['club_id']}/memberships/{ids['membership_id']}/approve",
        headers=_auth(ids["admin_id"]),
    )
    assert res.status_code == 200

    pending = client.get(
        f"/api/activities/clubs/{ids['club_id']}/memberships/pending",
        headers=_auth(ids["admin_id"]),
    )
    assert pending.json() == []

    applicant_clubs = client.get(
        "/api/activities/clubs/mine",
        headers=_auth(ids["applicant_id"]),
    )
    assert applicant_clubs.status_code == 200
    assert len(applicant_clubs.json()) == 1
    assert applicant_clubs.json()[0]["membershipStatus"] == "APPROVED"


def test_reject_membership(api_client: tuple[TestClient, dict[str, int]]) -> None:
    client, ids = api_client
    res = client.post(
        f"/api/activities/clubs/{ids['club_id']}/memberships/{ids['membership_id']}/reject",
        headers=_auth(ids["admin_id"]),
    )
    assert res.status_code == 200

    mine = client.get(
        "/api/activities/clubs/mine",
        headers=_auth(ids["applicant_id"]),
    )
    assert mine.json() == []
