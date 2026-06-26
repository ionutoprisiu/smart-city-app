from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db, get_optional_current_user_id
from app.core.security import create_access_token
from app.models.enums import Role, VerificationStatus
from app.schemas.activities import (
    AnnouncementCreateRequest,
    AnnouncementResponse,
    ClubCreateRequest,
    ClubMembershipPendingResponse,
    ClubResponse,
    EventCreateRequest,
    EventResponse,
)
from app.schemas.auth import AuthResponse
from app.services import activities_service

router = APIRouter(prefix="/activities", tags=["activities"])


def _raise_http(exc: Exception, *, value_error_status: int = 404) -> None:
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=value_error_status, detail=str(exc)) from exc
    if isinstance(exc, PermissionError):
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    raise exc


@router.post("/become-organizer", response_model=AuthResponse)
def become_organizer(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> AuthResponse:
    try:
        user = activities_service.become_organizer(db, current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc)
    return AuthResponse(
        userId=user.id,
        email=user.email,
        role=Role(user.role),
        firstName=user.first_name,
        lastName=user.last_name,
        isVerified=user.is_verified,
        verificationStatus=VerificationStatus(user.verification_status),
        accessToken=create_access_token(user.id),
        message="Organizer role enabled",
    )


@router.get("/events", response_model=list[EventResponse])
def list_events(
    db: Session = Depends(get_db),
    current_user_id: int | None = Depends(get_optional_current_user_id),
) -> list[EventResponse]:
    return activities_service.list_events(db, current_user_id)


@router.get("/events/mine", response_model=list[EventResponse])
def list_my_events(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> list[EventResponse]:
    try:
        return activities_service.list_my_events(db, current_user_id)
    except ValueError as exc:
        _raise_http(exc)


@router.post("/events", response_model=EventResponse)
def create_event(
    req: EventCreateRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> EventResponse:
    try:
        return activities_service.create_event(db, req, current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc, value_error_status=400)


@router.get("/events/{event_id}/announcements", response_model=list[AnnouncementResponse])
def list_event_announcements(
    event_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> list[AnnouncementResponse]:
    try:
        return activities_service.list_event_announcements(db, event_id, current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc)


@router.post("/events/{event_id}/announcements", response_model=AnnouncementResponse)
def create_event_announcement(
    event_id: int,
    req: AnnouncementCreateRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> AnnouncementResponse:
    try:
        return activities_service.create_event_announcement(db, event_id, req, current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc)


@router.post("/events/{event_id}/participate", response_model=EventResponse)
def participate_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> EventResponse:
    try:
        return activities_service.participate_event(db, event_id=event_id, user_id=current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc, value_error_status=400)


@router.post("/events/{event_id}/leave", response_model=EventResponse)
def leave_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> EventResponse:
    try:
        return activities_service.leave_event(db, event_id=event_id, user_id=current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc)


@router.post("/events/{event_id}/cancel", response_model=EventResponse)
def cancel_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> EventResponse:
    try:
        return activities_service.cancel_event(db, event_id=event_id, user_id=current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc)


@router.post("/events/{event_id}/delete", response_model=EventResponse)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> EventResponse:
    try:
        return activities_service.delete_event(db, event_id=event_id, user_id=current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc)


@router.get("/clubs", response_model=list[ClubResponse])
def list_clubs(
    db: Session = Depends(get_db),
    current_user_id: int | None = Depends(get_optional_current_user_id),
) -> list[ClubResponse]:
    return activities_service.list_clubs(db, current_user_id)


@router.get("/clubs/mine", response_model=list[ClubResponse])
def list_my_clubs(
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> list[ClubResponse]:
    try:
        return activities_service.list_my_clubs(db, current_user_id)
    except ValueError as exc:
        _raise_http(exc)


@router.post("/clubs", response_model=ClubResponse)
def create_club(
    req: ClubCreateRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ClubResponse:
    try:
        return activities_service.create_club(db, req, current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc, value_error_status=400)


@router.get("/clubs/{club_id}/announcements", response_model=list[AnnouncementResponse])
def list_club_announcements(
    club_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> list[AnnouncementResponse]:
    try:
        return activities_service.list_club_announcements(db, club_id, current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc)


@router.post("/clubs/{club_id}/announcements", response_model=AnnouncementResponse)
def create_club_announcement(
    club_id: int,
    req: AnnouncementCreateRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> AnnouncementResponse:
    try:
        return activities_service.create_club_announcement(db, club_id, req, current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc)


@router.post("/clubs/{club_id}/join", response_model=ClubResponse)
def join_club(
    club_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ClubResponse:
    try:
        return activities_service.join_club(db, club_id=club_id, user_id=current_user_id)
    except ValueError as exc:
        _raise_http(exc)


@router.post("/clubs/{club_id}/leave", response_model=ClubResponse)
def leave_club(
    club_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ClubResponse:
    try:
        return activities_service.leave_club(db, club_id=club_id, user_id=current_user_id)
    except ValueError as exc:
        _raise_http(exc)


@router.post("/clubs/{club_id}/delete", response_model=ClubResponse)
def delete_club(
    club_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ClubResponse:
    try:
        return activities_service.delete_club(db, club_id=club_id, user_id=current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc)


@router.get("/clubs/{club_id}/memberships/pending", response_model=list[ClubMembershipPendingResponse])
def list_pending_club_memberships(
    club_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> list[ClubMembershipPendingResponse]:
    try:
        return activities_service.list_pending_club_memberships(db, club_id, current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc)


@router.post("/clubs/{club_id}/memberships/{membership_id}/approve", response_model=ClubResponse)
def approve_club_membership(
    club_id: int,
    membership_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ClubResponse:
    try:
        return activities_service.approve_club_membership(db, club_id, membership_id, current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc, value_error_status=400)


@router.post("/clubs/{club_id}/memberships/{membership_id}/reject", response_model=ClubResponse)
def reject_club_membership(
    club_id: int,
    membership_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ClubResponse:
    try:
        return activities_service.reject_club_membership(db, club_id, membership_id, current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc, value_error_status=400)

