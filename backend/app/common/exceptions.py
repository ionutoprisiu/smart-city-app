"""Application-level exceptions (transport-agnostic; mapped to HTTP in ``api.errors``)."""

from __future__ import annotations


class AppError(Exception):
    """Base class for recoverable application errors."""


class NotFoundError(AppError):
    """Raised when a referenced entity does not exist."""


class ValidationAppError(AppError):
    """Raised when input is invalid for business rules."""
