from __future__ import annotations

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from app.models.activity_announcement import ActivityAnnouncement
from app.models.activity_chat_message import ActivityChatMessage
from app.models.activity_event import ActivityEvent
from app.models.club import Club
from app.models.event_participation import EventParticipation
from app.models.club_membership import ClubMembership
from app.models.enums import Role, VerificationStatus
from app.models.user import User
from app.schemas.activities import (
    AnnouncementCreateRequest,
    AnnouncementResponse,
    ClubCreateRequest,
    ClubMembershipPendingResponse,
    ClubResponse,
    EventCreateRequest,
    EventResponse,
)


def become_organizer(db: Session, user_id: int) -> User:
    user = _get_user_by_id(db, user_id)
    if user is None:
        raise ValueError("User not found")
    if user.verification_status != VerificationStatus.APPROVED.value or not user.is_verified:
        raise ValueError("Verification required to become organizer")
    if user.role != Role.ADMIN.value:
        user.role = Role.ORGANIZER.value
    db.commit()
    db.refresh(user)
    return user


def list_events(db: Session, user_id: int | None = None) -> list[EventResponse]:
    rows = db.execute(
        select(
            ActivityEvent,
            func.count(EventParticipation.id).label("participants"),
        )
        .outerjoin(EventParticipation, EventParticipation.event_id == ActivityEvent.id)
        .where(ActivityEvent.status != "DELETED")
        .group_by(ActivityEvent.id)
        .order_by(ActivityEvent.starts_at.asc())
    ).all()

    participating_ids: set[int] = set()
    if user_id is not None:
        part_rows = db.execute(
            select(EventParticipation.event_id).where(EventParticipation.user_id == user_id)
        ).all()
        participating_ids = {int(r[0]) for r in part_rows}

    out: list[EventResponse] = []
    for event, participants_count in rows:
        dto = _event_to_response(event, user_id, int(participants_count or 0), participating_ids)
        out.append(dto)
    return out


def list_my_events(db: Session, user_id: int) -> list[EventResponse]:
    _ensure_user_exists(db, user_id)
    created = db.execute(
        select(ActivityEvent)
        .where(
            ActivityEvent.created_by == user_id,
            ActivityEvent.status != "DELETED",
        )
        .order_by(ActivityEvent.starts_at.asc())
    ).scalars().all()
    participating = db.execute(
        select(ActivityEvent)
        .join(EventParticipation, EventParticipation.event_id == ActivityEvent.id)
        .where(
            EventParticipation.user_id == user_id,
            ActivityEvent.status != "DELETED",
            ActivityEvent.created_by != user_id,
        )
        .order_by(ActivityEvent.starts_at.asc())
    ).scalars().all()
    seen: set[int] = set()
    out: list[EventResponse] = []
    for event in [*created, *participating]:
        if event.id in seen:
            continue
        seen.add(event.id)
        out.append(_event_with_counts(db, event, user_id))
    out.sort(key=lambda e: e.startsAt)
    return out


def create_event(db: Session, req: EventCreateRequest, creator_user_id: int) -> EventResponse:
    user = _ensure_organizer(db, creator_user_id)
    if req.endsAt <= req.startsAt:
        raise ValueError("Event end must be after start")
    item = ActivityEvent(
        title=req.title.strip(),
        description=(req.description or "").strip() or None,
        category=req.category.strip().upper() or "GENERAL",
        city=req.city.strip() or "Cluj-Napoca",
        location_name=(req.locationName or "").strip() or None,
        latitude=req.latitude,
        longitude=req.longitude,
        starts_at=req.startsAt,
        ends_at=req.endsAt,
        status="PUBLISHED",
        created_by=user.id,
    )
    db.add(item)
    db.flush()
    db.add(EventParticipation(event_id=item.id, user_id=user.id))
    db.commit()
    db.refresh(item)
    return _event_with_counts(db, item, user.id)


