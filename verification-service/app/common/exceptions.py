from __future__ import annotations


class AppError(Exception):
    """Base for domain errors mapped to HTTP responses in api/errors.py."""


class ValidationAppError(AppError):
    """Invalid input the caller can fix (unreadable image, no face) -> 400."""
