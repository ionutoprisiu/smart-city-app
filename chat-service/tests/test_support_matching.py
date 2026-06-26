from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.support import SupportQaCandidate
from app.services.support_matching import (
    _intent_tags,
    _lexical_fallback,
    _prefer_newest_among_similar,
    answer_matches_question_intent,
    match_history,
)

UTC = timezone.utc


def test_lexical_match_similar_payment_question() -> None:
    cands = [
        SupportQaCandidate(questionId=10, question="Cum platesc in doua transe?", answer="Da, se poate."),
    ]
    out = match_history("Se poate achita in 2 transe?", list(cands))
    assert out.matchedQuestionId == 10


def test_no_match_when_unrelated() -> None:
    cands = [
        SupportQaCandidate(
            questionId=1,
            question="qqqqwwwwaaaabbbbcccc",
            answer="unused",
        ),
    ]
    out = match_history("mmmmnnnnooooxxxxzzzz", list(cands))
    assert out.matchedQuestionId is None


def test_lexical_prefers_newer_answer_when_scores_tie() -> None:
    old = datetime(2026, 5, 1, tzinfo=UTC)
    new = datetime(2026, 5, 10, tzinfo=UTC)
    cands = [
        SupportQaCandidate(
            questionId=1,
            question="La ce ora incepe?",
            answer="Ora 7:00",
            questionAt=old,
            answerAt=old,
        ),
        SupportQaCandidate(
            questionId=2,
            question="La ce ora incepe?",
            answer="Ora 7:30",
            questionAt=new,
            answerAt=new,
        ),
    ]
    out = _lexical_fallback("La ce ora incepe?", cands)
    assert out.matchedQuestionId == 2


def test_prefer_newest_among_similar_when_llm_picks_old_id() -> None:
    old = datetime(2026, 5, 1, tzinfo=UTC)
    new = datetime(2026, 5, 10, tzinfo=UTC)
    cands = [
        SupportQaCandidate(
            questionId=1,
            question="La ce ora incepe evenimentul?",
            answer="Ora 7:00",
            questionAt=old,
            answerAt=old,
        ),
        SupportQaCandidate(
            questionId=2,
            question="Cand incepe?",
            answer="Ora 7:30",
            questionAt=new,
            answerAt=new,
        ),
    ]
    out = _prefer_newest_among_similar("Cand incepe evenimentul?", cands, preferred_question_id=1)
    assert out.matchedQuestionId == 2


def test_no_match_price_vs_schedule_question() -> None:
    cands = [
        SupportQaCandidate(questionId=1, question="Cat costa sedinta?", answer="50 de lei"),
    ]
    out = _lexical_fallback("Cand are loc prima sedinta?", list(cands))
    assert out.matchedQuestionId is None


def test_time_question_with_are_loc_is_time_intent_only() -> None:
    tags = _intent_tags("La ce ora are loc maine dimineata?")
    assert "time" in tags
    assert "place" not in tags


def test_reject_place_answer_for_time_question() -> None:
    ok = answer_matches_question_intent(
        "La ce ora are loc maine dimineata?",
        "Conform descrierii, activitatea are loc la Casa de Cultură.",
    )
    assert ok is False


def test_no_match_time_question_to_place_history() -> None:
    cands = [
        SupportQaCandidate(
            questionId=1,
            question="Unde este sedinta?",
            answer="La Casa de Cultură.",
        ),
    ]
    out = _lexical_fallback("La ce ora are loc maine dimineata?", list(cands))
    assert out.matchedQuestionId is None


def test_intent_only_fallback_reuses_newest_time_answer() -> None:
    old = datetime(2026, 5, 1, tzinfo=UTC)
    new = datetime(2026, 6, 1, tzinfo=UTC)
    cands = [
        SupportQaCandidate(
            questionId=1,
            question="Cand este prima sedinta?",
            answer="La 10:00",
            questionAt=old,
            answerAt=old,
        ),
        SupportQaCandidate(
            questionId=2,
            question="La ce ora incepe sambata?",
            answer="La 8:30",
            questionAt=new,
            answerAt=new,
        ),
    ]
    from app.services.support_matching import _intent_only_fallback

    out = _intent_only_fallback("La ce ora incepe?", cands)
    assert out.matchedQuestionId == 2
    assert "8:30" in cands[1].answer


def test_candidates_without_timestamps_still_match() -> None:
    cands = [
        SupportQaCandidate(questionId=5, question="Unde ne intalnim?", answer="Piata Unirii"),
    ]
    out = match_history("Unde e meeting point-ul?", list(cands))
    assert out.matchedQuestionId == 5
