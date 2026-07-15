from __future__ import annotations


# Base for domain errors; api/errors.py maps each one to its HTTP status.
class AppError(Exception):
    pass


# Requested resource does not exist -> 404.
class NotFoundError(AppError):
    pass


# Invalid input the client can fix -> 400.
class ValidationAppError(AppError):
    pass


# Request conflicts with current state (e.g. duplicate email) -> 409.
class ConflictError(AppError):
    pass


# Missing or invalid credentials -> 401.
class UnauthorizedError(AppError):
    pass


# A required downstream service is unreachable -> 503.
class ServiceUnavailableError(AppError):
    pass


# A downstream service returned an invalid response -> 502.
class BadGatewayError(AppError):
    pass
