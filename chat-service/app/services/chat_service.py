from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.activity_announcement import ActivityAnnouncement
from app.models.activity_chat_message import ActivityChatMessage
from app.services.context_auto_reply import (
    answer_from_context,
    build_club_context_text,
    build_event_context_text,
)
from app.services.support_matching import answer_matches_question_intent
from app.models.activity_event import ActivityEvent
from app.models.club import Club
from app.models.club_membership import ClubMembership
from app.models.event_participation import EventParticipation
from app.models.enums import Role
from app.models.user import User
from app.schemas.chat import (
    AutoreplyOutcome,
    ChatMessageCreateRequest,
    ChatMessageDeleteResponse,
    ChatMessageResponse,
    ChatPostResponse,
    ChatThreadResponse,
)
from app.services.qa_pruning import prune_superseded_qa_pairs


def list_event_messages(
    db: Session,
    event_id: int,
    user_id: int,
    thread_user_id: int | None = None,
) -> list[ChatMessageResponse]:
    user = _ensure_user(db, user_id)
    event = _ensure_event(db, event_id)
    thread = _resolve_view_thread(user, _user_is_event_organizer(user, event), thread_user_id)
    rows = _list_messages(
        db,
        event_id=event_id,
        thread_user_id=thread,
    )
    return [_to_response(r) for r in rows]


def list_club_group_messages(db: Session, club_id: int, user_id: int) -> list[ChatMessageResponse]:
    user = _ensure_user(db, user_id)
    club = _ensure_club(db, club_id)
    if not _user_can_view_club_chat(db, club, user):
        raise PermissionError("Only approved members can view group chat")
    rows = _list_group_messages(db, club_id=club_id)
    emails = _emails_for(db, [int(r.sender_user_id) for r in rows])
    return [
        _to_response(
            r,
            sender_email=emails.get(int(r.sender_user_id)),
            sender_is_organizer=_sender_is_club_organizer(db, club, int(r.sender_user_id)),
        )
        for r in rows
    ]