def list_clubs(db: Session, user_id: int | None) -> list[ClubResponse]:
    rows = db.execute(
        select(
            Club,
            func.count(ClubMembership.id).label("members"),
        )
        .outerjoin(ClubMembership, ClubMembership.club_id == Club.id)
        .where(Club.status != "DELETED")
        .group_by(Club.id)
        .order_by(Club.created_at.desc())
    ).all()

    joined_club_ids: set[int] = set()
    if user_id is not None:
        joined_rows = db.execute(
            select(ClubMembership.club_id).where(
                ClubMembership.user_id == user_id,
                ClubMembership.status.in_(("APPROVED", "PENDING")),
            )
        ).all()
        joined_club_ids = {int(r[0]) for r in joined_rows}

    out: list[ClubResponse] = []
    for club, members_count in rows:
        dto = _club_to_response(db, club, user_id)
        dto.membersCount = int(members_count or 0)
        dto.joined = club.id in joined_club_ids
        out.append(dto)
    return out


def list_my_clubs(db: Session, user_id: int) -> list[ClubResponse]:
    _ensure_user_exists(db, user_id)
    clubs = db.execute(
        select(Club)
        .join(ClubMembership, ClubMembership.club_id == Club.id)
        .where(
            ClubMembership.user_id == user_id,
            ClubMembership.status.in_(("APPROVED", "PENDING")),
            Club.status != "DELETED",
        )
        .order_by(Club.created_at.desc())
    ).scalars().all()
    return [_club_with_counts(db, club, user_id) for club in clubs]


def create_club(db: Session, req: ClubCreateRequest, creator_user_id: int) -> ClubResponse:
    user = _ensure_organizer(db, creator_user_id)
    club = Club(
        name=req.name.strip(),
        description=(req.description or "").strip() or None,
        category=req.category.strip().upper() or "OTHER",
        city=req.city.strip() or "Cluj-Napoca",
        visibility=(req.visibility or "PUBLIC").strip().upper(),
        status="ACTIVE",
        created_by=user.id,
    )
    db.add(club)
    db.flush()
    db.add(
        ClubMembership(
            club_id=club.id,
            user_id=user.id,
            role="CLUB_ADMIN",
            status="APPROVED",
        )
    )
    db.commit()
    db.refresh(club)
    return _club_with_counts(db, club, user.id)


def join_club(db: Session, club_id: int, user_id: int) -> ClubResponse:
    club = _get_active_club(db, club_id)
    if club is None:
        raise ValueError("Club not found")
    user = _get_user_by_id(db, user_id)
    if user is None:
        raise ValueError("User not found")

    existing = _get_club_membership(db, club.id, user_id)
    if existing is not None:
        return _club_with_counts(db, club, user_id)

    status = "PENDING" if club.visibility == "APPROVAL_REQUIRED" else "APPROVED"
    db.add(
        ClubMembership(
            club_id=club.id,
            user_id=user_id,
            role="MEMBER",
            status=status,
        )
    )
    db.commit()
    return _club_with_counts(db, club, user_id)


def participate_event(db: Session, event_id: int, user_id: int) -> EventResponse:
    event = _get_event_not_deleted(db, event_id)
    if event is None:
        raise ValueError("Event not found")
    if event.status != "PUBLISHED":
        raise ValueError("Event is not open for participation")
    _ensure_user_exists(db, user_id)
    existing = _get_event_participation(db, event.id, user_id)
    if existing is None:
        db.add(EventParticipation(event_id=event.id, user_id=user_id))
        db.commit()
    return _event_with_counts(db, event, user_id)


def leave_event(db: Session, event_id: int, user_id: int) -> EventResponse:
    _ensure_user_exists(db, user_id)
    event = _get_event_not_deleted(db, event_id)
    if event is None:
        raise ValueError("Event not found")
    row = _get_event_participation(db, event.id, user_id)
    if row is not None and event.created_by != user_id:
        db.delete(row)
        db.commit()
    return _event_with_counts(db, event, user_id)


