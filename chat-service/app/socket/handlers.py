from __future__ import annotations

import logging
from typing import Any

import socketio

from app.chat.rooms import room_for_kind
from app.core.security import user_id_from_token
from app.db.session import SessionLocal
from app.schemas.chat import ChatMessageCreateRequest, ChatMessageResponse
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


async def _emit_post_result(room: str, result: Any) -> None:
    await sio.emit("chat:message", _message_payload(result.message), room=room)
    if result.autoReply is not None:
        await sio.emit("chat:message", _message_payload(result.autoReply), room=room)


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

    resource_id = int(resource_id)
    db = SessionLocal()
    try:
        if kind == "event":
            chat_service.assert_can_join_event_chat(db, resource_id, int(user_id))
        else:
            chat_service.assert_can_join_club_chat(db, resource_id, int(user_id))
        room = room_for_kind(kind, resource_id)
        await sio.enter_room(sid, room)
        await sio.save_session(sid, {**session, "room": room, "kind": kind, "resourceId": resource_id})
        return {"ok": True, "room": room}
    except PermissionError as exc:
        return {"ok": False, "error": str(exc)}
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        db.close()


@sio.event
async def chat_leave(sid: str, data: dict | None) -> dict[str, Any]:
    session = await sio.get_session(sid)
    kind = str((data or {}).get("kind", session.get("kind", ""))).lower()
    resource_id = (data or {}).get("resourceId", session.get("resourceId"))
    if kind in ("event", "club") and resource_id is not None:
        room = room_for_kind(kind, int(resource_id))
        await sio.leave_room(sid, room)
    cleared = {k: v for k, v in session.items() if k not in ("room", "kind", "resourceId")}
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

    if kind not in ("event", "club") or resource_id is None:
        return {"ok": False, "error": "kind and resourceId are required"}
    if not body:
        return {"ok": False, "error": "body is required"}

    resource_id = int(resource_id)
    room = room_for_kind(kind, resource_id)
    req = ChatMessageCreateRequest(
        role=role,
        body=body,
        inReplyToMessageId=int(in_reply) if in_reply is not None else None,
    )

    db = SessionLocal()
    try:
        if kind == "event":
            result = chat_service.post_event_message(db, resource_id, int(user_id), req)
        else:
            result = chat_service.post_club_message(db, resource_id, int(user_id), req)
        await _emit_post_result(room, result)
        return {"ok": True, "messageId": result.message.id}
    except PermissionError as exc:
        return {"ok": False, "error": str(exc)}
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}
    finally:
        db.close()