def post_club_group_message(
    db: Session, club_id: int, user_id: int, req: ChatMessageCreateRequest
) -> ChatPostResponse:
    user = _ensure_user(db, user_id)
    club = _ensure_club(db, club_id)
    if not _user_can_view_club_chat(db, club, user):
        raise PermissionError("Only approved members can send group chat messages")
    message = _build_message(
        req,
        user_id=user.id,
        role="USER",
        club_id=club.id,
        thread_user_id=None,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return ChatPostResponse(
        message=_to_response(
            message,
            sender_email=user.email,
            sender_is_organizer=_sender_is_club_organizer(db, club, user.id),
        ),
        autoReply=None,
    )


def assert_can_join_club_group_chat(db: Session, club_id: int, user_id: int) -> None:
    assert_can_join_club_chat(db, club_id, user_id)


def list_club_messages(
    db: Session,
    club_id: int,
    user_id: int,
    thread_user_id: int | None = None,
) -> list[ChatMessageResponse]:
    user = _ensure_user(db, user_id)
    club = _ensure_club(db, club_id)
    if not _user_can_view_club_chat(db, club, user):
        raise PermissionError("Only approved members can view club chat")
    thread = _resolve_view_thread(user, _user_is_club_organizer(db, club, user), thread_user_id)
    rows = _list_messages(
        db,
        club_id=club_id,
        thread_user_id=thread,
    )
    return [_to_response(r) for r in rows]


def list_event_threads(db: Session, event_id: int, user_id: int) -> list[ChatThreadResponse]:
    user = _ensure_user(db, user_id)
    event = _ensure_event(db, event_id)
    if not _user_is_event_organizer(user, event):
        raise PermissionError("Only the event organizer can view support threads")
    return _list_threads(db, event_id=event_id)


def list_club_threads(db: Session, club_id: int, user_id: int) -> list[ChatThreadResponse]:
    user = _ensure_user(db, user_id)
    club = _ensure_club(db, club_id)
    if not _user_is_club_organizer(db, club, user):
        raise PermissionError("Only the group organizer can view support threads")
    return _list_threads(db, club_id=club_id)


def post_event_message(db: Session, event_id: int, user_id: int, req: ChatMessageCreateRequest) -> ChatPostResponse:
    user = _ensure_user(db, user_id)
    event = _ensure_event(db, event_id)
    role = req.role.upper()
    is_org = _user_is_event_organizer(user, event)
    if role == "ORGANIZER" and not is_org:
        raise PermissionError("Only event organizer/admin can send organizer replies")
    thread_user_id = _resolve_post_thread(db, user, is_org, role, req.threadUserId)
    message = _build_message(req, user_id=user.id, role=role, event_id=event.id, thread_user_id=thread_user_id)
    return _save_message_only(db, message)


def post_club_message(db: Session, club_id: int, user_id: int, req: ChatMessageCreateRequest) -> ChatPostResponse:
    user = _ensure_user(db, user_id)
    club = _ensure_club(db, club_id)
    role = req.role.upper()
    is_org = _user_is_club_organizer(db, club, user)
    if role == "ORGANIZER":
        if not is_org:
            raise PermissionError("Only club admins can send organizer replies")
    else:
        if not _user_can_view_club_chat(db, club, user):
            raise PermissionError("Only approved members can send club chat messages")
    thread_user_id = _resolve_post_thread(db, user, is_org, role, req.threadUserId)
    message = _build_message(req, user_id=user.id, role=role, club_id=club.id, thread_user_id=thread_user_id)
    return _save_message_only(db, message)


def approve_event_auto_reply(
    db: Session, event_id: int, message_id: int, user_id: int
) -> ChatMessageResponse:
    user = _ensure_user(db, user_id)
    event = _ensure_event(db, event_id)
    if not _user_is_event_organizer(user, event):
        raise PermissionError("Only the event organizer can approve auto-replies")
    return _approve_auto_reply(db, event_id=event_id, message_id=message_id)


def approve_club_auto_reply(
    db: Session, club_id: int, message_id: int, user_id: int
) -> ChatMessageResponse:
    user = _ensure_user(db, user_id)
    club = _ensure_club(db, club_id)
    if not _user_is_club_organizer(db, club, user):
        raise PermissionError("Only club admins can approve auto-replies")
    return _approve_auto_reply(db, club_id=club_id, message_id=message_id)


def reject_event_auto_reply(
    db: Session, event_id: int, message_id: int, user_id: int
) -> ChatMessageDeleteResponse:
    user = _ensure_user(db, user_id)
    event = _ensure_event(db, event_id)
    if not _user_is_event_organizer(user, event):
        raise PermissionError("Only the event organizer can reject auto-replies")
    return _reject_auto_reply(db, event_id=event_id, message_id=message_id)


def reject_club_auto_reply(
    db: Session, club_id: int, message_id: int, user_id: int
) -> ChatMessageDeleteResponse:
    user = _ensure_user(db, user_id)
    club = _ensure_club(db, club_id)
    if not _user_is_club_organizer(db, club, user):
        raise PermissionError("Only club admins can reject auto-replies")
    return _reject_auto_reply(db, club_id=club_id, message_id=message_id)


def assert_can_join_event_chat(db: Session, event_id: int, user_id: int) -> None:
    user = _ensure_user(db, user_id)
    event = _ensure_event(db, event_id)
    if not _user_can_access_event(db, event, user):
        raise PermissionError("Only participants can open event chat")


def assert_can_join_club_chat(db: Session, club_id: int, user_id: int) -> None:
    user = _ensure_user(db, user_id)
    club = _ensure_club(db, club_id)
    if not _user_can_view_club_chat(db, club, user):
        raise PermissionError("Only approved members can open club chat")


def resolve_thread_room_user(
    db: Session,
    kind: str,
    resource_id: int,
    user_id: int,
    requested_thread_user_id: int | None,
) -> int | None:
    user = _ensure_user(db, user_id)
    if kind == "event":
        event = _ensure_event(db, resource_id)
        is_org = _user_is_event_organizer(user, event)
    else:
        club = _ensure_club(db, resource_id)
        is_org = _user_is_club_organizer(db, club, user)
    if is_org:
        return int(requested_thread_user_id) if requested_thread_user_id is not None else None
    return user.id


def _resolve_view_thread(user: User, is_organizer: bool, requested: int | None) -> int:
    if is_organizer:
        if requested is None:
            raise ValueError("threadUserId is required for the organizer inbox")
        return int(requested)
    return user.id


def _resolve_post_thread(
    db: Session,
    user: User,
    is_organizer: bool,
    role: str,
    requested: int | None,
) -> int:
    if role == "ORGANIZER":
        if requested is None:
            raise ValueError("threadUserId is required when replying as organizer")
        _ensure_user(db, int(requested))
        return int(requested)
    return user.id


def _maybe_autoreply_event(
    db: Session, event: ActivityEvent, message: ActivityChatMessage
) -> tuple[ActivityChatMessage | None, list[ChatMessageDeleteResponse]]:
    announcements = _list_announcements(db, event_id=event.id)
    context_text = build_event_context_text(event, announcements)
    return _maybe_autoreply(
        db,
        message,
        pairs=_qa_pairs(db, event_id=event.id),  # all member threads
        event_id=event.id,
        organizer_user_id=event.created_by,
        context_text=context_text,
    )


def _maybe_autoreply_club(
    db: Session, club: Club, message: ActivityChatMessage
) -> tuple[ActivityChatMessage | None, list[ChatMessageDeleteResponse]]:
    announcements = _list_announcements(db, club_id=club.id)
    context_text = build_club_context_text(club, announcements)
    return _maybe_autoreply(
        db,
        message,
        pairs=_qa_pairs(db, club_id=club.id),
        club_id=club.id,
        organizer_user_id=club.created_by,
        context_text=context_text,
    )


def _list_announcements(
    db: Session,
    *,
    event_id: int | None = None,
    club_id: int | None = None,
    limit: int = 5,
) -> list[ActivityAnnouncement]:
    query = select(ActivityAnnouncement)
    if event_id is not None:
        query = query.where(ActivityAnnouncement.event_id == event_id)
    elif club_id is not None:
        query = query.where(ActivityAnnouncement.club_id == club_id)
    else:
        return []
    return db.execute(
        query.order_by(ActivityAnnouncement.created_at.desc(), ActivityAnnouncement.id.desc()).limit(limit)
    ).scalars().all()


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


def _user_can_access_event(db: Session, event: ActivityEvent, user: User) -> bool:
    if user.role == Role.ADMIN.value:
        return True
    if event.created_by == user.id:
        return True
    row = db.execute(
        select(EventParticipation.id).where(
            EventParticipation.event_id == event.id,
            EventParticipation.user_id == user.id,
        )
    ).scalar_one_or_none()
    return row is not None


def _sender_is_club_organizer(db: Session, club: Club, sender_user_id: int) -> bool:
    user = db.execute(select(User).where(User.id == sender_user_id)).scalar_one_or_none()
    if user is None:
        return False
    return _user_is_club_organizer(db, club, user)


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
    thread_user_id: int | None = None,
) -> list[ActivityChatMessage]:
    query = select(ActivityChatMessage)
    if event_id is not None:
        query = query.where(ActivityChatMessage.event_id == event_id)
    if club_id is not None:
        query = query.where(ActivityChatMessage.club_id == club_id)
    if thread_user_id is not None:
        query = query.where(ActivityChatMessage.thread_user_id == thread_user_id)
    return db.execute(
        query.order_by(ActivityChatMessage.created_at.asc(), ActivityChatMessage.id.asc())
    ).scalars().all()


