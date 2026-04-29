"""Shared application-level exceptions.

These are mapped to HTTP responses by the handlers in `app.api.errors`.
Keep them transport-agnostic (no FastAPI/HTTP imports here).
"""

from __future__ import annotations


class AppError(Exception):
    """Base class for application-level errors."""


class NotFoundError(AppError):
    """Raised when a requested entity does not exist."""


class ValidationAppError(AppError):
    """Raised when input is structurally valid but violates business rules."""
