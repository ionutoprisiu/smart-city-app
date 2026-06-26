from __future__ import annotations


class AppError(Exception):
    pass


class NotFoundError(AppError):
    pass


class ValidationAppError(AppError):
    pass
