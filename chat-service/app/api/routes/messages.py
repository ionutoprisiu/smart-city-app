from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.schemas.chat import ChatMessageResponse
from app.services import chat_service

router = APIRouter(prefix="/api/v1", tags=["messages"])


def _raise_http(exc: Exception) -> None:
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, PermissionError):
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    raise exc


@router.get("/events/{event_id}/messages", response_model=list[ChatMessageResponse])
def list_event_messages(
    event_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> list[ChatMessageResponse]:
    try:
        return chat_service.list_event_messages(db, event_id, current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc)


@router.get("/clubs/{club_id}/messages", response_model=list[ChatMessageResponse])
def list_club_messages(
    club_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> list[ChatMessageResponse]:
    try:
        return chat_service.list_club_messages(db, club_id, current_user_id)
    except (ValueError, PermissionError) as exc:
        _raise_http(exc)
