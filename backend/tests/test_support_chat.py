"""Support chat: isolation, permissions, Q/A pairing, auto-reply (AI mocked)."""

from __future__ import annotations

import importlib
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.integrations.ai_client import AiServiceError
from app.main import app as fastapi_app
from app.models import ActivityChatMessage  # noqa: F401 — metadata
from app.models.activity_event import ActivityEvent
from app.models.club import Club
from app.models.club_membership import ClubMembership
from app.models.enums import Role
from app.models.user import User
from app.schemas.activities import ChatMessageCreateRequest
from app.services import support_chat_service as sc


def _seed_users_events_clubs(db: Any) -> dict[str, int]:
    now = datetime.now(UTC)
    org = User(
        email="org_support_test@example.com",
        password=hash_password("x"),
        first_name="O",
        last_name="R",
        name="O R",
        role=Role.ORGANIZER.value,
        is_verified=True,
        is_approved=True,
        verification_status="APPROVED",
        created_at=now,
    )
    member = User(
        email="member_support_test@example.com",
        password=hash_password("x"),
        first_name="M",
        last_name="E",
        name="M E",
        role=Role.USER.value,
        is_verified=True,
        is_approved=True,
        verification_status="APPROVED",
        created_at=now,
    )
    stranger = User(
        email="stranger_support_test@example.com",
        password=hash_password("x"),
        first_name="S",
        last_name="T",
        name="S T",
        role=Role.USER.value,
        is_verified=True,
        is_approved=True,
        verification_status="APPROVED",
        created_at=now,
    )
    db.add_all([org, member, stranger])
    db.flush()

    ev1 = ActivityEvent(
        title="Event One",
        description=None,
        category="GENERAL",
        city="Cluj-Napoca",
        location_name=None,
        latitude=None,
        longitude=None,
        starts_at=now + timedelta(days=1),
        ends_at=now + timedelta(days=1, hours=2),
        status="PUBLISHED",
        created_by=org.id,
    )
    ev2 = ActivityEvent(
        title="Event Two",
        description=None,
        category="GENERAL",
        city="Cluj-Napoca",
        location_name=None,
        latitude=None,
        longitude=None,
        starts_at=now + timedelta(days=2),
        ends_at=now + timedelta(days=2, hours=2),
        status="PUBLISHED",
        created_by=org.id,
    )
    db.add_all([ev1, ev2])
    db.flush()

    club = Club(
        name="Club Support Test",
        description=None,
        category="OTHER",
        city="Cluj-Napoca",
        visibility="PUBLIC",
        status="ACTIVE",
        created_by=org.id,
    )
    db.add(club)
    db.flush()
    db.add(
        ClubMembership(
            club_id=club.id,
            user_id=member.id,
            role="MEMBER",
            status="APPROVED",
        )
    )
    db.add(
        ClubMembership(
            club_id=club.id,
            user_id=org.id,
            role="CLUB_ADMIN",
            status="APPROVED",
        )
    )
    db.commit()
    return {"org": org.id, "member": member.id, "stranger": stranger.id, "ev1": ev1.id, "ev2": ev2.id, "club": club.id}


@pytest.fixture
def db_session():
    importlib.import_module("app.models")

    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    sess = Session()
    ids = _seed_users_events_clubs(sess)
    try:
        yield sess, ids
    finally:
        sess.close()
        Base.metadata.drop_all(engine)


def test_event_qa_pairs_excludes_only_auto_organizer_answer(db_session: tuple[Any, dict[str, int]]) -> None:
    db, ids = db_session
    q = ActivityChatMessage(
        event_id=ids["ev1"],
        club_id=None,
        sender_user_id=ids["member"],
        role="USER",
        body="Unde ne intalnim?",
        in_reply_to_message_id=None,
        is_auto_reply=False,
    )
    db.add(q)
    db.flush()
    db.add(
        ActivityChatMessage(
            event_id=ids["ev1"],
            club_id=None,
            sender_user_id=ids["org"],
            role="ORGANIZER",
            body="La intrare.",
            in_reply_to_message_id=q.id,
            is_auto_reply=True,
        )
    )
    db.commit()
    pairs = sc._event_qa_pairs(db, ids["ev1"])
    assert pairs == []