def cancel_event(db: Session, event_id: int, user_id: int) -> EventResponse:
    user = _ensure_user_exists(db, user_id)
    event = _get_event_not_deleted(db, event_id)
    if event is None:
        raise ValueError("Event not found")
    if event.created_by != user.id and user.role != Role.ADMIN.value:
        raise PermissionError("Only the event creator can cancel this event")
    event.status = "CANCELLED"
    db.commit()
    db.refresh(event)
    return _event_with_counts(db, event, user.id)


def delete_event(db: Session, event_id: int, user_id: int) -> EventResponse:
    user = _ensure_user_exists(db, user_id)
    event = _get_event_not_deleted(db, event_id)
    if event is None:
        raise ValueError("Event not found")
    if event.created_by != user.id and user.role != Role.ADMIN.value:
        raise PermissionError("Only the event creator can delete this event")
    _purge_event_data(db, event_id)
    event.status = "DELETED"
    db.commit()
    db.refresh(event)
    return _event_with_counts(db, event, user.id)


def delete_club(db: Session, club_id: int, user_id: int) -> ClubResponse:
    user = _ensure_user_exists(db, user_id)
    club = _get_club_not_deleted(db, club_id)
    if club is None:
        raise ValueError("Club not found")
    if club.created_by != user.id and not _user_is_club_admin(db, club, user.id) and user.role != Role.ADMIN.value:
        raise PermissionError("Only the club organizer can delete this club")
    _purge_club_data(db, club_id)
    club.status = "DELETED"
    db.commit()
    return _club_with_counts(db, club, user_id)


def leave_club(db: Session, club_id: int, user_id: int) -> ClubResponse:
    _ensure_user_exists(db, user_id)
    club = _get_active_club(db, club_id)
    if club is None:
        raise ValueError("Club not found")
    membership = _get_club_membership(db, club.id, user_id)
    if membership is None:
        return _club_with_counts(db, club, user_id)
    db.delete(membership)
    db.commit()
    return _club_with_counts(db, club, user_id)


def list_pending_club_memberships(
    db: Session, club_id: int, actor_user_id: int
) -> list[ClubMembershipPendingResponse]:
    club = _get_active_club(db, club_id)
    if club is None:
        raise ValueError("Club not found")
    actor = _ensure_user_exists(db, actor_user_id)
    if not _user_is_club_admin(db, club, actor.id) and actor.role != Role.ADMIN.value:
        raise PermissionError("Only club admins can view pending memberships")

    rows = db.execute(
        select(ClubMembership, User)
        .join(User, User.id == ClubMembership.user_id)
        .where(
            ClubMembership.club_id == club.id,
            ClubMembership.status == "PENDING",
        )
        .order_by(ClubMembership.joined_at.asc())
    ).all()
    return [_pending_membership_to_response(m, u) for m, u in rows]


def approve_club_membership(db: Session, club_id: int, membership_id: int, actor_user_id: int) -> ClubResponse:
    membership, club = _get_pending_membership_for_admin(db, club_id, membership_id, actor_user_id)
    membership.status = "APPROVED"
    db.commit()
    return _club_with_counts(db, club, actor_user_id)


def reject_club_membership(db: Session, club_id: int, membership_id: int, actor_user_id: int) -> ClubResponse:
    membership, club = _get_pending_membership_for_admin(db, club_id, membership_id, actor_user_id)
    db.delete(membership)
    db.commit()
    return _club_with_counts(db, club, actor_user_id)


def list_event_announcements(db: Session, event_id: int, user_id: int) -> list[AnnouncementResponse]:
    _ensure_user_exists(db, user_id)
    event = _get_event_not_deleted(db, event_id)
    if event is None:
        raise ValueError("Event not found")
    if not _user_can_access_event(db, event, user_id):
        raise PermissionError("Only participants can view event announcements")
    rows = _list_announcements_for_event(db, event_id)
    return [_announcement_to_response(r) for r in rows]


