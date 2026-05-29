from __future__ import annotations

from collections.abc import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.activity_chat_message import ActivityChatMessage
from app.schemas.support import SupportQaCandidate
from app.services.support_matching import match_history
from app.models.activity_event import ActivityEvent
from app.models.club import Club
from app.models.club_membership import ClubMembership
from app.models.enums import Role
from app.models.user import User
from app.schemas.chat import ChatMessageCreateRequest, ChatMessageResponse, ChatPostResponse


def list_event_messages(db: Session, event_id: int, user_id: int) -> list[ChatMessageResponse]:
    _ensure_user(db, user_id)
    _ensure_event(db, event_id)
    rows = _list_messages(db, event_id=event_id)
    return [_to_response(r) for r in rows]


def list_club_messages(db: Session, club_id: int, user_id: int) -> list[ChatMessageResponse]:
    user = _ensure_user(db, user_id)
    club = _ensure_club(db, club_id)
    if not _user_can_view_club_chat(db, club, user):
        raise PermissionError("Only approved members can view club chat")
    rows = _list_messages(db, club_id=club_id)
    return [_to_response(r) for r in rows]


def post_event_message(db: Session, event_id: int, user_id: int, req: ChatMessageCreateRequest) -> ChatPostResponse:
    user = _ensure_user(db, user_id)
    event = _ensure_event(db, event_id)
    role = req.role.upper()
    if role == "ORGANIZER" and not _user_is_event_organizer(user, event):
        raise PermissionError("Only event organizer/admin can send organizer replies")
    message = _build_message(req, user_id=user.id, role=role, event_id=event.id)
    return _save_with_autoreply(db, message, lambda msg: _maybe_autoreply_event(db, event, msg))


def post_club_message(db: Session, club_id: int, user_id: int, req: ChatMessageCreateRequest) -> ChatPostResponse:
    user = _ensure_user(db, user_id)
    club = _ensure_club(db, club_id)
    role = req.role.upper()
    if role == "ORGANIZER":
        if not _user_is_club_organizer(db, club, user):
            raise PermissionError("Only club admins can send organizer replies")
    else:
        if not _user_can_view_club_chat(db, club, user):
            raise PermissionError("Only approved members can send club chat messages")
    message = _build_message(req, user_id=user.id, role=role, club_id=club.id)
    return _save_with_autoreply(db, message, lambda msg: _maybe_autoreply_club(db, club, msg))


def assert_can_join_event_chat(db: Session, event_id: int, user_id: int) -> None:
    _ensure_user(db, user_id)
    _ensure_event(db, event_id)


def assert_can_join_club_chat(db: Session, club_id: int, user_id: int) -> None:
    user = _ensure_user(db, user_id)
    club = _ensure_club(db, club_id)
    if not _user_can_view_club_chat(db, club, user):
        raise PermissionError("Only approved members can open club chat")


def _maybe_autoreply_event(db: Session, event: ActivityEvent, message: ActivityChatMessage) -> ActivityChatMessage | None:
    return _maybe_autoreply(db, message, pairs=_qa_pairs(db, event_id=event.id), event_id=event.id)


def _maybe_autoreply_club(db: Session, club: Club, message: ActivityChatMessage) -> ActivityChatMessage | None:
    return _maybe_autoreply(db, message, pairs=_qa_pairs(db, club_id=club.id), club_id=club.id)


def _find_similar(message: str, pairs: list[dict]) -> dict | None:
    if not pairs:
        return None
    candidates = [
        SupportQaCandidate(
            questionId=p["questionId"],
            question=p["questionBody"],
            answer=p["answerBody"],
            questionAt=p.get("questionAt"),
            answerAt=p.get("answerAt"),
        )
        for p in pairs
    ]
    out = match_history(message, candidates)
    if out.matchedQuestionId is None:
        return None
    for p in pairs:
        if p["questionId"] == out.matchedQuestionId:
            return p
    return None


def _ensure_event(db: Session, event_id: int) -> ActivityEvent:
    event = db.execute(
        select(ActivityEvent).where(ActivityEvent.id == event_id, ActivityEvent.status != "DELETED")
    ).scalar_one_or_none()
    if event is None:
        raise ValueError("Event not found")
    return event


def _ensure_club(db: Session, club_id: int) -> Club:
    club = db.execute(select(Club).where(Club.id == club_id, Club.status != "DELETED")).scalar_one_or_none()
    if club is None:
        raise ValueError("Club not found")
    return club


def _ensure_user(db: Session, user_id: int) -> User:
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")
    return user


def _user_is_event_organizer(user: User, event: ActivityEvent) -> bool:
    return user.role == Role.ADMIN.value or event.created_by == user.id


