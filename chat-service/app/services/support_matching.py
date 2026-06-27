from __future__ import annotations

import json
import logging
import re
from datetime import datetime

from app.core.config import settings
from app.schemas.support import SupportMatchResponse, SupportQaCandidate

log = logging.getLogger(__name__)

HTTP_TIMEOUT_SECONDS = 30.0

MIN_AUTO_REPLY_CONFIDENCE = 0.42

_STOPWORDS = frozenset(
    {
        "the", "and", "for", "are", "was", "cum", "care", "este", "sunt", "din", "pentru",
        "despre", "este", "sau", "dar", "mai", "avea", "face", "este", "und", "una",
        "sedinta", "sedința", "eveniment", "grup", "club", "prima", "doar", "foarte",
        "are", "areloc",
    }
)

_PRICE_TOKENS = frozenset(
    {
        "cost", "costa", "pret", "preț", "lei", "bani", "ban", "plate", "platesc", "achit", "achita",
        "taxa", "tarif", "plata", "plată",
    }
)
_TIME_TOKENS = frozenset(
    {
        "cand", "când", "ora", "ore", "data", "zi", "zile", "incepe", "incepem", "începe", "începem",
        "start", "program",
        "maine", "dimineata", "dimineață", "seara", "seară", "noaptea", "sambata", "sâmbătă",
        "duminica", "duminică", "luni", "marti", "marți", "miercuri", "joi", "vineri",
    }
)
# skip bare "loc" — also appears in "are loc"
_PLACE_TOKENS = frozenset(
    {"unde", "locatie", "locație", "adresa", "adresă", "intaln", "întâln", "meeting", "adresa"}
)


def _tokenize(text: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z0-9ăâîșțĂÂÎȘȚ]+", text.lower())
    return {t for t in tokens if len(t) > 2 and t not in _STOPWORDS}


def _intent_tags(text: str) -> set[str]:
    tokens = _tokenize(text)
    lower = text.lower()
    tags: set[str] = set()
    if tokens & _PRICE_TOKENS:
        tags.add("price")
    if tokens & _TIME_TOKENS or re.search(r"\b(ce\s+ora|la\s+ce\s+ora|când)\b", lower):
        tags.add("time")
    if tokens & _PLACE_TOKENS or re.search(r"\bunde\b", lower):
        tags.add("place")
    return tags


def _intents_compatible(message: str, question: str) -> bool:
    msg_tags = _intent_tags(message)
    q_tags = _intent_tags(question)
    if not msg_tags or not q_tags:
        return True
    if "time" in msg_tags and "time" not in q_tags:
        return False
    if "price" in msg_tags and "price" not in q_tags:
        return False
    if "place" in msg_tags and "place" not in q_tags and "time" not in msg_tags:
        return False
    return bool(msg_tags & q_tags)


def answer_matches_question_intent(question: str, answer: str) -> bool:
    q_tags = _intent_tags(question)
    if not q_tags:
        return True
    ans_lower = answer.lower()
    has_time_fact = bool(
        re.search(r"\d{1,2}:\d{2}", ans_lower)
        or re.search(r"\bora\s+\d{1,2}\b", ans_lower)
        or re.search(r"\bla\s+\d{1,2}\b", ans_lower)
    )
    place_cues = (
        "casa de cult",
        "are loc la",
        "locația",
        "locatia",
        "adresa",
        "unde ",
    )
    looks_place_only = any(cue in ans_lower for cue in place_cues) and not has_time_fact

    if "time" in q_tags and looks_place_only:
        return False
    if "price" in q_tags and not re.search(r"\d+\s*(?:lei|ron)", ans_lower):
        if "price" not in _intent_tags(answer):
            return False
    return True


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


def _intent_only_fallback(message: str, candidates: list[SupportQaCandidate]) -> SupportMatchResponse:
    """Reuse the newest approved answer when intent matches but wording differs."""
    tags = _intent_tags(message)
    if len(tags) != 1:
        return SupportMatchResponse(matchedQuestionId=None, confidence=0.0, reason="Not a single-intent question")
    tag = next(iter(tags))
    eligible = [
        c
        for c in candidates
        if tag in _intent_tags(c.question) and _intents_compatible(message, c.question)
    ]
    if not eligible:
        return SupportMatchResponse(matchedQuestionId=None, confidence=0.0, reason="No intent-aligned history")
    newest = max(eligible, key=_answer_at_key)
    return SupportMatchResponse(
        matchedQuestionId=newest.questionId,
        confidence=0.5,
        reason=f"Matched by {tag} intent (newest answer)",
    )


