from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from app.common.exceptions import VerificationInputError


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(VerificationInputError)
    async def handle_verification_input_error(_request: Request, exc: VerificationInputError) -> JSONResponse:
        return JSONResponse(status_code=400, content={"detail": str(exc)})

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
        if isinstance(exc, HTTPException):
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        return JSONResponse(status_code=500, content={"detail": f"Verification failed: {exc}"})

