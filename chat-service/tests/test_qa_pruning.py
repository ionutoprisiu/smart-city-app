from __future__ import annotations

from datetime import datetime, timezone

from app.services.qa_pruning import find_superseded_question_ids

UTC = timezone.utc


def test_find_superseded_question_ids_matches_similar_time_questions() -> None:
    pairs = [
        {
            "questionId": 10,
            "questionBody": "La ce ora ne vedem?",
            "answerBody": "La 8 maine",
            "answerAt": datetime(2026, 6, 1, 12, 0, tzinfo=UTC),
        },
        {
            "questionId": 20,
            "questionBody": "Cat costa sedinta?",
            "answerBody": "50 ron",
            "answerAt": datetime(2026, 6, 2, tzinfo=UTC),
        },
    ]
    superseded = find_superseded_question_ids(
        "La ce ora trebuie sa fiu prezent maine?",
        30,
        pairs,
    )
    assert 10 in superseded
    assert 20 not in superseded


def test_find_superseded_question_ids_keeps_unrelated_history() -> None:
    pairs = [
        {
            "questionId": 11,
            "questionBody": "Unde este sedinta?",
            "answerBody": "La Casa de Cultura",
            "answerAt": datetime(2026, 6, 1, tzinfo=UTC),
        },
    ]
    superseded = find_superseded_question_ids("La ce ora incepe?", 12, pairs)
    assert superseded == []


def test_find_superseded_question_ids_never_targets_current_question() -> None:
    pairs = [
        {
            "questionId": 15,
            "questionBody": "La ce ora incepe?",
            "answerBody": "La 8",
            "answerAt": datetime(2026, 6, 1, tzinfo=UTC),
        },
    ]
    superseded = find_superseded_question_ids("La ce ora incepe?", 15, pairs)
    assert superseded == []
