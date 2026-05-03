from __future__ import annotations

from app.schemas.support import SupportQaCandidate
from app.services.support_matching import match_history


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
