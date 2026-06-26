from __future__ import annotations


class AppError(Exception):
    pass


class ValidationAppError(AppError):
    pass
