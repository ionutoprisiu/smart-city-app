from __future__ import annotations


def room_for_event(event_id: int) -> str:
    return f"event:{event_id}"


def room_for_club(club_id: int) -> str:
    return f"club:{club_id}"


def room_for_kind(kind: str, resource_id: int) -> str:
    normalized = kind.strip().lower()
    if normalized == "event":
        return room_for_event(resource_id)
    if normalized == "club":
        return room_for_club(resource_id)
    raise ValueError("kind must be 'event' or 'club'")
