from __future__ import annotations

from datetime import datetime, timezone

from app.models.activity_announcement import ActivityAnnouncement
from app.models.club import Club
from app.services.context_auto_reply import (
    _lexical_context_hint,
    build_club_context_text,
)

UTC = timezone.utc


def _club() -> Club:
    return Club(
        id=1,
        name="Clubul de chitara",
        description="Pretul este de 50ron/sedinta si va avea loc la Casa de Culutra",
        category="MUSIC",
        city="Cluj-Napoca",
        status="ACTIVE",
        created_by=2,
        visibility="PUBLIC",
    )


def test_build_club_context_includes_description() -> None:
    ctx = build_club_context_text(_club(), [])
    assert "50ron" in ctx
    assert "Casa de Culutra" in ctx


def test_lexical_fallback_price_from_description() -> None:
    ctx = build_club_context_text(_club(), [])
    out = _lexical_context_hint("Cat costa sedinta?", ctx)
    assert out.canAnswer is True
    assert "50" in out.answer


def test_lexical_fallback_place_from_description() -> None:
    ctx = build_club_context_text(_club(), [])
    out = _lexical_context_hint("Unde are loc sedinta?", ctx)
    assert out.canAnswer is True
    assert "Casa" in out.answer


def test_time_question_does_not_return_place_only() -> None:
    ctx = build_club_context_text(_club(), [])
    out = _lexical_context_hint("La ce ora are loc maine dimineata?", ctx)
    assert out.canAnswer is False
    assert "Casa" not in (out.answer or "")


def test_time_question_uses_announcement_schedule() -> None:
    ann = ActivityAnnouncement(
        id=1,
        title="Program",
        body="Prima sedinta sambata la 10:00",
        event_id=None,
        club_id=1,
        created_by=2,
        created_at=datetime(2026, 6, 1, tzinfo=UTC),
    )
    ctx = build_club_context_text(_club(), [ann])
    out = _lexical_context_hint("La ce ora este prima sedinta?", ctx)
    assert out.canAnswer is True
    assert "10:00" in out.answer
    assert "Casa" not in out.answer


def test_lexical_fallback_no_invented_schedule() -> None:
    ctx = build_club_context_text(_club(), [])
    out = _lexical_context_hint("La ce ora exacta incepe sambata?", ctx)
    assert out.canAnswer is False


def test_answer_from_context_falls_back_to_lexical_without_llm() -> None:
    from app.services.context_auto_reply import answer_from_context, build_club_context_text

    ann = ActivityAnnouncement(
        id=1,
        title="Program",
        body="Sedintele incep la 8:30",
        event_id=None,
        club_id=1,
        created_by=2,
        created_at=datetime(2026, 6, 1, tzinfo=UTC),
    )
    ctx = build_club_context_text(_club(), [ann])
    out = answer_from_context("La ce ora incepe?", ctx)
    assert out.canAnswer is True
    assert "8:30" in out.answer
    assert "(fallback)" in out.reason


def test_select_qa_hints_includes_intent_aligned_history() -> None:
    from app.services.context_auto_reply import _select_qa_hints

    pairs = [
        {
            "questionId": 1,
            "questionBody": "La ce ora ne vedem?",
            "answerBody": "La 8 maine",
            "answerAt": datetime(2026, 6, 1, 12, 0, tzinfo=UTC),
        },
        {
            "questionId": 2,
            "questionBody": "Cat costa?",
            "answerBody": "50 ron",
            "answerAt": datetime(2026, 6, 2, tzinfo=UTC),
        },
    ]
    hints = _select_qa_hints("La ce ora trebuie sa fiu prezent maine?", pairs)
    assert any(h["questionId"] == 1 for h in hints)
    assert all(h["questionId"] != 2 for h in hints)


def test_answer_from_context_uses_qa_history_without_llm() -> None:
    from app.services.context_auto_reply import answer_from_context, build_club_context_text

    ctx = build_club_context_text(_club(), [])
    pairs = [
        {
            "questionId": 1,
            "questionBody": "La ce ora ne vedem?",
            "answerBody": "La 8 maine",
            "answerAt": datetime(2026, 6, 26, 12, 31, tzinfo=UTC),
        },
        {
            "questionId": 2,
            "questionBody": "Cand?",
            "answerBody": "Mai e de la ora 8:30",
            "answerAt": datetime(2026, 6, 26, 12, 32, tzinfo=UTC),
        },
    ]
    out = answer_from_context("La ce ora incepem?", ctx, qa_pairs=pairs)
    assert out.canAnswer is True
    assert "8" in out.answer
    assert "fallback" in out.reason.lower()
    assert out.answer != "La 8 maine"


def test_announcements_in_context() -> None:
    ann = ActivityAnnouncement(
        id=1,
        title="Program",
        body="Prima sedinta sambata la 10:00",
        event_id=None,
        club_id=1,
        created_by=2,
        created_at=datetime(2026, 6, 1, tzinfo=UTC),
    )
    ctx = build_club_context_text(_club(), [ann])
    assert "10:00" in ctx
    out = _lexical_context_hint("Cand este prima sedinta?", ctx)
    assert "10:00" in ctx or out.canAnswer is False
