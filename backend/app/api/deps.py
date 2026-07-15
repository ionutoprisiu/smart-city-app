from collections.abc import Generator

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import SessionLocal
from app.models.enums import Role
from app.models.user import User

http_bearer = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    # One DB session per request; always closed, even if the handler raises.
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer),
) -> int:
    # Identify the caller from the Bearer token alone (stateless — no DB hit).
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


def require_admin_user_id(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> int:
    # Gate for /api/admin/* — a valid token is not enough, the role must be ADMIN.
    user = db.get(User, user_id)
    if user is None or user.role != Role.ADMIN.value:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_id
