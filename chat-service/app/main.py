from __future__ import annotations

import logging

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.messages import router as messages_router
from app.core.config import settings
from app.socket.handlers import sio

LOG_FORMAT = "%(asctime)s  %(levelname)-8s  %(name)s  %(message)s"
logging.basicConfig(level=logging.INFO, format=LOG_FORMAT, force=True)

fastapi_app = FastAPI(title=settings.app_name, version="1.0.0")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.include_router(messages_router)


@fastapi_app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


asgi_app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)