def _list_group_messages(db: Session, *, club_id: int) -> list[ActivityChatMessage]:
    return db.execute(
        select(ActivityChatMessage)
        .where(
            ActivityChatMessage.club_id == club_id,
            ActivityChatMessage.thread_user_id.is_(None),
        )
        .order_by(ActivityChatMessage.created_at.asc(), ActivityChatMessage.id.asc())
    ).scalars().all()


def _list_threads(
    db: Session,
    *,
    event_id: int | None = None,
    club_id: int | None = None,
) -> list[ChatThreadResponse]:
    context = (
        ActivityChatMessage.event_id == event_id
        if event_id is not None
        else ActivityChatMessage.club_id == club_id
    )
    rows = db.execute(
        select(ActivityChatMessage)
        .where(context, ActivityChatMessage.thread_user_id.is_not(None))
        .order_by(ActivityChatMessage.created_at.asc(), ActivityChatMessage.id.asc())
    ).scalars().all()

    grouped: dict[int, list[ActivityChatMessage]] = {}
    for row in rows:
        grouped.setdefault(int(row.thread_user_id), []).append(row)

    emails = _emails_for(db, list(grouped.keys()))
    threads: list[ChatThreadResponse] = []
    for thread_user_id, msgs in grouped.items():
        last = msgs[-1]
        threads.append(
            ChatThreadResponse(
                threadUserId=thread_user_id,
                userEmail=emails.get(thread_user_id, f"User #{thread_user_id}"),
                lastMessageBody=last.body,
                lastMessageAt=last.created_at,
                lastMessageRole=last.role,
                messageCount=len(msgs),
            )
        )
    threads.sort(key=lambda t: t.lastMessageAt, reverse=True)
    return threads


