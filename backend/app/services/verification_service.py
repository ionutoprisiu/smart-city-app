from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.verification_client import VerificationServiceError, submit
from app.models.enums import VerificationStatus
from app.models.user import User
from app.schemas.verification import VerificationStatusResponse, VerificationSubmitResponse


def _status_from_remote(raw: str) -> VerificationStatus:
    try:
        return VerificationStatus(raw)
    except ValueError:
        return VerificationStatus.REJECTED


async def submit_verification(
    db: Session,
    user_id: int,
    id_card_filename: str,
    id_card_bytes: bytes,
    selfie_filename: str,
    selfie_bytes: bytes,
) -> VerificationSubmitResponse:
    user = _get_user_or_raise(db, user_id)

    try:
        data: dict[str, Any] = await submit(
            user_id=user_id,
            id_card_filename=id_card_filename,
            id_card_bytes=id_card_bytes,
            selfie_filename=selfie_filename,
            selfie_bytes=selfie_bytes,
        )
    except VerificationServiceError as exc:
        raise RuntimeError(str(exc)) from exc

    status = _status_from_remote(str(data.get("status", VerificationStatus.REJECTED.value)))
    score = data.get("score")
    reason = str(data.get("reason", "Verification processed"))
    ocr_data = data.get("ocrData")

    user.verification_status = status.value
    user.verification_score = float(score) if score is not None else None
    user.verification_reason = reason
    user.id_document_ocr_json = json.dumps(ocr_data) if isinstance(ocr_data, dict) else None
    user.is_verified = status == VerificationStatus.APPROVED
    db.commit()

    return VerificationSubmitResponse(
        userId=user.id,
        status=status,
        score=user.verification_score,
        reason=reason,
    )


def get_verification_status(db: Session, user_id: int) -> VerificationStatusResponse:
    user = _get_user_or_raise(db, user_id)

    return VerificationStatusResponse(
        userId=user.id,
        status=_status_from_remote(user.verification_status),
        score=user.verification_score,
        reason=user.verification_reason,
        ocrData=_parse_ocr_json(user.id_document_ocr_json),
    )


def _get_user_or_raise(db: Session, user_id: int) -> User:
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")
    return user


def _parse_ocr_json(raw: str | None) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        out = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return out if isinstance(out, dict) else None
