from __future__ import annotations


class AppError(Exception):
    """Base for domain errors mapped to HTTP responses in api/errors.py."""


class NotFoundError(AppError):
    """Requested resource does not exist -> 404."""


class ValidationAppError(AppError):
    """Invalid input the client can fix -> 400."""


class ConflictError(AppError):
    """Request conflicts with current state (e.g. duplicate email) -> 409."""


class UnauthorizedError(AppError):
    """Missing or invalid credentials -> 401."""


class ServiceUnavailableError(AppError):
    """A required downstream service is unreachable -> 503."""


class BadGatewayError(AppError):
    """A downstream service returned an invalid response -> 502."""
