from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.activities import (
    BecomeOrganizerRequest,
    ClubCreateRequest,
    ClubJoinRequest,
    ClubResponse,
    EventCreateRequest,
    EventResponse,
    UserActorRequest,
)
from app.schemas.auth import AuthResponse
from app.services import activities_service

router = APIRouter(prefix="/activities", tags=["activities"])


@router.post("/become-organizer", response_model=AuthResponse)
def become_organizer(req: BecomeOrganizerRequest, db: Session = Depends(get_db)) -> AuthResponse:
    try:
        user = activities_service.become_organizer(db, req.userId)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    return AuthResponse(
        userId=user.id,
        email=user.email,
        role=user.role,
        firstName=user.first_name,
        lastName=user.last_name,
        isVerified=user.is_verified,
        verificationStatus=user.verification_status,
        message="Organizer role enabled",
    )


@router.get("/events", response_model=list[EventResponse])
def list_events(db: Session = Depends(get_db)) -> list[EventResponse]:
    return activities_service.list_events(db)


@router.get("/events/mine", response_model=list[EventResponse])
def list_my_events(
    userId: int = Query(...),
    db: Session = Depends(get_db),
) -> list[EventResponse]:
    try:
        return activities_service.list_my_events(db, userId)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/events", response_model=EventResponse)
def create_event(req: EventCreateRequest, db: Session = Depends(get_db)) -> EventResponse:
    try:
        return activities_service.create_event(db, req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/events/{event_id}/cancel", response_model=EventResponse)
def cancel_event(event_id: int, req: UserActorRequest, db: Session = Depends(get_db)) -> EventResponse:
    try:
        return activities_service.cancel_event(db, event_id=event_id, user_id=req.userId)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.get("/clubs", response_model=list[ClubResponse])
def list_clubs(
    userId: int | None = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ClubResponse]:
    return activities_service.list_clubs(db, userId)


@router.get("/clubs/mine", response_model=list[ClubResponse])
def list_my_clubs(
    userId: int = Query(...),
    db: Session = Depends(get_db),
) -> list[ClubResponse]:
    try:
        return activities_service.list_my_clubs(db, userId)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/clubs", response_model=ClubResponse)
def create_club(req: ClubCreateRequest, db: Session = Depends(get_db)) -> ClubResponse:
    try:
        return activities_service.create_club(db, req)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@router.post("/clubs/{club_id}/join", response_model=ClubResponse)
def join_club(club_id: int, req: ClubJoinRequest, db: Session = Depends(get_db)) -> ClubResponse:
    try:
        return activities_service.join_club(db, club_id=club_id, user_id=req.userId)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/clubs/{club_id}/leave", response_model=ClubResponse)
def leave_club(club_id: int, req: UserActorRequest, db: Session = Depends(get_db)) -> ClubResponse:
    try:
        return activities_service.leave_club(db, club_id=club_id, user_id=req.userId)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
