from __future__ import annotations

import asyncio
import logging
from typing import Any

import socketio

from app.chat.rooms import room_for_kind, room_for_thread
from app.common.exceptions import AppError
from app.core.security import user_id_from_token
from app.db.session import SessionLocal
from app.schemas.chat import AutoreplyOutcome, ChatMessageCreateRequest, ChatMessageDeleteResponse, ChatMessageResponse
from app.services import chat_service

log = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)


def _message_payload(msg: ChatMessageResponse) -> dict[str, Any]:
    return msg.model_dump(mode="json")


async def _emit_message(room: str, message: ChatMessageResponse) -> None:
    await sio.emit("chat:message", _message_payload(message), room=room)


async def _emit_post_result(room: str, result: Any) -> None:
    await _emit_message(room, result.message)
    if result.autoReply is not None:
        await _emit_message(room, result.autoReply)


async def _emit_message_deleted(room: str, payload: ChatMessageDeleteResponse) -> None:
    await sio.emit("chat:message_deleted", payload.model_dump(mode="json"), room=room)


def _room_for(kind: str, resource_id: int, thread_user_id: int | None) -> str:
    return (
        room_for_thread(kind, resource_id, thread_user_id)
        if thread_user_id is not None
        else room_for_kind(kind, resource_id)
    )


async def _emit_autoreply_status(
    kind: str, resource_id: int, thread_user_id: int | None, question_id: int, status: str
) -> None:
    # status: "pending" (LLM is trying) | "answered" (auto-reply emitted) | "none" (no answer found)
    await sio.emit(
        "chat:autoreply",
        {"questionId": question_id, "threadUserId": thread_user_id, "status": status},
        room=_room_for(kind, resource_id, thread_user_id),
    )


async def _run_autoreply_task(
    kind: str, resource_id: int, message_id: int, thread_user_id: int | None
) -> None:
    # LLM can be slow — don't block chat_send ack.

    def work() -> AutoreplyOutcome:
        db = SessionLocal()
        try:
            return chat_service.try_autoreply_after_post(db, kind, resource_id, message_id)
        except Exception:
            log.exception("Background auto-reply failed kind=%s id=%s msg=%s", kind, resource_id, message_id)
            return AutoreplyOutcome()
        finally:
            db.close()

    outcome = await asyncio.to_thread(work)
    if outcome.autoReply is None:
        await _emit_autoreply_status(kind, resource_id, thread_user_id, message_id, "none")
        return

    auto = outcome.autoReply
    room = _room_for(kind, resource_id, auto.threadUserId)
    await _emit_message(room, auto)
    await _emit_autoreply_status(kind, resource_id, auto.threadUserId, message_id, "answered")

    for deleted in outcome.pruned:
        delete_room = (
            room_for_thread(kind, resource_id, deleted.threadUserId)
            if deleted.threadUserId is not None
            else room_for_kind(kind, resource_id)
        )
        await _emit_message_deleted(delete_room, deleted)


async def _run_approve_task(kind: str, resource_id: int, message_id: int, user_id: int) -> ChatMessageResponse | None:
    def work() -> ChatMessageResponse:
        db = SessionLocal()
        try:
            if kind == "event":
                return chat_service.approve_event_auto_reply(db, resource_id, message_id, user_id)
            return chat_service.approve_club_auto_reply(db, resource_id, message_id, user_id)
        finally:
            db.close()

    try:
        approved = await asyncio.to_thread(work)
    except Exception:
        log.exception("chat_approve failed kind=%s id=%s msg=%s", kind, resource_id, message_id)
        return None

    room = (
        room_for_thread(kind, resource_id, approved.threadUserId)
        if approved.threadUserId is not None
        else room_for_kind(kind, resource_id)
    )
    await _emit_message(room, approved)
    return approved


async def _run_edit_task(
    kind: str, resource_id: int, message_id: int, user_id: int, body: str
) -> ChatMessageResponse | None:
    def work() -> ChatMessageResponse:
        db = SessionLocal()
        try:
            if kind == "event":
                return chat_service.edit_event_auto_reply(db, resource_id, message_id, user_id, body)
            return chat_service.edit_club_auto_reply(db, resource_id, message_id, user_id, body)
        finally:
            db.close()

    try:
        updated = await asyncio.to_thread(work)
    except Exception:
        log.exception("chat_edit failed kind=%s id=%s msg=%s", kind, resource_id, message_id)
        return None

    room = _room_for(kind, resource_id, updated.threadUserId)
    await _emit_message(room, updated)
    return updated


