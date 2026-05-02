"""FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_exception_handlers
from app.api.routes import activities, auth, verification, visit_city
from app.core.config import settings
from app.core.logging import configure_logging
from app.db import Base, engine
from app.db.schema_updates import apply_non_destructive_updates
from app.db.seed import seed_admin_user_if_enabled, seed_demo_user_if_enabled
from app.db.session import SessionLocal
from app.models import ActivityEvent, Club, ClubMembership, TouristAttraction, User  # noqa: F401 — register metadata

configure_logging()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    apply_non_destructive_updates(engine)
    db = SessionLocal()
    try:
        seed_admin_user_if_enabled(db)
        seed_demo_user_if_enabled(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Smart City API", lifespan=lifespan)

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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