def _emails_for(db: Session, user_ids: list[int]) -> dict[int, str]:
    if not user_ids:
        return {}
    rows = db.execute(select(User.id, User.email).where(User.id.in_(user_ids))).all()
    return {int(uid): email for uid, email in rows}


def _build_message(
    req: ChatMessageCreateRequest,
    *,
    user_id: int,
    role: str,
    event_id: int | None = None,
    club_id: int | None = None,
    thread_user_id: int | None = None,
) -> ActivityChatMessage:
    return ActivityChatMessage(
        event_id=event_id,
        club_id=club_id,
        sender_user_id=user_id,
        thread_user_id=thread_user_id,
        role=role,
        body=req.body.strip(),
        in_reply_to_message_id=req.inReplyToMessageId,
    )


def _save_message_only(db: Session, message: ActivityChatMessage) -> ChatPostResponse:
    db.add(message)
    db.commit()
    db.refresh(message)
    return ChatPostResponse(message=_to_response(message), autoReply=None)


def try_autoreply_after_post(
    db: Session,
    kind: str,
    resource_id: int,
    message_id: int,
) -> AutoreplyOutcome:
    msg = db.execute(
        select(ActivityChatMessage).where(ActivityChatMessage.id == message_id)
    ).scalar_one_or_none()
    if msg is None or msg.role != "USER":
        return AutoreplyOutcome()

    auto: ActivityChatMessage | None
    pruned: list[ChatMessageDeleteResponse]
    if kind == "event":
        event = _ensure_event(db, resource_id)
        auto, pruned = _maybe_autoreply_event(db, event, msg)
    else:
        club = _ensure_club(db, resource_id)
        auto, pruned = _maybe_autoreply_club(db, club, msg)

    if auto is None:
        return AutoreplyOutcome(pruned=pruned)
    db.commit()
    db.refresh(auto)
    return AutoreplyOutcome(autoReply=_to_response(auto), pruned=pruned)


def _maybe_autoreply(
    db: Session,
    message: ActivityChatMessage,
    *,
    pairs: list[dict],
    organizer_user_id: int,
    context_text: str,
    event_id: int | None = None,
    club_id: int | None = None,
) -> tuple[ActivityChatMessage | None, list[ChatMessageDeleteResponse]]:
    if message.role != "USER":
        return None, []

    if not context_text.strip() and not pairs:
        return None, []

    ctx_out = answer_from_context(message.body, context_text, qa_pairs=pairs)
    if not (
        ctx_out.canAnswer
        and ctx_out.answer.strip()
        and answer_matches_question_intent(message.body, ctx_out.answer.strip())
    ):
        return None, []

    from_lexical = "(fallback)" in ctx_out.reason
    auto = _create_auto_reply(
        message,
        body=ctx_out.answer.strip(),
        sender_user_id=organizer_user_id,
        event_id=event_id,
        club_id=club_id,
        db=db,
        auto_approve=from_lexical,
    )
    pruned = prune_superseded_qa_pairs(
        db,
        new_question_id=message.id,
        new_question_body=message.body,
        pairs=pairs,
        event_id=event_id,
        club_id=club_id,
    )
    return auto, pruned


def _create_auto_reply(
    message: ActivityChatMessage,
    *,
    body: str,
    sender_user_id: int,
    event_id: int | None,
    club_id: int | None,
    db: Session,
    auto_approve: bool = False,
) -> ActivityChatMessage:
    auto = ActivityChatMessage(
        event_id=event_id,
        club_id=club_id,
        sender_user_id=sender_user_id,
        thread_user_id=message.thread_user_id,
        role="ORGANIZER",
        body=body,
        in_reply_to_message_id=message.id,
        is_auto_reply=True,
        is_approved=auto_approve,
    )
    db.add(auto)
    db.flush()
    return auto


