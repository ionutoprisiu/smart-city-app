from __future__ import annotations


# Base for domain errors mapped to HTTP responses in api/errors.py.
class AppError(Exception):
    pass


# Invalid input the caller can fix (unreadable image, no face) -> 400.
class ValidationAppError(AppError):
    pass