def _lexical_fallback(message: str, candidates: list[SupportQaCandidate]) -> SupportMatchResponse:
    if not candidates:
        return SupportMatchResponse(matchedQuestionId=None, confidence=0.0, reason="No history in this context")
    target = _tokenize(message)
    if not target:
        return SupportMatchResponse(matchedQuestionId=None, confidence=0.0, reason="Question too short")
    best_id: int | None = None
    best_score = 0.0
    best_overlap = 0
    best_question = ""
    best_answer_at = datetime.min
    for c in candidates:
        if not _intents_compatible(message, c.question):
            continue
        score = _overlap_score(message, c.question)
        overlap = len(target.intersection(_tokenize(c.question)))
        answer_at = _answer_at_key(c)
        if score > best_score or (
            score == best_score and score > 0 and answer_at > best_answer_at
        ):
            best_score = score
            best_id = c.questionId
            best_overlap = overlap
            best_question = c.question
            best_answer_at = answer_at
    intent_aligned = bool(_intent_tags(message)) and _intents_compatible(message, best_question)
    strong_enough = (
        best_score >= 0.32
        or (best_overlap >= 2 and best_score >= 0.18)
        or (intent_aligned and best_overlap >= 1 and best_score >= 0.12)
    )
    confidence = best_score
    if intent_aligned and best_id is not None:
        confidence = max(confidence, 0.55)
    if best_id is not None and strong_enough and confidence >= MIN_AUTO_REPLY_CONFIDENCE:
        return SupportMatchResponse(
            matchedQuestionId=best_id,
            confidence=confidence,
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


def _loads_json_lenient(text: str) -> dict:
    """Parse model JSON output, tolerating ```json fences and stray whitespace."""
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    if not raw:
        raise ValueError("empty LLM response")
    return json.loads(raw)


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
        "Task: decide if NEW_QUESTION asks the SAME thing as exactly one previous user question.\n"
        "If yes, return that questionId; if not, return null.\n"
        "Rules:\n"
        "- intent must match: price/cost questions only match other price questions; "
        "schedule/time questions only match other time questions; location only matches location\n"
        "- do NOT match if the topic differs (example: 'how much' must not match 'when/where')\n"
        "- ignore wording differences and typos only when intent is identical\n"
        "- if several history items match the same intent, return the questionId whose answerAt is MOST RECENT\n"
        "- if uncertain or only partially related, return null with low confidence\n"
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
        response_format={"type": "json_object"},
    )
    text = (completion.choices[0].message.content or "").strip()
    data = _loads_json_lenient(text)
    matched = data.get("matchedQuestionId")
    confidence = float(data.get("confidence") or 0.0)
    reason = str(data.get("reason") or "")
    if matched is not None:
        matched = int(matched)
        chosen = next((c for c in candidates if c.questionId == matched), None)
        if chosen is not None and not _intents_compatible(message, chosen.question):
            return SupportMatchResponse(
                matchedQuestionId=None,
                confidence=0.0,
                reason="LLM match rejected: different intent (price/time/place)",
            )
    if matched is not None and confidence < MIN_AUTO_REPLY_CONFIDENCE:
        return SupportMatchResponse(
            matchedQuestionId=None,
            confidence=confidence,
            reason="LLM confidence below auto-reply threshold",
        )
    return SupportMatchResponse(matchedQuestionId=matched, confidence=confidence, reason=reason)


def _prefer_newest_among_similar(
    message: str,
    candidates: list[SupportQaCandidate],
    preferred_question_id: int | None,
) -> SupportMatchResponse:
    if not candidates:
        return SupportMatchResponse(matchedQuestionId=None, confidence=0.0, reason="No candidates")
    scored = [(_overlap_score(message, c.question), c) for c in candidates]
    preferred_score = 0.0
    if preferred_question_id is not None:
        preferred_score = next((s for s, c in scored if c.questionId == preferred_question_id), 0.0)
    if preferred_score < MIN_AUTO_REPLY_CONFIDENCE:
        return SupportMatchResponse(
            matchedQuestionId=None,
            confidence=preferred_score,
            reason="Similarity too weak for auto-reply",
        )
    threshold = max(0.28, preferred_score * 0.85)
    eligible = [
        c for s, c in scored if s >= threshold and _intents_compatible(message, c.question)
    ]
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
        if out.matchedQuestionId is not None:
            out = _prefer_newest_among_similar(message, ordered, out.matchedQuestionId)
        else:
            out = _lexical_fallback(message, ordered)
            if out.matchedQuestionId is None:
                out = _intent_only_fallback(message, ordered)
    except Exception as exc:
        log.warning("LLM match failed, fallback used: %s", exc)
        out = _lexical_fallback(message, ordered)
        if out.matchedQuestionId is None:
            out = _intent_only_fallback(message, ordered)

    if out.matchedQuestionId is not None and out.confidence < MIN_AUTO_REPLY_CONFIDENCE:
        return SupportMatchResponse(
            matchedQuestionId=None,
            confidence=out.confidence,
            reason="Below auto-reply confidence threshold",
        )
    return out
