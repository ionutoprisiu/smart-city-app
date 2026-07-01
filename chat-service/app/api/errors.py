from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.common.exceptions import AppError, ConflictError, NotFoundError, ValidationAppError

log = logging.getLogger(__name__)

# Each domain error maps to one HTTP status. PermissionError (built-in) means
# "not allowed" -> 403. The catch-all AppError -> 500 stays last.
_STATUS_BY_ERROR: list[tuple[type[Exception], int]] = [
    (NotFoundError, 404),
    (ValidationAppError, 400),
    (ConflictError, 409),
    (PermissionError, 403),
]


def register_exception_handlers(app: FastAPI) -> None:
    def _make_handler(status_code: int):
        async def handler(_request: Request, exc: Exception) -> JSONResponse:
            return JSONResponse(status_code=status_code, content={"detail": str(exc)})

        return handler

    for error_type, status_code in _STATUS_BY_ERROR:
        app.add_exception_handler(error_type, _make_handler(status_code))

    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        log.warning("Unhandled AppError: %s", exc)
        return JSONResponse(status_code=500, content={"detail": str(exc)})
