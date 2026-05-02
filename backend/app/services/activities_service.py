from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.activity_event import ActivityEvent
from app.models.club import Club
from app.models.club_membership import ClubMembership
from app.models.enums import Role, VerificationStatus
from app.models.user import User
from app.schemas.activities import (
    ClubCreateRequest,
    ClubResponse,
    EventCreateRequest,
    EventResponse,
)


def become_organizer(db: Session, user_id: int) -> User:
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")
    if user.verification_status != VerificationStatus.APPROVED.value and not user.is_verified:
        raise ValueError("Verification required to become organizer")
    if user.role != Role.ADMIN.value:
        user.role = Role.ORGANIZER.value
    db.commit()
    db.refresh(user)
    return user


def list_events(db: Session) -> list[EventResponse]:
    rows = db.execute(
        select(ActivityEvent).where(ActivityEvent.status != "DELETED").order_by(ActivityEvent.starts_at.asc())
    ).scalars().all()
    return [_event_to_response(r) for r in rows]


def list_my_events(db: Session, user_id: int) -> list[EventResponse]:
    _ensure_user_exists(db, user_id)
    rows = db.execute(
        select(ActivityEvent)
        .where(
            ActivityEvent.created_by == user_id,
            ActivityEvent.status != "DELETED",
        )
        .order_by(ActivityEvent.starts_at.asc())
    ).scalars().all()
    return [_event_to_response(r) for r in rows]


def create_event(db: Session, req: EventCreateRequest) -> EventResponse:
    user = _ensure_organizer(db, req.creatorUserId)
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
    db.commit()
    db.refresh(item)
    return _event_to_response(item)


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
        dto = _club_to_response(club)
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


def create_club(db: Session, req: ClubCreateRequest) -> ClubResponse:
    user = _ensure_organizer(db, req.creatorUserId)
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

    # Creator is automatically an approved club admin.
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
    dto = _club_to_response(club)
    dto.membersCount = 1
    dto.joined = True
    return dto


def join_club(db: Session, club_id: int, user_id: int) -> ClubResponse:
    club = db.execute(select(Club).where(Club.id == club_id, Club.status == "ACTIVE")).scalar_one_or_none()
    if club is None:
        raise ValueError("Club not found")
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")

    existing = db.execute(
        select(ClubMembership).where(
            ClubMembership.club_id == club.id,
            ClubMembership.user_id == user_id,
        )
    ).scalar_one_or_none()
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


def cancel_event(db: Session, event_id: int, user_id: int) -> EventResponse:
    user = _ensure_user_exists(db, user_id)
    event = db.execute(
        select(ActivityEvent).where(
            ActivityEvent.id == event_id,
            ActivityEvent.status != "DELETED",
        )
    ).scalar_one_or_none()
    if event is None:
        raise ValueError("Event not found")
    if event.created_by != user.id and user.role != Role.ADMIN.value:
        raise PermissionError("Only the event creator can cancel this event")
    event.status = "CANCELLED"
    db.commit()
    db.refresh(event)
    return _event_to_response(event)


def leave_club(db: Session, club_id: int, user_id: int) -> ClubResponse:
    _ensure_user_exists(db, user_id)
    club = db.execute(select(Club).where(Club.id == club_id, Club.status == "ACTIVE")).scalar_one_or_none()
    if club is None:
        raise ValueError("Club not found")
    membership = db.execute(
        select(ClubMembership).where(
            ClubMembership.club_id == club.id,
            ClubMembership.user_id == user_id,
        )
    ).scalar_one_or_none()
    if membership is None:
        return _club_with_counts(db, club, user_id)
    db.delete(membership)
    db.commit()
    return _club_with_counts(db, club, user_id)


def _ensure_organizer(db: Session, user_id: int) -> User:
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
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
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")
    return user


def _event_to_response(item: ActivityEvent) -> EventResponse:
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
    )


def _club_to_response(item: Club) -> ClubResponse:
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
    dto = _club_to_response(club)
    dto.membersCount = int(members_count)
    dto.joined = joined
    return dto
