from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.activity_chat_message import ActivityChatMessage
from app.schemas.chat import ChatMessageDeleteResponse
from app.schemas.support import SupportQaCandidate
from app.services.support_matching import (
    MIN_AUTO_REPLY_CONFIDENCE,
    _intents_compatible,
    _overlap_score,
    match_history,
)


def find_superseded_question_ids(
    new_question_body: str,
    new_question_id: int,
    pairs: list[dict],
) -> list[int]:
    """Older USER question ids that repeat the same idea as the new question."""
    old_pairs = [pair for pair in pairs if pair["questionId"] != new_question_id]
    if not old_pairs:
        return []

    candidates = [
        SupportQaCandidate(
            questionId=pair["questionId"],
            question=pair["questionBody"],
            answer=pair["answerBody"],
            questionAt=pair.get("questionAt"),
            answerAt=pair.get("answerAt"),
        )
        for pair in old_pairs
    ]
    match = match_history(new_question_body, candidates)
    if match.matchedQuestionId is None or match.confidence < MIN_AUTO_REPLY_CONFIDENCE:
        return []

    superseded = {match.matchedQuestionId}
    anchor_body = next(
        pair["questionBody"] for pair in old_pairs if pair["questionId"] == match.matchedQuestionId
    )
    for pair in old_pairs:
        question_id = pair["questionId"]
        if question_id in superseded:
            continue
        if not _intents_compatible(new_question_body, pair["questionBody"]):
            continue
        if _overlap_score(new_question_body, pair["questionBody"]) < 0.12:
            continue
        if _overlap_score(anchor_body, pair["questionBody"]) < 0.12:
            continue
        superseded.add(question_id)

    return sorted(superseded)


def prune_superseded_qa_pairs(
    db: Session,
    *,
    new_question_id: int,
    new_question_body: str,
    pairs: list[dict],
    event_id: int | None = None,
    club_id: int | None = None,
) -> list[ChatMessageDeleteResponse]:
    if (event_id is None) == (club_id is None):
        raise ValueError("Exactly one context is required")

    question_ids = find_superseded_question_ids(new_question_body, new_question_id, pairs)
    if not question_ids:
        return []

    context = (
        ActivityChatMessage.event_id == event_id
        if event_id is not None
        else ActivityChatMessage.club_id == club_id
    )

    deleted: list[ChatMessageDeleteResponse] = []
    for question_id in question_ids:
        answers = db.execute(
            select(ActivityChatMessage).where(
                context,
                ActivityChatMessage.in_reply_to_message_id == question_id,
            )
        ).scalars().all()
        for answer in answers:
            deleted.append(
                ChatMessageDeleteResponse(
                    messageId=answer.id,
                    inReplyToMessageId=answer.in_reply_to_message_id,
                    threadUserId=answer.thread_user_id,
                )
            )
            db.delete(answer)

        question = db.execute(
            select(ActivityChatMessage).where(
                context,
                ActivityChatMessage.id == question_id,
                ActivityChatMessage.role == "USER",
            )
        ).scalar_one_or_none()
        if question is None:
            continue
        deleted.append(
            ChatMessageDeleteResponse(
                messageId=question.id,
                inReplyToMessageId=question.in_reply_to_message_id,
                threadUserId=question.thread_user_id,
            )
        )
        db.delete(question)

    return deleted