def create_event_announcement(
    db: Session, event_id: int, req: AnnouncementCreateRequest, author_user_id: int
) -> AnnouncementResponse:
    user = _ensure_user_exists(db, author_user_id)
    event = _get_event_not_deleted(db, event_id)
    if event is None:
        raise ValueError("Event not found")
    if event.created_by != user.id and user.role != Role.ADMIN.value:
        raise PermissionError("Only the event organizer can post announcements")
    ann = ActivityAnnouncement(
        title=req.title.strip(),
        body=req.body.strip(),
        event_id=event.id,
        club_id=None,
        created_by=user.id,
    )
    return _persist_announcement(db, ann)


def list_club_announcements(db: Session, club_id: int, user_id: int) -> list[AnnouncementResponse]:
    _ensure_user_exists(db, user_id)
    club = _get_club_not_deleted(db, club_id)
    if club is None:
        raise ValueError("Club not found")
    if not _user_can_read_club_announcements(db, club_id, user_id):
        raise PermissionError("Only approved club members can view announcements")
    rows = _list_announcements_for_club(db, club_id)
    return [_announcement_to_response(r) for r in rows]


def create_club_announcement(
    db: Session, club_id: int, req: AnnouncementCreateRequest, author_user_id: int
) -> AnnouncementResponse:
    user = _ensure_user_exists(db, author_user_id)
    club = _get_active_club(db, club_id)
    if club is None:
        raise ValueError("Club not found")
    if not (_user_is_club_admin(db, club, user.id) or user.role == Role.ADMIN.value):
        raise PermissionError("Only club admins can post announcements")
    ann = ActivityAnnouncement(
        title=req.title.strip(),
        body=req.body.strip(),
        event_id=None,
        club_id=club.id,
        created_by=user.id,
    )
    return _persist_announcement(db, ann)


def _get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()


def _get_event_not_deleted(db: Session, event_id: int) -> ActivityEvent | None:
    return db.execute(
        select(ActivityEvent).where(ActivityEvent.id == event_id, ActivityEvent.status != "DELETED")
    ).scalar_one_or_none()


def _get_active_club(db: Session, club_id: int) -> Club | None:
    return db.execute(select(Club).where(Club.id == club_id, Club.status == "ACTIVE")).scalar_one_or_none()


def _get_club_not_deleted(db: Session, club_id: int) -> Club | None:
    return db.execute(select(Club).where(Club.id == club_id, Club.status != "DELETED")).scalar_one_or_none()


def _get_club_membership(db: Session, club_id: int, user_id: int) -> ClubMembership | None:
    return db.execute(
        select(ClubMembership).where(
            ClubMembership.club_id == club_id,
            ClubMembership.user_id == user_id,
        )
    ).scalar_one_or_none()


def _get_pending_membership_for_admin(
    db: Session, club_id: int, membership_id: int, actor_user_id: int
) -> tuple[ClubMembership, Club]:
    club = _get_active_club(db, club_id)
    if club is None:
        raise ValueError("Club not found")
    actor = _ensure_user_exists(db, actor_user_id)
    if not _user_is_club_admin(db, club, actor.id) and actor.role != Role.ADMIN.value:
        raise PermissionError("Only club admins can manage memberships")

    membership = db.execute(
        select(ClubMembership).where(
            ClubMembership.id == membership_id,
            ClubMembership.club_id == club.id,
        )
    ).scalar_one_or_none()
    if membership is None:
        raise ValueError("Membership not found")
    if membership.status != "PENDING":
        raise ValueError("Only pending memberships can be approved or rejected")
    return membership, club


