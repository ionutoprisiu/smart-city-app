"""Decision layer of /verify: compare the two faces and turn the result into a status.

The vision work (detect face, produce embedding) lives in app.vision; this file
only computes the similarity and applies the score + quality rules.
"""
from __future__ import annotations

import numpy as np

from app.core.config import settings
from app.vision import decode_image, extract_id_portrait, extract_selfie, warm_up
from app.models import VerificationMetadata, VerificationResult, VerificationStatus


def warm_up_models() -> None:
    warm_up()


def _clamp_score(cosine_similarity: float) -> float:
    # Cosine can drift slightly outside [0,1] from float error; keep it in range.
    return max(0.0, min(1.0, cosine_similarity))


def _decide(score: float, quality_ok: bool) -> tuple[VerificationStatus, str]:
    # Three-way gate: a confident match with good images auto-approves; a match on
    # poor images goes to a human; anything below the threshold is rejected.
    if score >= settings.approve_threshold:
        if quality_ok:
            return VerificationStatus.APPROVED, "Auto-approved by InsightFace (face match)"
        return VerificationStatus.MANUAL_REVIEW, "Face match acceptable but image quality needs review"
    return VerificationStatus.REJECTED, "Face match is below approval threshold"


def verify_identity(id_card_bytes: bytes, selfie_bytes: bytes) -> VerificationResult:
    # Turn each image into a normalized face embedding (a direction in 512-D space).
    id_embedding, id_quality = extract_id_portrait(decode_image(id_card_bytes))
    selfie_embedding, selfie_quality = extract_selfie(decode_image(selfie_bytes))

    # Both vectors are unit-length, so their dot product IS the cosine similarity:
    # ~1 = same person, ~0 = unrelated faces.
    score = _clamp_score(float(np.dot(id_embedding, selfie_embedding)))
    quality_ok = id_quality.passes(
        min_face_px=settings.min_face_px,
        min_blur=settings.min_blur_variance,
        min_det_score=settings.insightface_min_det_score,
    ) and selfie_quality.passes(
        min_face_px=settings.min_face_px,
        min_blur=settings.min_blur_variance,
        min_det_score=settings.insightface_min_det_score,
    )
    status, reason = _decide(score, quality_ok)

    metadata = VerificationMetadata(
        quality_ok=quality_ok,
        id_face_det_score=round(id_quality.det_score, 3),
        id_face_min_dim=round(id_quality.min_dim, 1),
        id_face_blur=round(id_quality.blur, 1),
        selfie_face_blur=round(selfie_quality.blur, 1),
    )

    return VerificationResult(status=status, reason=reason, score=score, metadata=metadata)