def _qa_pairs(
    db: Session,
    *,
    event_id: int | None = None,
    club_id: int | None = None,
    thread_user_id: int | None = None,
) -> list[dict]:
    if (event_id is None) == (club_id is None):
        raise ValueError("Exactly one context is required")

    if event_id is not None:
        user_context = ActivityChatMessage.event_id == event_id
        answer_context = ActivityChatMessage.event_id == event_id
    else:
        user_context = ActivityChatMessage.club_id == club_id
        answer_context = ActivityChatMessage.club_id == club_id

    query = select(ActivityChatMessage).where(user_context, ActivityChatMessage.role == "USER")
    if thread_user_id is not None:
        query = query.where(ActivityChatMessage.thread_user_id == thread_user_id)

    user_msgs = db.execute(
        query.order_by(ActivityChatMessage.created_at.desc(), ActivityChatMessage.id.desc()).limit(80)
    ).scalars().all()

    pairs: list[dict] = []
    for question in user_msgs:
        answer = db.execute(
            select(ActivityChatMessage)
            .where(
                answer_context,
                ActivityChatMessage.role == "ORGANIZER",
                ActivityChatMessage.in_reply_to_message_id == question.id,
                or_(
                    ActivityChatMessage.is_auto_reply.is_(False),
                    ActivityChatMessage.is_approved.is_(True),
                ),
            )
            .order_by(
                ActivityChatMessage.is_auto_reply.asc(),  # manual first
                ActivityChatMessage.created_at.desc(),
                ActivityChatMessage.id.desc(),
            )
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


def _approve_auto_reply(
    db: Session,
    *,
    event_id: int | None = None,
    club_id: int | None = None,
    message_id: int,
) -> ChatMessageResponse:
    if (event_id is None) == (club_id is None):
        raise ValueError("Exactly one context is required")

    context = (
        ActivityChatMessage.event_id == event_id
        if event_id is not None
        else ActivityChatMessage.club_id == club_id
    )
    msg = db.execute(
        select(ActivityChatMessage).where(
            ActivityChatMessage.id == message_id,
            context,
        )
    ).scalar_one_or_none()
    if msg is None:
        raise ValueError("Message not found")
    if not msg.is_auto_reply:
        raise ValueError("Only auto-replies can be approved")
    if msg.is_approved:
        return _to_response(msg)

    msg.is_approved = True
    db.commit()
    db.refresh(msg)
    return _to_response(msg)


def _reject_auto_reply(
    db: Session,
    *,
    event_id: int | None = None,
    club_id: int | None = None,
    message_id: int,
) -> ChatMessageDeleteResponse:
    if (event_id is None) == (club_id is None):
        raise ValueError("Exactly one context is required")

    context = (
        ActivityChatMessage.event_id == event_id
        if event_id is not None
        else ActivityChatMessage.club_id == club_id
    )
    msg = db.execute(
        select(ActivityChatMessage).where(
            ActivityChatMessage.id == message_id,
            context,
        )
    ).scalar_one_or_none()
    if msg is None:
        raise ValueError("Message not found")
    if not msg.is_auto_reply:
        raise ValueError("Only auto-replies can be rejected")
    if msg.is_approved:
        raise ValueError("Approved auto-replies cannot be rejected")

    in_reply_to = msg.in_reply_to_message_id
    thread_user_id = msg.thread_user_id
    db.delete(msg)
    db.commit()
    return ChatMessageDeleteResponse(
        messageId=message_id,
        inReplyToMessageId=in_reply_to,
        threadUserId=thread_user_id,
    )


def _to_response(
    msg: ActivityChatMessage,
    *,
    sender_email: str | None = None,
    sender_is_organizer: bool = False,
) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=msg.id,
        eventId=msg.event_id,
        clubId=msg.club_id,
        senderUserId=msg.sender_user_id,
        threadUserId=msg.thread_user_id,
        role=msg.role,
        body=msg.body,
        inReplyToMessageId=msg.in_reply_to_message_id,
        isAutoReply=msg.is_auto_reply,
        isApproved=msg.is_approved,
        createdAt=msg.created_at,
        senderEmail=sender_email,
        senderIsOrganizer=sender_is_organizer,
    )
