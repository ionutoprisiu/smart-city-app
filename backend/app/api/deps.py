"""FastAPI dependencies shared across routes."""

from collections.abc import Generator

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import SessionLocal

http_bearer = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    """Yield a request-scoped DB session and always close it after the response."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
) -> int:
    """Resolve the authenticated user id from a Bearer JWT (``sub`` claim)."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from None
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        return int(sub)
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token") from None


def get_optional_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
) -> int | None:
    """Same as ``get_current_user_id`` but returns ``None`` when no Bearer token is sent."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    try:
        payload = decode_access_token(credentials.credentials)
    except InvalidTokenError:
        return None
    sub = payload.get("sub")
    if sub is None:
        return None
    try:
        return int(sub)
    except (TypeError, ValueError):
        return None
