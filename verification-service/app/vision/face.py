# Face detection and embedding extraction with InsightFace: multi-scale detection,
# best-face pick, normalized ArcFace embedding + quality; the ID card and the selfie
# use slightly different strategies (extract_id_portrait / extract_selfie).
from __future__ import annotations

from functools import lru_cache
from typing import Any

import numpy as np
from insightface.app import FaceAnalysis
from numpy.typing import NDArray

from app.common.exceptions import ValidationAppError
from app.core.config import settings
from app.models import FaceQuality
from app.vision.image_utils import BGRImage, blur_variance, enhance_for_detection, resize

Face = Any
FacePair = tuple[Face, BGRImage]

# On an ID card the portrait sits on the left half; faces past this x are ignored.
PORTRAIT_MAX_CENTER_X = 0.55


@lru_cache(maxsize=4)
def _analysis_app(det_size: int) -> FaceAnalysis:
    # The model is heavy to load, so cache one instance per detection size and reuse it.
    app = FaceAnalysis(name=settings.insightface_model_name, providers=["CPUExecutionProvider"])
    app.prepare(
        ctx_id=0,
        det_size=(det_size, det_size),
        det_thresh=settings.insightface_det_thresh,
    )
    return app


def warm_up() -> None:
    # Called at startup so the first real /verify doesn't pay the model-load cost.
    _analysis_app(settings.insightface_det_size)


def _det_sizes() -> list[int]:
    # Try several detector resolutions (dedup, order preserved) — small faces on an
    # ID photo often need a larger det_size to be found.
    return list(dict.fromkeys([640, settings.insightface_det_size, 1280]))


def _det_score(face: Face) -> float:
    return float(getattr(face, "det_score", 0.0))


def _face_area(face: Face) -> float:
    bbox = face.bbox
    return float(bbox[2] - bbox[0]) * float(bbox[3] - bbox[1])


def _face_center_x(face: Face, image_width: int) -> float:
    bbox = face.bbox
    center = (float(bbox[0]) + float(bbox[2])) / 2.0
    return center if image_width <= 0 else center / float(image_width)


def _normalize_embedding(face: Face) -> NDArray[np.float32]:
    # L2-normalize to a unit vector so a later dot product equals cosine similarity.
    embedding = np.asarray(face.embedding, dtype=np.float32)
    norm = np.linalg.norm(embedding)
    if norm == 0:
        raise ValidationAppError("Invalid face embedding")
    return embedding / norm


def pick_best_face(pairs: list[tuple[Face, int]], *, portrait_only: bool) -> Face:
    if not pairs:
        raise ValidationAppError("No face detected")

    # Prefer confidently-detected faces, but keep the rest as a fallback.
    min_score = settings.insightface_min_det_score
    confident = [pair for pair in pairs if _det_score(pair[0]) >= min_score]
    candidates = confident or list(pairs)

    # For an ID card, keep only faces on the left (the portrait), dropping any face
    # that might appear elsewhere on the document.
    if portrait_only:
        portrait = [
            pair for pair in candidates if _face_center_x(pair[0], pair[1]) <= PORTRAIT_MAX_CENTER_X
        ]
        if portrait:
            candidates = portrait

    # Among the survivors, take the most confident and, on ties, the largest face.
    return max(candidates, key=lambda pair: (_det_score(pair[0]), _face_area(pair[0])))[0]


def _face_quality(face: Face, probe: BGRImage) -> FaceQuality:
    x0, y0, x1, y1 = (max(int(v), 0) for v in face.bbox)
    crop = probe[y0:y1, x0:x1]
    return FaceQuality(
        det_score=_det_score(face),
        min_dim=float(min(x1 - x0, y1 - y0)),
        blur=blur_variance(crop),
    )


def _detect_faces(probes: list[BGRImage]) -> list[FacePair]:
    # Run the detector at increasing scales and stop at the first scale that yields
    # confident faces; if none is ever confident, return whatever was found.
    min_score = settings.insightface_min_det_score
    fallback: list[FacePair] = []

    for det_size in _det_sizes():
        app = _analysis_app(det_size)
        batch: list[FacePair] = []
        for probe in probes:
            if probe.size == 0:
                continue
            batch.extend((face, probe) for face in app.get(probe))

        if not batch:
            continue

        confident = [pair for pair in batch if _det_score(pair[0]) >= min_score]
        if confident:
            return confident
        fallback.extend(batch)

    return fallback


def _extract(probes: list[BGRImage], *, portrait_only: bool, error: str) -> tuple[NDArray[np.float32], FaceQuality]:
    pairs = _detect_faces(probes)
    if not pairs:
        raise ValidationAppError(error)

    face = pick_best_face([(f, probe.shape[1]) for f, probe in pairs], portrait_only=portrait_only)
    probe = next(probe for f, probe in pairs if f is face)
    return _normalize_embedding(face), _face_quality(face, probe)


def _id_probes(image: BGRImage) -> list[BGRImage]:
    # The ID portrait is small and sits top-left; crop that region (two ratios) and
    # upscale it, so the detector sees a bigger, clearer face to work with.
    enhanced = enhance_for_detection(image)
    h, w = enhanced.shape[:2]
    regions = (
        enhanced[int(h * 0.10) : int(h * 0.95), 0 : int(w * 0.45)],
        enhanced[int(h * 0.18) : int(h * 0.96), 0 : int(w * 0.48)],
    )
    probes: list[BGRImage] = []
    for region in regions:
        if region.size:
            probes.extend((region, resize(region, 2.5)))
    return probes


def extract_id_portrait(image: BGRImage) -> tuple[NDArray[np.float32], FaceQuality]:
    # Try the cropped portrait regions first; if that finds nothing, fall back to
    # the whole card. portrait_only keeps only the left-side face either way.
    probes = _id_probes(image)
    try:
        return _extract(probes, portrait_only=True, error="No face detected in id card image")
    except ValidationAppError:
        enhanced = enhance_for_detection(image)
        return _extract(
            [image, enhanced, resize(enhanced, 1.5)],
            portrait_only=True,
            error="No face detected in id card image",
        )


def extract_selfie(image: BGRImage) -> tuple[NDArray[np.float32], FaceQuality]:
    # A selfie is one face filling the frame — detect on the whole image (plus a
    # contrast-enhanced and an upscaled variant to help hard cases).
    enhanced = enhance_for_detection(image)
    return _extract(
        [image, enhanced, resize(enhanced, 1.5)],
        portrait_only=False,
        error="No face detected in selfie image",
    )
