from __future__ import annotations

import json
import logging
import re
from datetime import datetime

from app.core.config import settings
from app.schemas.support import SupportMatchResponse, SupportQaCandidate

log = logging.getLogger(__name__)

HTTP_TIMEOUT_SECONDS = 120.0


def _tokenize(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z0-9ăâîșțĂÂÎȘȚ]+", text.lower())
    return {t for t in tokens if len(t) > 2}


def _overlap_score(message: str, question: str) -> float:
    target = _tokenize(message)
    base = _tokenize(question)
    if not target or not base:
        return 0.0
    inter = len(target.intersection(base))
    union = len(target.union(base))
    return inter / union if union else 0.0


def _answer_at_key(candidate: SupportQaCandidate) -> datetime:
    if candidate.answerAt is not None:
        return candidate.answerAt
    if candidate.questionAt is not None:
        return candidate.questionAt
    return datetime.min


def _sort_candidates_newest_first(candidates: list[SupportQaCandidate]) -> list[SupportQaCandidate]:
    return sorted(candidates, key=_answer_at_key, reverse=True)


def _lexical_fallback(message: str, candidates: list[SupportQaCandidate]) -> SupportMatchResponse:
    if not candidates:
        return SupportMatchResponse(matchedQuestionId=None, confidence=0.0, reason="No history in this context")
    target = _tokenize(message)
    if not target:
        return SupportMatchResponse(matchedQuestionId=None, confidence=0.0, reason="Question too short")
    best_id: int | None = None
    best_score = 0.0
    best_overlap = 0
    best_answer_at = datetime.min
    for c in candidates:
        score = _overlap_score(message, c.question)
        overlap = len(target.intersection(_tokenize(c.question)))
        answer_at = _answer_at_key(c)
        if score > best_score or (
            score == best_score and score > 0 and answer_at > best_answer_at
        ):
            best_score = score
            best_id = c.questionId
            best_overlap = overlap
            best_answer_at = answer_at
    if best_id is not None and (best_score >= 0.10 or best_overlap >= 1):
        return SupportMatchResponse(
            matchedQuestionId=best_id,
            confidence=best_score,
            reason="Matched by lexical similarity (newest answer when tied)",
        )
    return SupportMatchResponse(matchedQuestionId=None, confidence=best_score, reason="No close lexical match")


def _build_client():
    from openai import OpenAI

    return OpenAI(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url.rstrip("/"),
        timeout=HTTP_TIMEOUT_SECONDS,
    )


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    return dt.isoformat()


def _llm_match(message: str, candidates: list[SupportQaCandidate]) -> SupportMatchResponse:
    if not candidates:
        return SupportMatchResponse(matchedQuestionId=None, confidence=0.0, reason="No history in this context")
    ordered = _sort_candidates_newest_first(candidates)
    entries = [
        {
            "questionId": c.questionId,
            "question": c.question,
            "answer": c.answer,
            "questionAt": _iso(c.questionAt),
            "answerAt": _iso(c.answerAt),
        }
        for c in ordered[:80]
    ]
    prompt = (
        "Task: decide if NEW_QUESTION is semantically equivalent to one previous user question.\n"
        "If yes, return that questionId; if not, return null.\n"
        "Rules:\n"
        "- only match if intent is really the same in this event/club context\n"
        "- ignore wording differences and typos\n"
        "- if several history items match the same intent, return the questionId whose answerAt is MOST RECENT "
        "(factual details such as time, place, or price may have changed)\n"
        "- if uncertain, return null\n"
        "Return strict JSON: {\"matchedQuestionId\": int|null, \"confidence\": 0..1, \"reason\": \"...\"}\n\n"
        f"NEW_QUESTION:\n{message}\n\n"
        f"HISTORY (newest answers first):\n{json.dumps(entries, ensure_ascii=False)}"
    )
    client = _build_client()
    completion = client.chat.completions.create(
        model=settings.llm_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.0,
        max_tokens=180,
    )
    text = (completion.choices[0].message.content or "").strip()
    data = json.loads(text)
    matched = data.get("matchedQuestionId")
    confidence = float(data.get("confidence") or 0.0)
    reason = str(data.get("reason") or "")
    if matched is not None:
        matched = int(matched)
    return SupportMatchResponse(matchedQuestionId=matched, confidence=confidence, reason=reason)


def _prefer_newest_among_similar(
    message: str,
    candidates: list[SupportQaCandidate],
    preferred_question_id: int | None,
) -> SupportMatchResponse:
    """If LLM picked an older thread, still prefer the newest answer among similar questions."""
    if not candidates:
        return SupportMatchResponse(matchedQuestionId=None, confidence=0.0, reason="No candidates")
    scored = [(_overlap_score(message, c.question), c) for c in candidates]
    preferred_score = 0.0
    if preferred_question_id is not None:
        preferred_score = next((s for s, c in scored if c.questionId == preferred_question_id), 0.0)
    threshold = max(0.10, preferred_score * 0.85) if preferred_score > 0 else 0.10
    eligible = [c for s, c in scored if s >= threshold]
    if not eligible:
        if preferred_question_id is not None:
            chosen = next((c for c in candidates if c.questionId == preferred_question_id), None)
            if chosen is not None:
                return SupportMatchResponse(
                    matchedQuestionId=chosen.questionId,
                    confidence=preferred_score,
                    reason="Matched by question id",
                )
        return SupportMatchResponse(matchedQuestionId=None, confidence=0.0, reason="No similar questions")
    newest = max(eligible, key=_answer_at_key)
    score = _overlap_score(message, newest.question)
    return SupportMatchResponse(
        matchedQuestionId=newest.questionId,
        confidence=score,
        reason="Newest answer among similar questions",
    )


def match_history(message: str, candidates: list[SupportQaCandidate]) -> SupportMatchResponse:
    ordered = _sort_candidates_newest_first(candidates)
    try:
        out = _llm_match(message, ordered)
        if out.matchedQuestionId is None:
            return _lexical_fallback(message, ordered)
        return _prefer_newest_among_similar(message, ordered, out.matchedQuestionId)
    except Exception as exc:
        log.warning("LLM match failed, fallback used: %s", exc)
        return _lexical_fallback(message, ordered)
