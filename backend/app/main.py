from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401
from app.api.errors import register_exception_handlers
from app.api.routes import activities, admin, auth, verification, visit_city
from app.core.config import settings
from app.core.logging import configure_logging
from app.db import Base, engine
from app.db.schema_updates import apply_non_destructive_updates
from app.db.seed import (
    seed_admin_user_if_enabled,
    seed_core_attractions_if_empty,
)
from app.db.session import SessionLocal
from app.services import visit_city_service

configure_logging()
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings.verification_upload_dir_path.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    apply_non_destructive_updates(engine)
    db = SessionLocal()
    try:
        seed_admin_user_if_enabled(db)
        seed_core_attractions_if_empty(db)
        if settings.sync_attractions_on_startup:
            try:
                stats = visit_city_service.sync_attractions(db)
                log.info(
                    "Attraction catalog synced from OSM: discovered=%s processed=%s totalActive=%s",
                    stats["discovered"],
                    stats["processed"],
                    stats["totalActive"],
                )
            except Exception:
                log.exception(
                    "Overpass sync at startup failed; continuing with existing catalog in DB"
                )
    finally:
        db.close()
    yield


app = FastAPI(
    title="Smart City API",
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {"name": "system"},
        {"name": "auth"},
        {"name": "visit-city"},
        {"name": "verification"},
        {"name": "activities"},
        {"name": "admin"},
    ],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_exception_handlers(app)

app.include_router(auth.router, prefix="/api")
app.include_router(visit_city.router, prefix="/api")
app.include_router(verification.router, prefix="/api")
app.include_router(activities.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}