def test_event_qa_pairs_includes_human_organizer_answer(db_session: tuple[Any, dict[str, int]]) -> None:
    db, ids = db_session
    q = ActivityChatMessage(
        event_id=ids["ev1"],
        club_id=None,
        sender_user_id=ids["member"],
        role="USER",
        body="Care e dress code?",
        in_reply_to_message_id=None,
        is_auto_reply=False,
    )
    db.add(q)
    db.flush()
    db.add(
        ActivityChatMessage(
            event_id=ids["ev1"],
            club_id=None,
            sender_user_id=ids["org"],
            role="ORGANIZER",
            body="Smart casual.",
            in_reply_to_message_id=q.id,
            is_auto_reply=False,
        )
    )
    db.commit()
    pairs = sc._event_qa_pairs(db, ids["ev1"])
    assert len(pairs) == 1
    assert pairs[0]["questionBody"] == "Care e dress code?"
    assert pairs[0]["answerBody"] == "Smart casual."


def test_event_qa_pairs_isolated_per_event(db_session: tuple[Any, dict[str, int]]) -> None:
    db, ids = db_session

    def add_pair(event_id: int, qtext: str, atext: str) -> None:
        q = ActivityChatMessage(
            event_id=event_id,
            club_id=None,
            sender_user_id=ids["member"],
            role="USER",
            body=qtext,
            in_reply_to_message_id=None,
            is_auto_reply=False,
        )
        db.add(q)
        db.flush()
        db.add(
            ActivityChatMessage(
                event_id=event_id,
                club_id=None,
                sender_user_id=ids["org"],
                role="ORGANIZER",
                body=atext,
                in_reply_to_message_id=q.id,
                is_auto_reply=False,
            )
        )

    add_pair(ids["ev1"], "Q event 1", "A1")
    add_pair(ids["ev2"], "Q event 2", "A2")
    db.commit()
    p1 = sc._event_qa_pairs(db, ids["ev1"])
    p2 = sc._event_qa_pairs(db, ids["ev2"])
    assert len(p1) == 1 and p1[0]["questionBody"] == "Q event 1"
    assert len(p2) == 1 and p2[0]["questionBody"] == "Q event 2"


def test_find_similar_none_when_ai_unreachable(db_session: tuple[Any, dict[str, int]], monkeypatch: pytest.MonkeyPatch) -> None:
    db, ids = db_session

    def boom(*_a: Any, **_k: Any) -> None:
        raise AiServiceError("down")

    monkeypatch.setattr(sc, "ai_support_match", boom)
    pairs = [{"questionId": 1, "questionBody": "x", "answerBody": "y", "organizerUserId": ids["org"]}]
    assert sc._find_similar("x", pairs) is None


def test_auto_reply_after_human_answer(monkeypatch: pytest.MonkeyPatch, db_session: tuple[Any, dict[str, int]]) -> None:
    db, ids = db_session

    def fake_match(message: str, candidates: list[dict[str, Any]]) -> dict[str, Any]:
        if "parcare" in message.lower() and candidates:
            return {"matchedQuestionId": candidates[0]["questionId"], "confidence": 0.9, "reason": "test"}
        return {"matchedQuestionId": None, "confidence": 0.0, "reason": "no"}

    monkeypatch.setattr(sc, "ai_support_match", fake_match)

    r1 = sc.post_event_message(
        db,
        ids["ev1"],
        ids["member"],
        ChatMessageCreateRequest(role="USER", body="Este parcare la locatie?"),
    )
    assert r1.autoReply is None
    qid = r1.message.id

    r2 = sc.post_event_message(
        db,
        ids["ev1"],
        ids["org"],
        ChatMessageCreateRequest(
            role="ORGANIZER",
            body="Da, in parcarea din spatele cladirii.",
            inReplyToMessageId=qid,
        ),
    )
    assert r2.autoReply is None

    r3 = sc.post_event_message(
        db,
        ids["ev1"],
        ids["member"],
        ChatMessageCreateRequest(role="USER", body="Exista parcare aproape?"),
    )
    assert r3.autoReply is not None
    assert r3.autoReply.isAutoReply is True
    assert r3.autoReply.body == "Da, in parcarea din spatele cladirii."


