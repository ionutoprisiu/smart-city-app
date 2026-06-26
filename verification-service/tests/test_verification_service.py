from __future__ import annotations

import pytest

from app.core.config import settings
from app.vision import pick_best_face
from app.models import FaceQuality, VerificationStatus
from app.services import verification_service as svc
from types import SimpleNamespace


def test_clamp_score() -> None:
    assert svc._clamp_score(0.72) == pytest.approx(0.72)
    assert svc._clamp_score(-0.2) == 0.0
    assert svc._clamp_score(1.4) == 1.0


def test_decide_auto_approves_good_match_with_quality() -> None:
    status, reason = svc._decide(0.60, quality_ok=True)
    assert status == VerificationStatus.APPROVED
    assert "insightface" in reason.lower()


def test_decide_rejects_low_score() -> None:
    status, _ = svc._decide(0.40, quality_ok=True)
    assert status == VerificationStatus.REJECTED


def test_decide_keeps_borderline_score_in_review_when_quality_is_low() -> None:
    status, reason = svc._decide(0.60, quality_ok=False)
    assert status == VerificationStatus.MANUAL_REVIEW
    assert "quality" in reason.lower()


def test_pick_best_face_prefers_left_portrait_on_id() -> None:
    left = SimpleNamespace(bbox=[10.0, 20.0, 90.0, 140.0], det_score=0.91)
    right = SimpleNamespace(bbox=[220.0, 30.0, 300.0, 150.0], det_score=0.95)

    chosen = pick_best_face([(right, 400), (left, 400)], portrait_only=True)
    assert chosen is left


def test_face_quality_passes() -> None:
    good = FaceQuality(det_score=0.9, min_dim=120.0, blur=150.0)
    small = FaceQuality(det_score=0.9, min_dim=20.0, blur=150.0)

    kwargs = {
        "min_face_px": settings.min_face_px,
        "min_blur": settings.min_blur_variance,
        "min_det_score": settings.insightface_min_det_score,
    }

    assert good.passes(**kwargs) is True
    assert small.passes(**kwargs) is False


def test_default_approve_threshold_is_0_55() -> None:
    assert settings.approve_threshold == pytest.approx(0.55)
