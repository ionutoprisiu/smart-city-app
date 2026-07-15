# Eligibility rules for the identity-verification flow: each function answers "can
# this user do X right now?" as (allowed, reason), so the UI can block and explain.
from __future__ import annotations

from app.models.enums import Role, VerificationStatus
from app.models.user import User


def parse_stored_status(raw: str) -> VerificationStatus:
    # Tolerate unknown/corrupt values by treating them as REJECTED (fail closed).
    try:
        return VerificationStatus(raw)
    except ValueError:
        return VerificationStatus.REJECTED


def submit_eligibility(user: User) -> tuple[bool, str | None]:
    # A plain USER may upload from NOT_SUBMITTED and may retry directly after a
    # REJECTED outcome (better photos, new attempt); review/approved/pending
    # states stay blocked with a specific reason.
    if user.role in (Role.ADMIN.value, Role.GUIDE.value):
        return False, "You are already a guide."

    status = parse_stored_status(user.verification_status)
    if status in (VerificationStatus.NOT_SUBMITTED, VerificationStatus.REJECTED):
        return True, None
    if status == VerificationStatus.MANUAL_REVIEW:
        return False, "Your documents are under admin review. Wait for a decision."
    if status == VerificationStatus.APPROVED:
        return False, "Your identity is already verified."
    if status == VerificationStatus.PENDING:
        return False, "Your verification is pending."
    return False, "Upload is not available right now."


def guide_flow_eligibility(user: User) -> tuple[bool, str | None]:
    if user.role in (Role.ADMIN.value, Role.GUIDE.value):
        return False, "You are already a guide."

    status = parse_stored_status(user.verification_status)
    if status == VerificationStatus.MANUAL_REVIEW:
        return False, "Your documents are under admin review. Wait for a decision."
    if status == VerificationStatus.PENDING:
        return False, "Your verification is pending."
    # NOT_SUBMITTED and REJECTED both open the flow (a rejected user retries).
    return True, None


def ensure_can_submit(user: User) -> None:
    can_submit, reason = submit_eligibility(user)
    if not can_submit:
        raise ValueError(reason or "Upload is not available right now.")
