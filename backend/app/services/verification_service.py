from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.integrations.verification_client import VerificationServiceError, submit
from app.models.enums import Role, VerificationStatus
from app.models.user import User
from app.schemas.verification import VerificationStatusResponse, VerificationSubmitResponse
from app.services import verification_storage
from app.services.verification_access import (
    ensure_can_submit,
    guide_flow_eligibility,
    parse_stored_status,
    submit_eligibility,
)


def _apply_verification_outcome(user: User, status: VerificationStatus, *, reason: str) -> None:
    # Translate the verification-service verdict into user state. APPROVED is the
    # only status that grants the guide role; anything else clears verification.
    user.verification_status = status.value
    user.verification_reason = reason

    if status == VerificationStatus.APPROVED:
        user.is_verified = True
        user.is_approved = True
        user.verified_at = datetime.now()
        if user.role != Role.ADMIN.value:  # promote to guide (admins stay admin)
            user.role = Role.GUIDE.value
        return

    user.is_verified = False
    user.is_approved = False
    user.verified_at = None


async def submit_verification(
    db: Session,
    user_id: int,
    id_card_filename: str,
    id_card_bytes: bytes,
    selfie_filename: str,
    selfie_bytes: bytes,
) -> VerificationSubmitResponse:
    user = _get_user_or_raise(db, user_id)
    ensure_can_submit(user)  # reject early if the user is not in a submittable state

    # The actual face matching lives in verification-service; we only orchestrate.
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

    status = parse_stored_status(str(data.get("status", VerificationStatus.REJECTED.value)))
    score = data.get("score")
    reason = str(data.get("reason", "Verification processed"))
    metadata = data.get("metadata")
    if not isinstance(metadata, dict):
        metadata = data.get("ocrData") if isinstance(data.get("ocrData"), dict) else None

    verification_storage.save_verification_images(user_id, id_card_bytes, selfie_bytes)
    id_card_url, selfie_url = verification_storage.document_urls(user_id)

    user.verification_score = float(score) if score is not None else None
    user.verification_metadata_json = json.dumps(metadata) if isinstance(metadata, dict) else None
    user.id_card_image_url = id_card_url
    user.face_image_url = selfie_url
    _apply_verification_outcome(user, status, reason=reason)
    db.commit()
    db.refresh(user)

    return VerificationSubmitResponse(
        userId=user.id,
        status=status,
        role=Role(user.role),
        isVerified=user.is_verified,
        score=user.verification_score,
        reason=reason,
    )


def get_verification_status(db: Session, user_id: int) -> VerificationStatusResponse:
    user = _get_user_or_raise(db, user_id)
    can_submit, blocked_reason = submit_eligibility(user)
    can_access_flow, flow_blocked_reason = guide_flow_eligibility(user)

    return VerificationStatusResponse(
        userId=user.id,
        status=parse_stored_status(user.verification_status),
        role=Role(user.role),
        isVerified=user.is_verified,
        score=user.verification_score,
        reason=user.verification_reason,
        metadata=_parse_metadata_json(user.verification_metadata_json),
        canSubmit=can_submit,
        submitBlockedReason=blocked_reason,
        canAccessGuideFlow=can_access_flow,
        guideFlowBlockedReason=flow_blocked_reason,
    )


def _get_user_or_raise(db: Session, user_id: int) -> User:
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise ValueError("User not found")
    return user


def _parse_metadata_json(raw: str | None) -> dict[str, Any] | None:
    if not raw:
        return None
    try:
        out = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return out if isinstance(out, dict) else None
