from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


def _status_for_register(message: str) -> int:
    if "already exists" in message or "Invalid" in message:
        return 400
    return 201


def _status_for_login(message: str) -> int:
    if "Invalid" in message:
        return 401
    return 200


@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)) -> JSONResponse:
    r = auth_service.register(db, req)
    body = r.model_dump(mode="json")
    return JSONResponse(status_code=_status_for_register(r.message), content=body)


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)) -> JSONResponse:
    r = auth_service.login(db, req)
    body = r.model_dump(mode="json")
    return JSONResponse(status_code=_status_for_login(r.message), content=body)
