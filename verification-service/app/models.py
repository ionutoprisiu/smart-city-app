from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class VerificationStatus(StrEnum):
    APPROVED = "APPROVED"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    REJECTED = "REJECTED"


@dataclass(frozen=True)
class FaceQuality:
    det_score: float
    min_dim: float
    blur: float

    def passes(self, *, min_face_px: int, min_blur: float, min_det_score: float) -> bool:
        return (
            self.min_dim >= min_face_px
            and self.blur >= min_blur
            and self.det_score >= min_det_score
        )


@dataclass(frozen=True)
class VerificationMetadata:
    quality_ok: bool
    id_face_det_score: float
    id_face_min_dim: float
    id_face_blur: float
    selfie_face_blur: float

    def as_dict(self) -> dict[str, bool | float]:
        return {
            "qualityOk": self.quality_ok,
            "idFaceDetScore": self.id_face_det_score,
            "idFaceMinDim": self.id_face_min_dim,
            "idFaceBlur": self.id_face_blur,
            "selfieFaceBlur": self.selfie_face_blur,
        }


@dataclass(frozen=True)
class VerificationResult:
    status: VerificationStatus
    reason: str
    score: float
    metadata: VerificationMetadata