def _pending_membership_to_response(membership: ClubMembership, user: User) -> ClubMembershipPendingResponse:
    return ClubMembershipPendingResponse(
        membershipId=membership.id,
        userId=user.id,
        userEmail=user.email,
        userFirstName=user.first_name,
        userLastName=user.last_name,
        role=membership.role,
        status=membership.status,
        joinedAt=membership.joined_at,
    )


def _list_announcements_for_event(db: Session, event_id: int) -> list[ActivityAnnouncement]:
    return db.execute(
        select(ActivityAnnouncement)
        .where(ActivityAnnouncement.event_id == event_id)
        .order_by(ActivityAnnouncement.created_at.desc())
    ).scalars().all()


def _list_announcements_for_club(db: Session, club_id: int) -> list[ActivityAnnouncement]:
    return db.execute(
        select(ActivityAnnouncement)
        .where(ActivityAnnouncement.club_id == club_id)
        .order_by(ActivityAnnouncement.created_at.desc())
    ).scalars().all()


def _persist_announcement(db: Session, ann: ActivityAnnouncement) -> AnnouncementResponse:
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return _announcement_to_response(ann)


def _user_is_global_admin(db: Session, user_id: int) -> bool:
    u = _get_user_by_id(db, user_id)
    return u is not None and u.role == Role.ADMIN.value


def _user_is_club_admin(db: Session, club: Club, user_id: int) -> bool:
    if club.created_by == user_id:
        return True
    row = db.execute(
        select(ClubMembership.id).where(
            ClubMembership.club_id == club.id,
            ClubMembership.user_id == user_id,
            ClubMembership.status == "APPROVED",
            ClubMembership.role == "CLUB_ADMIN",
        )
    ).scalar_one_or_none()
    return row is not None


def _viewer_club_membership_status(db: Session, club_id: int, viewer_id: int) -> str | None:
    row = db.execute(
        select(ClubMembership.status).where(
            ClubMembership.club_id == club_id,
            ClubMembership.user_id == viewer_id,
        )
    ).scalar_one_or_none()
    return str(row) if row is not None else None


def _user_can_read_club_announcements(db: Session, club_id: int, user_id: int) -> bool:
    if _user_is_global_admin(db, user_id):
        return True
    row = db.execute(
        select(ClubMembership.id).where(
            ClubMembership.club_id == club_id,
            ClubMembership.user_id == user_id,
            ClubMembership.status == "APPROVED",
        )
    ).scalar_one_or_none()
    return row is not None


def _announcement_to_response(item: ActivityAnnouncement) -> AnnouncementResponse:
    return AnnouncementResponse(
        id=item.id,
        title=item.title,
        body=item.body,
        eventId=item.event_id,
        clubId=item.club_id,
        createdBy=item.created_by,
        createdAt=item.created_at,
    )


def _ensure_organizer(db: Session, user_id: int) -> User:
    user = _get_user_by_id(db, user_id)
    if user is None:
        raise ValueError("User not found")
    if user.role in (Role.ORGANIZER.value, Role.ADMIN.value):
        return user
    if user.verification_status == VerificationStatus.APPROVED.value or user.is_verified:
        user.role = Role.ORGANIZER.value
        db.commit()
        db.refresh(user)
        return user
    raise PermissionError("Only verified organizers can create events or clubs")


def _ensure_user_exists(db: Session, user_id: int) -> User:
    user = _get_user_by_id(db, user_id)
    if user is None:
        raise ValueError("User not found")
    return user


def _get_event_participation(db: Session, event_id: int, user_id: int) -> EventParticipation | None:
    return db.execute(
        select(EventParticipation).where(
            EventParticipation.event_id == event_id,
            EventParticipation.user_id == user_id,
        )
    ).scalar_one_or_none()


def _user_can_access_event(db: Session, event: ActivityEvent, user_id: int) -> bool:
    user = _get_user_by_id(db, user_id)
    if user is None:
        return False
    if user.role == Role.ADMIN.value:
        return True
    if event.created_by == user_id:
        return True
    return _get_event_participation(db, event.id, user_id) is not None