async def _run_reject_task(
    kind: str, resource_id: int, message_id: int, user_id: int
) -> ChatMessageDeleteResponse | None:
    def work() -> ChatMessageDeleteResponse:
        db = SessionLocal()
        try:
            if kind == "event":
                return chat_service.reject_event_auto_reply(db, resource_id, message_id, user_id)
            return chat_service.reject_club_auto_reply(db, resource_id, message_id, user_id)
        finally:
            db.close()

    try:
        deleted = await asyncio.to_thread(work)
    except Exception:
        log.exception("chat_reject failed kind=%s id=%s msg=%s", kind, resource_id, message_id)
        return None

    room = (
        room_for_thread(kind, resource_id, deleted.threadUserId)
        if deleted.threadUserId is not None
        else room_for_kind(kind, resource_id)
    )
    await _emit_message_deleted(room, deleted)
    return deleted


@sio.event
async def connect(sid: str, environ: dict, auth: dict | None) -> bool:
    token = (auth or {}).get("token") if isinstance(auth, dict) else None
    if not token or not isinstance(token, str):
        log.warning("Socket connect rejected: missing token sid=%s", sid)
        return False
    try:
        user_id = user_id_from_token(token)
    except Exception:
        log.warning("Socket connect rejected: invalid token sid=%s", sid)
        return False
    await sio.save_session(sid, {"user_id": user_id})
    return True


@sio.event
async def disconnect(sid: str) -> None:
    log.debug("Socket disconnected sid=%s", sid)


@sio.event
async def chat_join(sid: str, data: dict | None) -> dict[str, Any]:
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if user_id is None:
        return {"ok": False, "error": "Not authenticated"}

    kind = str((data or {}).get("kind", "")).lower()
    resource_id = (data or {}).get("resourceId")
    if kind not in ("event", "club") or resource_id is None:
        return {"ok": False, "error": "kind and resourceId are required"}

    requested_thread = (data or {}).get("threadUserId")
    scope = str((data or {}).get("scope", "support")).lower()
    resource_id = int(resource_id)
    db = SessionLocal()
    try:
        if kind == "event":
            chat_service.assert_can_join_event_chat(db, resource_id, int(user_id))
            thread_user_id = chat_service.resolve_thread_room_user(
                db,
                kind,
                resource_id,
                int(user_id),
                int(requested_thread) if requested_thread is not None else None,
            )
            room = (
                room_for_thread(kind, resource_id, thread_user_id)
                if thread_user_id is not None
                else None
            )
        else:
            if scope == "group":
                chat_service.assert_can_join_club_group_chat(db, resource_id, int(user_id))
                thread_user_id = None
                room = room_for_kind(kind, resource_id)
            else:
                chat_service.assert_can_join_club_chat(db, resource_id, int(user_id))
                thread_user_id = chat_service.resolve_thread_room_user(
                    db,
                    kind,
                    resource_id,
                    int(user_id),
                    int(requested_thread) if requested_thread is not None else None,
                )
                room = (
                    room_for_thread(kind, resource_id, thread_user_id)
                    if thread_user_id is not None
                    else None
                )
        # Organizer may switch between member threads.
        previous = session.get("room")
        if previous:
            await sio.leave_room(sid, previous)
        if room is not None:
            await sio.enter_room(sid, room)
        await sio.save_session(
            sid,
            {
                **session,
                "room": room,
                "kind": kind,
                "resourceId": resource_id,
                "threadUserId": thread_user_id,
                "scope": scope if kind == "club" else "support",
            },
        )
        return {"ok": True, "room": room, "threadUserId": thread_user_id, "scope": scope}
    except PermissionError as exc:
        return {"ok": False, "error": str(exc)}
    except AppError as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        db.close()


@sio.event
async def chat_leave(sid: str, data: dict | None) -> dict[str, Any]:
    session = await sio.get_session(sid)
    room = session.get("room")
    if room:
        await sio.leave_room(sid, room)
    cleared = {k: v for k, v in session.items() if k not in ("room", "kind", "resourceId", "threadUserId")}
    await sio.save_session(sid, cleared)
    return {"ok": True}


