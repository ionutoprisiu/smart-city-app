from __future__ import annotations

import importlib
from datetime import UTC, datetime
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.main import app as fastapi_app
from app.models.activity_announcement import ActivityAnnouncement
from app.models.activity_chat_message import ActivityChatMessage
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
        name="Club Admin",
        role=Role.ORGANIZER.value,
        is_verified=True,
        is_approved=True,
        verification_status="APPROVED",
        created_at=now,
    )
    member = User(
        email="member@test.com",
        password=hash_password("x"),
        first_name="Mem",
        last_name="Ber",
        name="Member",
        role=Role.USER.value,
        is_verified=True,
        is_approved=True,
        verification_status="APPROVED",
        created_at=now,
    )
    db.add_all([admin, member])
    db.flush()

    club = Club(
        name="Delete Me Club",
        description=None,
        category="OTHER",
        city="Cluj-Napoca",
        visibility="PUBLIC",
        status="ACTIVE",
        created_by=admin.id,
        created_at=now,
    )
    db.add(club)
    db.flush()
    db.add_all(
        [
            ClubMembership(
                club_id=club.id,
                user_id=admin.id,
                role="CLUB_ADMIN",
                status="APPROVED",
            ),
            ClubMembership(
                club_id=club.id,
                user_id=member.id,
                role="MEMBER",
                status="APPROVED",
            ),
            ActivityAnnouncement(
                title="Notice",
                body="Club update",
                club_id=club.id,
                created_by=admin.id,
                created_at=now,
            ),
        ]
    )
    db.flush()

    parent = ActivityChatMessage(
        club_id=club.id,
        sender_user_id=member.id,
        thread_user_id=member.id,
        role="USER",
        body="How do I join?",
        created_at=now,
    )
    db.add(parent)
    db.flush()
    db.add(
        ActivityChatMessage(
            club_id=club.id,
            sender_user_id=admin.id,
            thread_user_id=member.id,
            role="ORGANIZER",
            body="Auto reply",
            in_reply_to_message_id=parent.id,
            is_auto_reply=True,
            created_at=now,
        )
    )
    db.commit()
    return {
        "club_id": club.id,
        "admin_id": admin.id,
        "member_id": member.id,
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
        yield client, ids, sess
    fastapi_app.dependency_overrides.clear()
    sess.close()
    Base.metadata.drop_all(engine)


def _auth(user_id: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def test_delete_club_purges_memberships_announcements_and_chat(
    api_client: tuple[TestClient, dict[str, int], Any],
) -> None:
    client, ids, sess = api_client
    club_id = ids["club_id"]

    res = client.post(
        f"/api/activities/clubs/{club_id}/delete",
        headers=_auth(ids["admin_id"]),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "DELETED"

    memberships = sess.execute(
        select(func.count()).select_from(ClubMembership).where(ClubMembership.club_id == club_id)
    ).scalar()
    announcements = sess.execute(
        select(func.count())
        .select_from(ActivityAnnouncement)
        .where(ActivityAnnouncement.club_id == club_id)
    ).scalar()
    chat_messages = sess.execute(
        select(func.count())
        .select_from(ActivityChatMessage)
        .where(ActivityChatMessage.club_id == club_id)
    ).scalar()
    assert memberships == 0
    assert announcements == 0
    assert chat_messages == 0

    member_clubs = client.get(
        "/api/activities/clubs/mine",
        headers=_auth(ids["member_id"]),
    )
    assert member_clubs.status_code == 200
    assert member_clubs.json() == []

    public_clubs = client.get("/api/activities/clubs")
    assert public_clubs.status_code == 200
    assert all(c["id"] != club_id for c in public_clubs.json())
