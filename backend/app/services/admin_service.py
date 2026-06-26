from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from app.models.activity_announcement import ActivityAnnouncement
from app.models.activity_chat_message import ActivityChatMessage
from app.models.activity_event import ActivityEvent
from app.models.club import Club
from app.models.event_participation import EventParticipation
from app.models.club_membership import ClubMembership
from app.models.enums import Role, VerificationStatus
from app.models.user import User
from app.schemas.admin import (
    AdminUserItem,
    AdminUserListResponse,
    AdminUserUpdateRequest,
    AdminVerificationItem,
    AdminVerificationListResponse,
)
from app.services import verification_storage
from app.services.activities_service import _purge_club_data, _purge_event_data

_REVIEWABLE = frozenset(
    {
        VerificationStatus.MANUAL_REVIEW.value,
        VerificationStatus.REJECTED.value,
    }
)
_LISTABLE = frozenset(
    {
        VerificationStatus.MANUAL_REVIEW.value,
        VerificationStatus.REJECTED.value,
        VerificationStatus.APPROVED.value,
    }
)


def list_verifications(
    db: Session,
    *,
    status: VerificationStatus | None = None,
) -> AdminVerificationListResponse:
    query = select(User).where(
        User.verification_status.in_(_LISTABLE),
        User.role != Role.ADMIN.value,
    )
    if status is not None:
        query = query.where(User.verification_status == status.value)
    rows = db.execute(
        query.order_by(User.created_at.asc().nulls_last(), User.id.asc())
    ).scalars().all()
    return AdminVerificationListResponse(items=[_verification_item(user) for user in rows])


def list_pending_verifications(db: Session) -> AdminVerificationListResponse:
    return list_verifications(db, status=VerificationStatus.MANUAL_REVIEW)


def approve_verification(db: Session, user_id: int) -> AdminVerificationItem:
    user = _get_user_for_review(db, user_id)
    now = datetime.now()
    user.verification_status = VerificationStatus.APPROVED.value
    user.is_verified = True
    user.is_approved = True
    user.verified_at = now
    user.verification_reason = "Approved by admin"
    if user.role != Role.ADMIN.value:
        user.role = Role.ORGANIZER.value
    db.commit()
    db.refresh(user)
    return _verification_item(user)


def reject_verification(db: Session, user_id: int, reason: str | None) -> AdminVerificationItem:
    user = _get_user_for_review(db, user_id)
    user.verification_status = VerificationStatus.REJECTED.value
    user.is_verified = False
    user.is_approved = False
    user.verification_reason = (reason or "").strip() or "Rejected by admin"
    db.commit()
    db.refresh(user)
    return _verification_item(user)


def allow_resubmit(db: Session, user_id: int) -> AdminVerificationItem:
    user = _get_user_or_raise(db, user_id)
    if user.role in (Role.ADMIN.value, Role.ORGANIZER.value):
        raise ValueError("Organizers cannot resubmit verification")
    if user.verification_status != VerificationStatus.REJECTED.value:
        raise ValueError("Only rejected verifications can be reopened for resubmission")
    user.verification_status = VerificationStatus.NOT_SUBMITTED.value
    user.verification_reason = "Admin allowed a new submission"
    db.commit()
    db.refresh(user)
    return _verification_item(user)


def list_users(db: Session, *, limit: int = 200) -> AdminUserListResponse:
    rows = db.execute(select(User).order_by(User.id.desc()).limit(limit)).scalars().all()
    items = [
        AdminUserItem(
            userId=user.id,
            email=user.email,
            firstName=user.first_name,
            lastName=user.last_name,
            role=Role(user.role),
            verificationStatus=_verification_status(user.verification_status),
            isVerified=user.is_verified,
        )
        for user in rows
    ]
    return AdminUserListResponse(items=items)


def promote_to_organizer(db: Session, user_id: int) -> AdminUserItem:
    user = _get_user_or_raise(db, user_id)
    if user.role == Role.ADMIN.value:
        raise ValueError("Cannot change role for admin user")
    if user.verification_status != VerificationStatus.APPROVED.value or not user.is_verified:
        raise ValueError("User must complete identity verification before becoming organizer")
    user.role = Role.ORGANIZER.value
    db.commit()
    db.refresh(user)
    return _user_item(user)


def demote_to_user(db: Session, user_id: int) -> AdminUserItem:
    user = _get_user_or_raise(db, user_id)
    if user.role == Role.ADMIN.value:
        raise ValueError("Cannot change role for admin user")
    if user.role != Role.ORGANIZER.value:
        raise ValueError("Only organizers can be demoted to a regular user")
    user.role = Role.USER.value
    _clear_verification_state(
        user,
        reason="Organizer role removed; identity verification required again",
    )
    db.commit()
    db.refresh(user)
    return _user_item(user)


def reset_user_verification(db: Session, user_id: int) -> AdminUserItem:
    user = _get_user_or_raise(db, user_id)
    if user.role == Role.ADMIN.value:
        raise ValueError("Cannot reset verification for admin user")
    if user.role == Role.ORGANIZER.value:
        raise ValueError("Demote organizer to user before resetting verification")
    if user.verification_status == VerificationStatus.NOT_SUBMITTED.value and not user.is_verified:
        raise ValueError("User verification is already reset")
    _clear_verification_state(
        user,
        reason="Admin reset verification; new submission required",
    )
    db.commit()
    db.refresh(user)
    return _user_item(user)