@sio.event
async def chat_send(sid: str, data: dict | None) -> dict[str, Any]:
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if user_id is None:
        return {"ok": False, "error": "Not authenticated"}

    payload = data or {}
    kind = str(payload.get("kind", session.get("kind", ""))).lower()
    resource_id = payload.get("resourceId", session.get("resourceId"))
    role = str(payload.get("role", "USER")).upper()
    body = str(payload.get("body", "")).strip()
    in_reply = payload.get("inReplyToMessageId")
    thread_user = payload.get("threadUserId", session.get("threadUserId"))

    if kind not in ("event", "club") or resource_id is None:
        return {"ok": False, "error": "kind and resourceId are required"}
    if not body:
        return {"ok": False, "error": "body is required"}

    resource_id = int(resource_id)
    req = ChatMessageCreateRequest(
        role=role,
        body=body,
        inReplyToMessageId=int(in_reply) if in_reply is not None else None,
        threadUserId=int(thread_user) if thread_user is not None else None,
    )

    db = SessionLocal()
    try:
        session_scope = str(session.get("scope", "support")).lower()
        if kind == "event":
            result = chat_service.post_event_message(db, resource_id, int(user_id), req)
        elif session_scope == "group":
            result = chat_service.post_club_group_message(db, resource_id, int(user_id), req)
        else:
            result = chat_service.post_club_message(db, resource_id, int(user_id), req)
        thread_id = result.message.threadUserId
        room = (
            room_for_thread(kind, resource_id, thread_id)
            if thread_id is not None
            else room_for_kind(kind, resource_id)
        )
        await _emit_message(room, result.message)
        if role == "USER" and not (kind == "club" and session_scope == "group"):
            await _emit_autoreply_status(kind, resource_id, thread_id, result.message.id, "pending")
            asyncio.create_task(_run_autoreply_task(kind, resource_id, result.message.id, thread_id))
        return {"ok": True, "messageId": result.message.id, "threadUserId": thread_id}
    except PermissionError as exc:
        return {"ok": False, "error": str(exc)}
    except AppError as exc:
        return {"ok": False, "error": str(exc)}
    except Exception:
        log.exception("chat_send failed sid=%s", sid)
        return {"ok": False, "error": "Could not send message"}
    finally:
        db.close()


@sio.event
async def chat_approve(sid: str, data: dict | None) -> dict[str, Any]:
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if user_id is None:
        return {"ok": False, "error": "Not authenticated"}

    payload = data or {}
    kind = str(payload.get("kind", session.get("kind", ""))).lower()
    resource_id = payload.get("resourceId", session.get("resourceId"))
    message_id = payload.get("messageId")

    if kind not in ("event", "club") or resource_id is None or message_id is None:
        return {"ok": False, "error": "kind, resourceId, and messageId are required"}

    approved = await _run_approve_task(kind, int(resource_id), int(message_id), int(user_id))
    if approved is None:
        return {"ok": False, "error": "Could not approve auto-reply"}
    return {"ok": True, "messageId": approved.id}


@sio.event
async def chat_edit(sid: str, data: dict | None) -> dict[str, Any]:
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if user_id is None:
        return {"ok": False, "error": "Not authenticated"}

    payload = data or {}
    kind = str(payload.get("kind", session.get("kind", ""))).lower()
    resource_id = payload.get("resourceId", session.get("resourceId"))
    message_id = payload.get("messageId")
    body = str(payload.get("body", "")).strip()

    if kind not in ("event", "club") or resource_id is None or message_id is None:
        return {"ok": False, "error": "kind, resourceId, and messageId are required"}
    if not body:
        return {"ok": False, "error": "body is required"}

    updated = await _run_edit_task(kind, int(resource_id), int(message_id), int(user_id), body)
    if updated is None:
        return {"ok": False, "error": "Could not edit auto-reply"}
    return {"ok": True, "messageId": updated.id}


@sio.event
async def chat_reject(sid: str, data: dict | None) -> dict[str, Any]:
    session = await sio.get_session(sid)
    user_id = session.get("user_id")
    if user_id is None:
        return {"ok": False, "error": "Not authenticated"}

    payload = data or {}
    kind = str(payload.get("kind", session.get("kind", ""))).lower()
    resource_id = payload.get("resourceId", session.get("resourceId"))
    message_id = payload.get("messageId")

    if kind not in ("event", "club") or resource_id is None or message_id is None:
        return {"ok": False, "error": "kind, resourceId, and messageId are required"}

    deleted = await _run_reject_task(kind, int(resource_id), int(message_id), int(user_id))
    if deleted is None:
        return {"ok": False, "error": "Could not reject auto-reply"}
    return {
        "ok": True,
        "messageId": deleted.messageId,
        "inReplyToMessageId": deleted.inReplyToMessageId,
    }
