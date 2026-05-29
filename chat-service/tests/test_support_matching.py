from __future__ import annotations

from datetime import datetime, timezone

from app.schemas.support import SupportQaCandidate
from app.services.support_matching import _lexical_fallback, _prefer_newest_among_similar, match_history

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


def test_candidates_without_timestamps_still_match() -> None:
    cands = [
        SupportQaCandidate(questionId=5, question="Unde ne intalnim?", answer="Piata Unirii"),
    ]
    out = match_history("Unde e meeting point-ul?", list(cands))
    assert out.matchedQuestionId == 5