def update_user(
    db: Session,
    user_id: int,
    body: AdminUserUpdateRequest,
    actor_admin_id: int,
) -> AdminUserItem:
    user = _get_user_or_raise(db, user_id)
    if body.role is not None and user.id == actor_admin_id:
        raise ValueError("Cannot change your own role")
    if body.email is not None:
        email = body.email.strip().lower()
        if not email:
            raise ValueError("Email is required")
        existing = db.execute(
            select(User).where(User.email == email, User.id != user_id)
        ).scalar_one_or_none()
        if existing is not None:
            raise ValueError("Email already in use")
        user.email = email
    if body.firstName is not None:
        user.first_name = body.firstName.strip()
    if body.lastName is not None:
        user.last_name = body.lastName.strip()
    if body.firstName is not None or body.lastName is not None:
        user.name = f"{user.first_name} {user.last_name}".strip()
    if body.role is not None:
        if user.role == Role.ADMIN.value:
            raise ValueError("Cannot change admin role")
        if body.role == Role.ADMIN:
            raise ValueError("Cannot promote to admin")
        if body.role == Role.ORGANIZER:
            if user.verification_status != VerificationStatus.APPROVED.value or not user.is_verified:
                raise ValueError("User must be verified before becoming organizer")
            user.role = Role.ORGANIZER.value
        elif body.role == Role.USER:
            if user.role == Role.ORGANIZER.value:
                _clear_verification_state(
                    user,
                    reason="Organizer role removed; identity verification required again",
                )
            user.role = Role.USER.value
    db.commit()
    db.refresh(user)
    return _user_item(user)


def delete_user(db: Session, user_id: int, actor_admin_id: int) -> None:
    user = _get_user_or_raise(db, user_id)
    if user.id == actor_admin_id:
        raise ValueError("Cannot delete your own account")
    if user.role == Role.ADMIN.value:
        raise ValueError("Cannot delete admin user")
    _purge_user_associations(db, user_id)
    verification_storage.delete_user_files(user_id)
    db.delete(user)
    db.commit()


def _purge_user_associations(db: Session, user_id: int) -> None:
    events = db.execute(
        select(ActivityEvent).where(ActivityEvent.created_by == user_id)
    ).scalars().all()
    for event in events:
        _purge_event_data(db, event.id)
        db.delete(event)

    clubs = db.execute(select(Club).where(Club.created_by == user_id)).scalars().all()
    for club in clubs:
        _purge_club_data(db, club.id)
        db.delete(club)

    db.execute(delete(ActivityAnnouncement).where(ActivityAnnouncement.created_by == user_id))

    message_ids = db.execute(
        select(ActivityChatMessage.id).where(
            or_(
                ActivityChatMessage.sender_user_id == user_id,
                ActivityChatMessage.thread_user_id == user_id,
            )
        )
    ).scalars().all()
    if message_ids:
        db.execute(
            update(ActivityChatMessage)
            .where(ActivityChatMessage.in_reply_to_message_id.in_(message_ids))
            .values(in_reply_to_message_id=None)
        )
    db.execute(
        delete(ActivityChatMessage).where(
            or_(
                ActivityChatMessage.sender_user_id == user_id,
                ActivityChatMessage.thread_user_id == user_id,
            )
        )
    )
    db.execute(delete(ClubMembership).where(ClubMembership.user_id == user_id))
    db.execute(delete(EventParticipation).where(EventParticipation.user_id == user_id))


def _clear_verification_state(user: User, *, reason: str) -> None:
    user.verification_status = VerificationStatus.NOT_SUBMITTED.value
    user.is_verified = False
    user.is_approved = False
    user.verified_at = None
    user.verification_score = None
    user.verification_reason = reason


def _user_item(user: User) -> AdminUserItem:
    return AdminUserItem(
        userId=user.id,
        email=user.email,
        firstName=user.first_name,
        lastName=user.last_name,
        role=Role(user.role),
        verificationStatus=_verification_status(user.verification_status),
        isVerified=user.is_verified,
    )


def _get_user_for_review(db: Session, user_id: int) -> User:
    user = _get_user_or_raise(db, user_id)
    if user.verification_status not in _REVIEWABLE:
        raise ValueError("Only pending or rejected verifications can be reviewed")
    return user


def _get_user_or_raise(db: Session, user_id: int) -> User:
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")
    return user


def _verification_item(user: User) -> AdminVerificationItem:
    id_card_url, selfie_url = verification_storage.document_urls(user.id)
    return AdminVerificationItem(
        userId=user.id,
        email=user.email,
        firstName=user.first_name,
        lastName=user.last_name,
        verificationStatus=_verification_status(user.verification_status),
        verificationScore=user.verification_score,
        verificationReason=user.verification_reason,
        idCardImageUrl=id_card_url or user.id_card_image_url,
        faceImageUrl=selfie_url or user.face_image_url,
        createdAt=user.created_at,
    )


def _verification_status(raw: str) -> VerificationStatus:
    try:
        return VerificationStatus(raw)
    except ValueError:
        return VerificationStatus.REJECTED
