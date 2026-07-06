from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.errors import register_exception_handlers
from app.api.routes import router as api_router
from app.core.logging import configure_logging
from app.services import warm_up_models


@asynccontextmanager
async def lifespan(_app: FastAPI):
    warm_up_models()  # load InsightFace at startup so the first /verify isn't slow
    yield


def create_app() -> FastAPI:
    configure_logging()
    app = FastAPI(
        title="Verification Service",
        version="1.0.0",
        lifespan=lifespan,
        openapi_tags=[{"name": "system"}, {"name": "verification"}],
    )
    register_exception_handlers(app)
    app.include_router(api_router)
    return app


app = create_app()