def test_non_organizer_cannot_post_as_organizer(db_session: tuple[Any, dict[str, int]]) -> None:
    db, ids = db_session
    with pytest.raises(PermissionError):
        sc.post_event_message(
            db,
            ids["ev1"],
            ids["member"],
            ChatMessageCreateRequest(role="ORGANIZER", body="Hacked reply"),
        )


def test_club_stranger_cannot_post_or_list(db_session: tuple[Any, dict[str, int]]) -> None:
    db, ids = db_session
    with pytest.raises(PermissionError):
        sc.list_club_messages(db, ids["club"], ids["stranger"])
    with pytest.raises(PermissionError):
        sc.post_club_message(
            db,
            ids["club"],
            ids["stranger"],
            ChatMessageCreateRequest(role="USER", body="Hello?"),
        )


def test_club_member_can_post_user(db_session: tuple[Any, dict[str, int]]) -> None:
    db, ids = db_session
    r = sc.post_club_message(
        db,
        ids["club"],
        ids["member"],
        ChatMessageCreateRequest(role="USER", body="Salut"),
    )
    assert r.message.body == "Salut"
    assert r.autoReply is None


def test_club_member_cannot_post_as_organizer(db_session: tuple[Any, dict[str, int]]) -> None:
    db, ids = db_session
    with pytest.raises(PermissionError):
        sc.post_club_message(
            db,
            ids["club"],
            ids["member"],
            ChatMessageCreateRequest(role="ORGANIZER", body="Fake admin"),
        )


@pytest.fixture
def api_client_seeded():
    importlib.import_module("app.models")

    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    s0 = TestingSessionLocal()
    try:
        ids = _seed_users_events_clubs(s0)
    finally:
        s0.close()

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    fastapi_app.dependency_overrides[get_db] = override_get_db
    with TestClient(fastapi_app) as client:
        yield client, ids
    fastapi_app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)


def _bearer(uid: int) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(uid)}"}


def test_api_event_chat_roundtrip(api_client_seeded: tuple[TestClient, dict[str, int]]) -> None:
    client, ids = api_client_seeded
    uid = ids["member"]
    eid = ids["ev1"]
    r = client.post(
        f"/api/activities/events/{eid}/chat",
        json={"role": "USER", "body": "Intrebare API?"},
        headers=_bearer(uid),
    )
    assert r.status_code == 200
    mid = r.json()["message"]["id"]
    r2 = client.post(
        f"/api/activities/events/{eid}/chat",
        json={"role": "ORGANIZER", "body": "Raspuns API.", "inReplyToMessageId": mid},
        headers=_bearer(ids["org"]),
    )
    assert r2.status_code == 200
    r3 = client.get(f"/api/activities/events/{eid}/chat", headers=_bearer(uid))
    assert r3.status_code == 200
    msgs = r3.json()
    assert isinstance(msgs, list)
    bodies = [m["body"] for m in msgs]
    assert "Intrebare API?" in bodies and "Raspuns API." in bodies


def test_api_club_chat_403_for_stranger(api_client_seeded: tuple[TestClient, dict[str, int]]) -> None:
    client, ids = api_client_seeded
    r = client.get(f"/api/activities/clubs/{ids['club']}/chat", headers=_bearer(ids["stranger"]))
    assert r.status_code == 403