def _user_is_club_organizer(db: Session, club: Club, user: User) -> bool:
    if user.role == Role.ADMIN.value or club.created_by == user.id:
        return True
    row = db.execute(
        select(ClubMembership.id).where(
            ClubMembership.club_id == club.id,
            ClubMembership.user_id == user.id,
            ClubMembership.status == "APPROVED",
            ClubMembership.role == "CLUB_ADMIN",
        )
    ).scalar_one_or_none()
    return row is not None


def _user_can_view_club_chat(db: Session, club: Club, user: User) -> bool:
    if user.role == Role.ADMIN.value:
        return True
    row = db.execute(
        select(ClubMembership.id).where(
            ClubMembership.club_id == club.id,
            ClubMembership.user_id == user.id,
            ClubMembership.status == "APPROVED",
        )
    ).scalar_one_or_none()
    return row is not None


def _list_messages(
    db: Session,
    *,
    event_id: int | None = None,
    club_id: int | None = None,
) -> list[ActivityChatMessage]:
    query = select(ActivityChatMessage)
    if event_id is not None:
        query = query.where(ActivityChatMessage.event_id == event_id)
    if club_id is not None:
        query = query.where(ActivityChatMessage.club_id == club_id)
    return db.execute(query.order_by(ActivityChatMessage.created_at.asc(), ActivityChatMessage.id.asc())).scalars().all()


def _build_message(
    req: ChatMessageCreateRequest,
    *,
    user_id: int,
    role: str,
    event_id: int | None = None,
    club_id: int | None = None,
) -> ActivityChatMessage:
    return ActivityChatMessage(
        event_id=event_id,
        club_id=club_id,
        sender_user_id=user_id,
        role=role,
        body=req.body.strip(),
        in_reply_to_message_id=req.inReplyToMessageId,
    )


def _save_with_autoreply(
    db: Session,
    message: ActivityChatMessage,
    build_auto_reply: Callable[[ActivityChatMessage], ActivityChatMessage | None],
) -> ChatPostResponse:
    db.add(message)
    db.flush()
    auto = build_auto_reply(message)
    db.commit()
    db.refresh(message)
    if auto is not None:
        db.refresh(auto)
    return ChatPostResponse(message=_to_response(message), autoReply=_to_response(auto) if auto else None)


def _maybe_autoreply(
    db: Session,
    message: ActivityChatMessage,
    *,
    pairs: list[dict],
    event_id: int | None = None,
    club_id: int | None = None,
) -> ActivityChatMessage | None:
    if message.role != "USER":
        return None
    matched = _find_similar(message.body, pairs)
    if matched is None:
        return None
    auto = ActivityChatMessage(
        event_id=event_id,
        club_id=club_id,
        sender_user_id=matched["organizerUserId"],
        role="ORGANIZER",
        body=matched["answerBody"],
        in_reply_to_message_id=message.id,
        is_auto_reply=True,
    )
    db.add(auto)
    db.flush()
    return auto


def _qa_pairs(db: Session, *, event_id: int | None = None, club_id: int | None = None) -> list[dict]:
    if (event_id is None) == (club_id is None):
        raise ValueError("Exactly one context is required")

    if event_id is not None:
        user_context = ActivityChatMessage.event_id == event_id
        answer_context = ActivityChatMessage.event_id == event_id
    else:
        user_context = ActivityChatMessage.club_id == club_id
        answer_context = ActivityChatMessage.club_id == club_id

    user_msgs = db.execute(
        select(ActivityChatMessage)
        .where(user_context, ActivityChatMessage.role == "USER")
        .order_by(ActivityChatMessage.created_at.desc(), ActivityChatMessage.id.desc())
        .limit(80)
    ).scalars().all()

    pairs: list[dict] = []
    for question in user_msgs:
        answer = db.execute(
            select(ActivityChatMessage)
            .where(
                answer_context,
                ActivityChatMessage.role == "ORGANIZER",
                ActivityChatMessage.in_reply_to_message_id == question.id,
                ActivityChatMessage.is_auto_reply.is_(False),
            )
            .order_by(ActivityChatMessage.created_at.desc(), ActivityChatMessage.id.desc())
        ).scalar_one_or_none()
        if answer is None:
            continue
        pairs.append(
            {
                "questionId": question.id,
                "questionBody": question.body,
                "answerBody": answer.body,
                "organizerUserId": answer.sender_user_id,
                "questionAt": question.created_at,
                "answerAt": answer.created_at,
            }
        )
    pairs.sort(key=lambda p: p["answerAt"], reverse=True)
    return pairs


def _to_response(msg: ActivityChatMessage) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=msg.id,
        eventId=msg.event_id,
        clubId=msg.club_id,
        senderUserId=msg.sender_user_id,
        role=msg.role,
        body=msg.body,
        inReplyToMessageId=msg.in_reply_to_message_id,
        isAutoReply=msg.is_auto_reply,
        createdAt=msg.created_at,
    )
