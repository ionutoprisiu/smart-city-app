from __future__ import annotations

import json
import logging
import re
from datetime import datetime

from app.core.config import settings
from app.models.activity_announcement import ActivityAnnouncement
from app.models.activity_event import ActivityEvent
from app.models.club import Club
from app.schemas.support import ContextAnswerResponse

log = logging.getLogger(__name__)

HTTP_TIMEOUT_SECONDS = 30.0
MIN_CONTEXT_CONFIDENCE = 0.55
MAX_CONTEXT_CHARS = 6000
MAX_ANSWER_CHARS = 800


def _fmt_dt(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%d %H:%M")


def _clip(text: str, limit: int) -> str:
    t = text.strip()
    if len(t) <= limit:
        return t
    return t[: limit - 3] + "..."


def build_event_context_text(event: ActivityEvent, announcements: list[ActivityAnnouncement]) -> str:
    lines = [
        f"Title: {event.title}",
        f"Category: {event.category}",
        f"City: {event.city}",
        f"Starts: {_fmt_dt(event.starts_at)}",
        f"Ends: {_fmt_dt(event.ends_at)}",
    ]
    if event.location_name:
        lines.append(f"Location: {event.location_name}")
    if event.description and event.description.strip():
        lines.append(f"Description: {event.description.strip()}")
    for ann in announcements:
        lines.append(f"Announcement — {ann.title}: {ann.body.strip()}")
    return _clip("\n".join(lines), MAX_CONTEXT_CHARS)


def build_club_context_text(club: Club, announcements: list[ActivityAnnouncement]) -> str:
    lines = [
        f"Name: {club.name}",
        f"Category: {club.category}",
        f"City: {club.city}",
        f"Visibility: {club.visibility}",
    ]
    if club.description and club.description.strip():
        lines.append(f"Description: {club.description.strip()}")
    for ann in announcements:
        lines.append(f"Announcement — {ann.title}: {ann.body.strip()}")
    return _clip("\n".join(lines), MAX_CONTEXT_CHARS)


def _build_client():
    from openai import OpenAI

    return OpenAI(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url.rstrip("/"),
        timeout=HTTP_TIMEOUT_SECONDS,
    )


def _parse_context_json(text: str) -> ContextAnswerResponse:
    raw = text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    if not raw:
        raise ValueError("empty LLM response")
    data = json.loads(raw)
    can_answer = bool(data.get("canAnswer"))
    answer = str(data.get("answer") or "").strip()
    confidence = float(data.get("confidence") or 0.0)
    reason = str(data.get("reason") or "")
    if can_answer and not answer:
        can_answer = False
    if len(answer) > MAX_ANSWER_CHARS:
        answer = answer[: MAX_ANSWER_CHARS - 3] + "..."
    return ContextAnswerResponse(
        canAnswer=can_answer,
        answer=answer,
        confidence=confidence,
        reason=reason,
    )


def _answer_serves_question_intent(message: str, answer: str) -> bool:
    from app.services.support_matching import answer_matches_question_intent

    return answer_matches_question_intent(message, answer)


def _time_lines_from_context(context: str) -> list[str]:
    lines: list[str] = []
    for line in context.splitlines():
        if re.search(r"\d{1,2}:\d{2}", line) or re.search(
            r"\b(?:la|ora)\s+\d{1,2}\b", line.lower()
        ):
            lines.append(line.strip())
    return lines


def _lexical_context_hint(message: str, context: str) -> ContextAnswerResponse:
    from app.services.support_matching import _intent_tags, _tokenize

    tags = _intent_tags(message)
    ctx_lower = context.lower()

    def _ok(resp: ContextAnswerResponse) -> ContextAnswerResponse:
        if resp.canAnswer and resp.answer and not _answer_serves_question_intent(message, resp.answer):
            return ContextAnswerResponse(
                canAnswer=False,
                confidence=0.0,
                reason="Fallback answer does not match question intent",
            )
        return resp

    if "price" in tags and "time" not in tags and "place" not in tags:
        m = re.search(r"(\d+)\s*(?:de\s+)?(?:lei|ron)", ctx_lower)
        if m:
            return _ok(
                ContextAnswerResponse(
                    canAnswer=True,
                    answer=f"Prețul menționat în descriere este {m.group(1)} lei.",
                    confidence=0.6,
                    reason="Price found in listing context (fallback)",
                )
            )

    if "time" in tags and "place" not in tags:
        for line in _time_lines_from_context(context):
            body = line
            if line.lower().startswith("announcement —"):
                body = line.split(":", 1)[-1].strip()
            time_m = re.search(r"(\d{1,2}:\d{2})", body)
            if time_m:
                return _ok(
                    ContextAnswerResponse(
                        canAnswer=True,
                        answer=f"Conform anunțurilor/descrierii: {body}",
                        confidence=0.58,
                        reason="Schedule found in listing context (fallback)",
                    )
                )
        return ContextAnswerResponse(canAnswer=False, confidence=0.0, reason="No schedule in context")

    if "place" in tags and "time" not in tags:
        for phrase in ("casa de cultura", "casa de culutra", "casa de cultură"):
            if phrase in ctx_lower:
                return _ok(
                    ContextAnswerResponse(
                        canAnswer=True,
                        answer="Conform descrierii, activitatea are loc la Casa de Cultură.",
                        confidence=0.55,
                        reason="Place found in listing context (fallback)",
                    )
                )
        if "loc" in _tokenize(message) or "place" in tags:
            loc_line = next(
                (ln for ln in context.splitlines() if ln.lower().startswith("location:")),
                None,
            )
            if loc_line:
                return _ok(
                    ContextAnswerResponse(
                        canAnswer=True,
                        answer=loc_line.replace("Location:", "Locația:").strip(),
                        confidence=0.55,
                        reason="Location line in event context (fallback)",
                    )
                )

    return ContextAnswerResponse(canAnswer=False, confidence=0.0, reason="No fallback match in context")


def _format_qa_hints(pairs: list[dict], limit: int = 10) -> str:
    if not pairs:
        return ""
    blocks: list[str] = []
    for pair in pairs[:limit]:
        blocks.append(f"Member asked: {pair['questionBody']}\nOrganizer answered: {pair['answerBody']}")
    return "\n\n".join(blocks)


def _select_qa_hints(message: str, pairs: list[dict]) -> list[dict]:
    """Pick past exchanges to inform the LLM — never used for verbatim copy."""
    if not pairs:
        return []

    from app.schemas.support import SupportQaCandidate
    from app.services.support_matching import _intent_tags, _intents_compatible, match_history

    candidates = [
        SupportQaCandidate(
            questionId=p["questionId"],
            question=p["questionBody"],
            answer=p["answerBody"],
            questionAt=p.get("questionAt"),
            answerAt=p.get("answerAt"),
        )
        for p in pairs
    ]
    selected: list[dict] = []
    seen: set[int] = set()

    match = match_history(message, candidates)
    if match.matchedQuestionId is not None:
        for pair in pairs:
            if pair["questionId"] == match.matchedQuestionId:
                selected.append(pair)
                seen.add(pair["questionId"])
                break

    tags = _intent_tags(message)
    if tags:
        ordered = sorted(
            pairs,
            key=lambda p: p.get("answerAt") or datetime.min,
            reverse=True,
        )
        for pair in ordered:
            if pair["questionId"] in seen:
                continue
            if _intents_compatible(message, pair["questionBody"]):
                selected.append(pair)
                seen.add(pair["questionId"])
            if len(selected) >= 10:
                break

    return selected[:10]


def _extract_times_from_text(text: str) -> list[str]:
    found: list[str] = []
    for match in re.finditer(r"(\d{1,2}:\d{2})", text):
        if match.group(1) not in found:
            found.append(match.group(1))
    lower = text.lower()
    for match in re.finditer(r"\bora\s+(\d{1,2})(?::(\d{2}))?\b", lower):
        label = f"{match.group(1)}:{match.group(2) or '00'}"
        if label not in found:
            found.append(label)
    for match in re.finditer(r"\bla\s+(\d{1,2})\b", lower):
        label = f"{match.group(1)}:00"
        if label not in found:
            found.append(label)
    return found


def _display_time_label(value: str) -> str:
    return value[:-3] if value.endswith(":00") else value


def _fallback_from_qa_hints(message: str, hints: list[dict]) -> ContextAnswerResponse:
    if not hints:
        return ContextAnswerResponse(canAnswer=False, reason="No QA hints for fallback")

    from app.services.support_matching import _intent_tags

    tags = _intent_tags(message)
    msg_l = message.lower()

    def ok(answer: str) -> ContextAnswerResponse:
        if not _answer_serves_question_intent(message, answer):
            return ContextAnswerResponse(
                canAnswer=False,
                confidence=0.0,
                reason="QA rephrase rejected intent",
            )
        return ContextAnswerResponse(
            canAnswer=True,
            answer=answer,
            confidence=0.56,
            reason="Rephrased from verified club Q&A (fallback)",
        )

    if "price" in tags and "time" not in tags and "place" not in tags:
        for hint in hints:
            match = re.search(r"(\d+)\s*(?:de\s+)?(?:lei|ron)", hint["answerBody"].lower())
            if match:
                return ok(f"Costul discutat anterior in club este de {match.group(1)} lei.")

    if "place" in tags and "time" not in tags:
        for hint in hints:
            body_l = hint["answerBody"].lower()
            if "casa de cult" in body_l:
                return ok("Intalnirea are loc la Casa de Cultura, conform discutiilor din club.")
            if any(word in body_l for word in ("loc", "adresa", "intaln")):
                return ok(f"Locatia mentionata anterior: {hint['answerBody']}")

    if "time" in tags and "place" not in tags:
        seen_times: list[str] = []
        for hint in hints:
            for value in _extract_times_from_text(hint["answerBody"]):
                if value not in seen_times:
                    seen_times.append(value)

        if not seen_times:
            body = hints[0]["answerBody"].strip()
            if re.search(r"\d", body):
                tail = body[3:].strip() if body.lower().startswith("la ") else body
                if "incep" in msg_l:
                    return ok(f"Sedintele incep {tail}.")
                if "prezent" in msg_l or "trebuie" in msg_l:
                    return ok(f"Trebuie sa fii prezent {tail}.")
                return ok(f"Program discutat anterior in club: {body}.")
            return ContextAnswerResponse(canAnswer=False, reason="No time facts in QA hints")

        main_time = _display_time_label(seen_times[0])
        extra = ""
        if len(seen_times) > 1:
            extra = f"; exista si varianta de la ora {_display_time_label(seen_times[1])}"
        if "incep" in msg_l:
            return ok(f"Sedintele incep la ora {main_time}{extra}.")
        if "maine" in msg_l or "prezent" in msg_l or "trebuie" in msg_l:
            return ok(f"Trebuie sa fii prezent maine la ora {main_time}{extra}.")
        if "vedem" in msg_l:
            return ok(f"Ne vedem la ora {main_time}{extra}.")
        return ok(f"Ora stabilita in discutiile anterioare este {main_time}{extra}.")

    return ContextAnswerResponse(canAnswer=False, reason="No QA fallback for intent")


def _llm_answer_from_context(message: str, context: str, qa_block: str) -> ContextAnswerResponse:
    sections = [
        "You help members of a community app. Answer NEW_QUESTION using ONLY the facts below.",
        "Rules:",
        "- Understand NEW_QUESTION semantically, including paraphrases and typos in Romanian",
        "- If it is similar to a past exchange, reuse the SAME facts (time, price, place) but write a "
        "fresh reply tailored to how the member asked — do NOT copy a previous organizer answer verbatim",
        "- Use LISTING_CONTEXT (description, announcements, schedule) and PAST_VERIFIED_EXCHANGES",
        "- Match intent: time questions need times; location questions need places; price questions need fees",
        "- If someone asks WHEN (ora, când, mâine), do NOT answer with only WHERE unless time is also stated",
        "- If facts are insufficient for that intent, set canAnswer to false",
        "- Do not invent prices, dates, addresses, or policies",
        "- Reply in Romanian, 1-3 short sentences, friendly tone",
        '- Return strict JSON: {"canAnswer": bool, "answer": string, "confidence": 0..1, "reason": string}',
        f"\nNEW_QUESTION:\n{message.strip()}",
    ]
    if context.strip():
        sections.append(f"\nLISTING_CONTEXT:\n{context}")
    if qa_block.strip():
        sections.append(f"\nPAST_VERIFIED_EXCHANGES:\n{qa_block}")
    prompt = "\n".join(sections)

    client = _build_client()
    completion = client.chat.completions.create(
        model=settings.llm_model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=220,
        response_format={"type": "json_object"},
    )
    text = (completion.choices[0].message.content or "").strip()
    out = _parse_context_json(text)
    if out.canAnswer and out.confidence < MIN_CONTEXT_CONFIDENCE:
        return ContextAnswerResponse(
            canAnswer=False,
            answer="",
            confidence=out.confidence,
            reason="Context answer confidence too low",
        )
    if out.canAnswer and not _answer_serves_question_intent(message, out.answer):
        return ContextAnswerResponse(
            canAnswer=False,
            answer="",
            confidence=0.0,
            reason="LLM answer rejected: wrong intent (time/place/price)",
        )
    return out


def answer_from_context(
    message: str,
    context: str,
    qa_pairs: list[dict] | None = None,
) -> ContextAnswerResponse:
    if not context.strip() and not qa_pairs:
        return ContextAnswerResponse(canAnswer=False, reason="Empty context")

    hints = _select_qa_hints(message, qa_pairs or [])
    qa_block = _format_qa_hints(hints)

    try:
        out = _llm_answer_from_context(message, context, qa_block)
        if out.canAnswer:
            return out
    except Exception as exc:
        log.warning("Context LLM answer failed, trying fallback: %s", exc)

    qa_out = _fallback_from_qa_hints(message, hints)
    if qa_out.canAnswer:
        return qa_out

    if context.strip():
        return _lexical_context_hint(message, context)

    return ContextAnswerResponse(canAnswer=False, reason="No answer from context or history")
