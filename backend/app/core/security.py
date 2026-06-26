from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain_password: str, stored_hash: str) -> bool:
    if stored_hash.startswith(("$2a$", "$2b$", "$2y$")):
        return _pwd_context.verify(plain_password, stored_hash)
    # legacy dev rows may store plaintext
    return secrets.compare_digest(plain_password, stored_hash)


def create_access_token(subject_user_id: int) -> str:
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": str(subject_user_id),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )


__all__ = ["create_access_token", "decode_access_token", "hash_password", "verify_password"]
