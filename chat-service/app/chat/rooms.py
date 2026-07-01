from __future__ import annotations


def room_for_kind(kind: str, resource_id: int) -> str:
    normalized = kind.strip().lower()
    if normalized == "event":
        return f"event:{resource_id}"
    if normalized == "club":
        return f"club:{resource_id}"
    raise ValueError("kind must be 'event' or 'club'")


def room_for_thread(kind: str, resource_id: int, thread_user_id: int) -> str:
    return f"{room_for_kind(kind, resource_id)}:user:{thread_user_id}"
