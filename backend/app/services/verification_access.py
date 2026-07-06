"""Eligibility rules for the identity-verification flow.

Each function answers "can this user do X right now?" from their current status,
returning (allowed, reason) so the UI can both block the action and explain why.
"""
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
    # Only a plain USER in NOT_SUBMITTED may upload; every other state is blocked
    # with a specific reason (already guide, under review, locked, etc.).
    if user.role in (Role.ADMIN.value, Role.GUIDE.value):
        return False, "You are already a guide."

    status = parse_stored_status(user.verification_status)
    if status == VerificationStatus.NOT_SUBMITTED:
        return True, None
    if status == VerificationStatus.MANUAL_REVIEW:
        return False, "Your documents are under admin review. Wait for a decision."
    if status == VerificationStatus.REJECTED:
        return False, "Upload is locked until an admin allows a new submission."
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
    if status == VerificationStatus.REJECTED:
        return False, "Upload is locked until an admin allows a new submission."
    if status == VerificationStatus.PENDING:
        return False, "Your verification is pending."
    return True, None


def ensure_can_submit(user: User) -> None:
    can_submit, reason = submit_eligibility(user)
    if not can_submit:
        raise ValueError(reason or "Upload is not available right now.")
