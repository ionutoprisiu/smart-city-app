"""Support AI microservice (FastAPI): LLM-backed matching with lexical fallback."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.support import router as support_router
from app.core.config import settings

LOG_FORMAT = "%(asctime)s  %(levelname)-8s  %(name)s  %(message)s"

logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, force=True)

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    support_router,
    prefix="/api/v1/support",
    tags=["support"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
