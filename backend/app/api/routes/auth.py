from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.auth import LoginRequest, RegisterRequest
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)) -> JSONResponse:
    r = auth_service.register(db, req)
    body = r.model_dump(mode="json")
    if "already exists" in r.message or "Invalid" in r.message:
        return JSONResponse(status_code=400, content=body)
    return JSONResponse(status_code=201, content=body)


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)) -> JSONResponse:
    r = auth_service.login(db, req)
    body = r.model_dump(mode="json")
    if "Invalid" in r.message:
        return JSONResponse(status_code=401, content=body)
    return JSONResponse(status_code=200, content=body)
