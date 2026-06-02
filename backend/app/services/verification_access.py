from __future__ import annotations

from app.models.enums import Role, VerificationStatus
from app.models.user import User


def parse_stored_status(raw: str) -> VerificationStatus:
    try:
        return VerificationStatus(raw)
    except ValueError:
        return VerificationStatus.REJECTED


def submit_eligibility(user: User) -> tuple[bool, str | None]:
    if user.role in (Role.ADMIN.value, Role.ORGANIZER.value):
        return False, "You are already an organizer."

    status = parse_stored_status(user.verification_status)
    if status == VerificationStatus.NOT_SUBMITTED:
        return True, None
    if status == VerificationStatus.MANUAL_REVIEW:
        return False, "Your documents are under admin review. Wait for a decision."
    if status == VerificationStatus.REJECTED:
        return False, "Upload is locked until an admin allows a new submission."
    if status == VerificationStatus.APPROVED:
        return False, "Your identity is already verified."
    return False, "Upload is not available right now."


def organizer_flow_eligibility(user: User) -> tuple[bool, str | None]:
    """Whether the user may open the organizer / verification screen."""
    if user.role in (Role.ADMIN.value, Role.ORGANIZER.value):
        return False, "You are already an organizer."

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