def _event_to_response(
    item: ActivityEvent,
    viewer_id: int | None,
    participants_count: int,
    participating_ids: set[int],
) -> EventResponse:
    participating = item.id in participating_ids
    is_organizer = False
    if viewer_id is not None:
        participating = participating or item.created_by == viewer_id
        is_organizer = item.created_by == viewer_id
    return EventResponse(
        id=item.id,
        title=item.title,
        description=item.description,
        category=item.category,
        city=item.city,
        locationName=item.location_name,
        latitude=item.latitude,
        longitude=item.longitude,
        startsAt=item.starts_at,
        endsAt=item.ends_at,
        status=item.status,
        createdBy=item.created_by,
        createdAt=item.created_at,
        participantsCount=participants_count,
        participating=participating,
        isEventOrganizer=is_organizer,
    )


def _event_with_counts(db: Session, event: ActivityEvent, user_id: int) -> EventResponse:
    participants_count = db.execute(
        select(func.count(EventParticipation.id)).where(EventParticipation.event_id == event.id)
    ).scalar() or 0
    part_rows = db.execute(
        select(EventParticipation.event_id).where(EventParticipation.user_id == user_id)
    ).all()
    participating_ids = {int(r[0]) for r in part_rows}
    return _event_to_response(event, user_id, int(participants_count), participating_ids)


def _club_to_response(db: Session, item: Club, viewer_id: int | None) -> ClubResponse:
    is_club_admin = False
    membership_status: str | None = None
    if viewer_id is not None:
        is_club_admin = _user_is_club_admin(db, item, viewer_id) or _user_is_global_admin(db, viewer_id)
        membership_status = _viewer_club_membership_status(db, item.id, viewer_id)
    return ClubResponse(
        id=item.id,
        name=item.name,
        description=item.description,
        category=item.category,
        city=item.city,
        visibility=item.visibility,
        status=item.status,
        createdBy=item.created_by,
        createdAt=item.created_at,
        isClubAdmin=is_club_admin,
        membershipStatus=membership_status,
    )


def _club_with_counts(db: Session, club: Club, user_id: int) -> ClubResponse:
    members_count = db.execute(
        select(func.count(ClubMembership.id)).where(
            ClubMembership.club_id == club.id,
            ClubMembership.status.in_(("APPROVED", "PENDING")),
        )
    ).scalar() or 0
    joined = db.execute(
        select(ClubMembership.id).where(
            ClubMembership.club_id == club.id,
            ClubMembership.user_id == user_id,
            ClubMembership.status.in_(("APPROVED", "PENDING")),
        )
    ).scalar_one_or_none() is not None
    dto = _club_to_response(db, club, user_id)
    dto.membersCount = int(members_count)
    dto.joined = joined
    return dto


def _purge_club_data(db: Session, club_id: int) -> None:
    db.execute(
        update(ActivityChatMessage)
        .where(ActivityChatMessage.club_id == club_id)
        .values(in_reply_to_message_id=None)
    )
    db.execute(delete(ActivityChatMessage).where(ActivityChatMessage.club_id == club_id))
    db.execute(delete(ActivityAnnouncement).where(ActivityAnnouncement.club_id == club_id))
    db.execute(delete(ClubMembership).where(ClubMembership.club_id == club_id))


def _purge_event_data(db: Session, event_id: int) -> None:
    db.execute(
        update(ActivityChatMessage)
        .where(ActivityChatMessage.event_id == event_id)
        .values(in_reply_to_message_id=None)
    )
    db.execute(delete(ActivityChatMessage).where(ActivityChatMessage.event_id == event_id))
    db.execute(delete(ActivityAnnouncement).where(ActivityAnnouncement.event_id == event_id))
    db.execute(delete(EventParticipation).where(EventParticipation.event_id == event_id))
