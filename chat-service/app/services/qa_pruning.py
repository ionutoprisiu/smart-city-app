from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas.chat import ChatMessageDeleteResponse


def prune_superseded_qa_pairs(
    db: Session,
    *,
    new_question_id: int,
    new_question_body: str,
    pairs: list[dict],
    event_id: int | None = None,
    club_id: int | None = None,
) -> list[ChatMessageDeleteResponse]:
    return []
