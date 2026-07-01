from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user_id, get_db
from app.schemas.chat import (
    ChatMessageDeleteResponse,
    ChatMessageEditRequest,
    ChatMessageResponse,
    ChatThreadResponse,
)
from app.services import chat_service

router = APIRouter(prefix="/api/v1", tags=["messages"])


@router.get("/events/{event_id}/messages", response_model=list[ChatMessageResponse])
def list_event_messages(
    event_id: int,
    threadUserId: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> list[ChatMessageResponse]:
    return chat_service.list_event_messages(db, event_id, current_user_id, threadUserId)


@router.get("/clubs/{club_id}/group-messages", response_model=list[ChatMessageResponse])
def list_club_group_messages(
    club_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> list[ChatMessageResponse]:
    return chat_service.list_club_group_messages(db, club_id, current_user_id)


@router.get("/clubs/{club_id}/messages", response_model=list[ChatMessageResponse])
def list_club_messages(
    club_id: int,
    threadUserId: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> list[ChatMessageResponse]:
    return chat_service.list_club_messages(db, club_id, current_user_id, threadUserId)


@router.get("/events/{event_id}/threads", response_model=list[ChatThreadResponse])
def list_event_threads(
    event_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> list[ChatThreadResponse]:
    return chat_service.list_event_threads(db, event_id, current_user_id)


@router.get("/clubs/{club_id}/threads", response_model=list[ChatThreadResponse])
def list_club_threads(
    club_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> list[ChatThreadResponse]:
    return chat_service.list_club_threads(db, club_id, current_user_id)


@router.post("/events/{event_id}/messages/{message_id}/approve", response_model=ChatMessageResponse)
def approve_event_auto_reply(
    event_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ChatMessageResponse:
    return chat_service.approve_event_auto_reply(db, event_id, message_id, current_user_id)


@router.post("/clubs/{club_id}/messages/{message_id}/approve", response_model=ChatMessageResponse)
def approve_club_auto_reply(
    club_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ChatMessageResponse:
    return chat_service.approve_club_auto_reply(db, club_id, message_id, current_user_id)


@router.post("/events/{event_id}/messages/{message_id}/reject", response_model=ChatMessageDeleteResponse)
def reject_event_auto_reply(
    event_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ChatMessageDeleteResponse:
    return chat_service.reject_event_auto_reply(db, event_id, message_id, current_user_id)


@router.post("/clubs/{club_id}/messages/{message_id}/reject", response_model=ChatMessageDeleteResponse)
def reject_club_auto_reply(
    club_id: int,
    message_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ChatMessageDeleteResponse:
    return chat_service.reject_club_auto_reply(db, club_id, message_id, current_user_id)


@router.post("/events/{event_id}/messages/{message_id}/edit", response_model=ChatMessageResponse)
def edit_event_auto_reply(
    event_id: int,
    message_id: int,
    payload: ChatMessageEditRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ChatMessageResponse:
    return chat_service.edit_event_auto_reply(db, event_id, message_id, current_user_id, payload.body)


@router.post("/clubs/{club_id}/messages/{message_id}/edit", response_model=ChatMessageResponse)
def edit_club_auto_reply(
    club_id: int,
    message_id: int,
    payload: ChatMessageEditRequest,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
) -> ChatMessageResponse:
    return chat_service.edit_club_auto_reply(db, club_id, message_id, current_user_id, payload.body)
