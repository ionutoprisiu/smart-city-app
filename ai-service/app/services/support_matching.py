from __future__ import annotations

import json
import logging
import re

from app.core.config import settings
from app.schemas.support import SupportMatchResponse, SupportQaCandidate

log = logging.getLogger(__name__)

HTTP_TIMEOUT_SECONDS = 120.0


def _tokenize(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z0-9ăâîșțĂÂÎȘȚ]+", text.lower())
    return {t for t in tokens if len(t) > 2}


def _lexical_fallback(message: str, candidates: list[SupportQaCandidate]) -> SupportMatchResponse:
    if not candidates:
        return SupportMatchResponse(matchedQuestionId=None, confidence=0.0, reason="No history in this context")
    target = _tokenize(message)
    if not target:
        return SupportMatchResponse(matchedQuestionId=None, confidence=0.0, reason="Question too short")
    best_id: int | None = None
    best_score = 0.0
    best_overlap = 0
    for c in candidates:
        base = _tokenize(c.question)
        if not base:
            continue
        inter = len(target.intersection(base))
        union = len(target.union(base))
        score = inter / union if union else 0.0
        if score > best_score:
            best_score = score
            best_id = c.questionId
            best_overlap = inter
    if best_id is not None and (best_score >= 0.10 or best_overlap >= 1):
        return SupportMatchResponse(
            matchedQuestionId=best_id,
            confidence=best_score,
            reason="Matched by lexical similarity",
        )
    return SupportMatchResponse(matchedQuestionId=None, confidence=best_score, reason="No close lexical match")


def _build_client():
    from openai import OpenAI

    return OpenAI(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url.rstrip("/"),
        timeout=HTTP_TIMEOUT_SECONDS,
    )


def _llm_match(message: str, candidates: list[SupportQaCandidate]) -> SupportMatchResponse:
    if not candidates:
        return SupportMatchResponse(matchedQuestionId=None, confidence=0.0, reason="No history in this context")
    entries = [
        {"questionId": c.questionId, "question": c.question, "answer": c.answer}
        for c in candidates[:80]
    ]
    prompt = (
        "Task: decide if NEW_QUESTION is semantically equivalent to one previous user question.\n"
        "If yes, return that questionId; if not, return null.\n"
        "Rules:\n"
        "- only match if intent is really the same in this event/club context\n"
        "- ignore wording differences and typos\n"
        "- if uncertain, return null\n"
        "Return strict JSON: {\"matchedQuestionId\": int|null, \"confidence\": 0..1, \"reason\": \"...\"}\n\n"
        f"NEW_QUESTION:\n{message}\n\n"
        f"HISTORY:\n{json.dumps(entries, ensure_ascii=False)}"
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


def match_history(message: str, candidates: list[SupportQaCandidate]) -> SupportMatchResponse:
    try:
        out = _llm_match(message, candidates)
        if out.matchedQuestionId is None:
            return _lexical_fallback(message, candidates)
        return out
    except Exception as exc:
        log.warning("LLM match failed, fallback used: %s", exc)
        return _lexical_fallback(message, candidates)
