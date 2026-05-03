from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from io import BytesIO
from typing import Any

from app.common.exceptions import VerificationInputError
from app.core.config import settings


@dataclass
class VerificationResult:
    status: str
    score: float | None
    reason: str
    ocr_data: dict | None


def _decode_image(data: bytes) -> Any:
    import cv2
    import numpy as np
    from PIL import Image, ImageOps

    try:
        pil_image = Image.open(BytesIO(data))
        pil_image = ImageOps.exif_transpose(pil_image).convert("RGB")
        rgb = np.array(pil_image, dtype=np.uint8)
        return cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    except Exception:
        array = np.frombuffer(data, dtype=np.uint8)
        image = cv2.imdecode(array, cv2.IMREAD_COLOR)
        if image is None:
            raise VerificationInputError("Invalid image data")
        return image


@lru_cache(maxsize=1)
def _face_app() -> Any:
    from insightface.app import FaceAnalysis

    app = FaceAnalysis(name=settings.insightface_model_name, providers=["CPUExecutionProvider"])
    app.prepare(
        ctx_id=0,
        det_size=(settings.insightface_det_size, settings.insightface_det_size),
        det_thresh=settings.insightface_det_thresh,
    )
    return app


def _enhance_for_detection(image: Any) -> Any:
    import cv2

    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_channel = clahe.apply(l_channel)
    merged = cv2.merge((l_channel, a_channel, b_channel))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def _largest_face_embedding(faces: list[Any]) -> Any:
    import numpy as np

    best_face = max(faces, key=lambda f: float(f.bbox[2] - f.bbox[0]) * float(f.bbox[3] - f.bbox[1]))
    embedding = np.asarray(best_face.embedding, dtype=np.float32)
    norm = np.linalg.norm(embedding)
    if norm == 0:
        raise VerificationInputError("Invalid face embedding")
    return embedding / norm


def _extract_face_embedding(image: Any, *, id_card_mode: bool = False, source_label: str = "image") -> Any:
    import cv2

    app = _face_app()
    candidates: list[Any] = []

    candidates.append(image)
    enhanced = _enhance_for_detection(image)
    candidates.append(enhanced)
    candidates.append(cv2.resize(enhanced, None, fx=1.8, fy=1.8, interpolation=cv2.INTER_CUBIC))

    if id_card_mode:
        h, w = enhanced.shape[:2]
        x0, x1 = 0, int(w * 0.48)
        y0, y1 = int(h * 0.18), int(h * 0.96)
        portrait_roi = enhanced[y0:y1, x0:x1]
        if portrait_roi.size:
            candidates.append(portrait_roi)
            candidates.append(cv2.resize(portrait_roi, None, fx=2.8, fy=2.8, interpolation=cv2.INTER_CUBIC))

    for candidate in candidates:
        for angle in (0, 90, 180, 270):
            if angle == 0:
                probe = candidate
            elif angle == 90:
                probe = cv2.rotate(candidate, cv2.ROTATE_90_CLOCKWISE)
            elif angle == 180:
                probe = cv2.rotate(candidate, cv2.ROTATE_180)
            else:
                probe = cv2.rotate(candidate, cv2.ROTATE_90_COUNTERCLOCKWISE)

            faces = app.get(probe)
            if faces:
                return _largest_face_embedding(faces)

    raise VerificationInputError(f"No face detected in {source_label}")


def _cosine_to_score(cosine_similarity: float) -> float:
    return max(0.0, min(1.0, (cosine_similarity + 1.0) / 2.0))


def _extract_ocr_data(id_card_image: Any) -> dict | None:
    import cv2
    import pytesseract

    gray = cv2.cvtColor(id_card_image, cv2.COLOR_BGR2GRAY)
    gray = cv2.medianBlur(gray, 3)
    text = pytesseract.image_to_string(gray)
    if not text.strip():
        return None

    cnp_match = re.search(r"\b[1-8]\d{12}\b", text)
    serial_match = re.search(r"\b[A-Z]{2}\d{6}\b", text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return {
        "cnp": cnp_match.group(0) if cnp_match else None,
        "serial": serial_match.group(0) if serial_match else None,
        "rawTextPreview": " ".join(lines[:5])[:500],
    }


def verify_identity(id_card_bytes: bytes, selfie_bytes: bytes) -> VerificationResult:
    import numpy as np

    id_card_image = _decode_image(id_card_bytes)
    selfie_image = _decode_image(selfie_bytes)

    id_face_embedding = _extract_face_embedding(id_card_image, id_card_mode=True, source_label="id card image")
    selfie_face_embedding = _extract_face_embedding(
        selfie_image,
        id_card_mode=False,
        source_label="selfie image",
    )

    cosine_similarity = float(np.dot(id_face_embedding, selfie_face_embedding))
    score = _cosine_to_score(cosine_similarity)
    ocr_data = _extract_ocr_data(id_card_image)

    if score >= settings.approve_threshold:
        status = "APPROVED"
        reason = "Face match is above approval threshold"
    elif score >= settings.manual_threshold:
        status = "MANUAL_REVIEW"
        reason = "Face match needs manual review"
    else:
        status = "REJECTED"
        reason = "Face match is below manual review threshold"

    return VerificationResult(status=status, score=score, reason=reason, ocr_data=ocr_data)


def warm_up_models() -> None:
    _face_app()
