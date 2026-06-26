from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.errors import register_exception_handlers
from app.api.routes import optimize, research
from app.core.config import settings
from app.core.logging import configure_logging

configure_logging()

app = FastAPI(
    title="ACO Route Optimization",
    version="2.0.0",
    description="Route optimization with ACO over OSRM or Haversine cost matrices.",
    openapi_tags=[
        {"name": "optimize", "description": "Optimize visit order for a set of coordinates."},
        {"name": "research", "description": "Offline algorithm benchmarks."},
        {"name": "health", "description": "Liveness probe."},
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
app.include_router(optimize.router)
app.include_router(research.router)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
