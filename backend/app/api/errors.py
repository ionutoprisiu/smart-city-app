"""Global exception handlers attached to the FastAPI app.

Keeps the route layer free of repetitive try/except boilerplate by mapping
common application-level exceptions to consistent HTTP responses.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.common.exceptions import AppError, NotFoundError, ValidationAppError

log = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    """Attach the project-wide exception handlers to the given FastAPI app."""

    @app.exception_handler(NotFoundError)
    async def handle_not_found(_request: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    @app.exception_handler(ValidationAppError)
    async def handle_validation(_request: Request, exc: ValidationAppError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        log.warning("Unhandled AppError: %s", exc)
        return JSONResponse(status_code=500, content={"detail": str(exc)})
