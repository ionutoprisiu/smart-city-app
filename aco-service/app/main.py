"""ACO route optimization service — FastAPI entry point."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_exception_handlers
from app.api.routes import optimize
from app.core.config import settings
from app.core.logging import configure_logging

configure_logging()

app = FastAPI(title="ACO Route Optimization", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)
app.include_router(optimize.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
