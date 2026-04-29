"""Shared application-level exceptions.

Mapped to HTTP responses by `app.api.errors`. Keep them transport-agnostic.
"""

from __future__ import annotations


class AppError(Exception):
    """Base class for application-level errors."""


class ValidationAppError(AppError):
    """Raised when input is structurally valid but violates business rules."""
