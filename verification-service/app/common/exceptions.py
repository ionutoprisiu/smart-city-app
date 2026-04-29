class VerificationError(Exception):
    """Base error for verification flow."""


class VerificationInputError(VerificationError):
    """Raised when user-provided images are invalid."""

