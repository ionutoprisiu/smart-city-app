# Password hashing (bcrypt) and stateless JWT issue/verify — one shared secret, so a
# request is authenticated by decoding the signature alone, without a session store.
from __future__ import annotations

from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain_password: str, stored_hash: str) -> bool:
    # Only bcrypt hashes are accepted; anything else fails closed.
    if not stored_hash.startswith(("$2a$", "$2b$", "$2y$")):
        return False
    return _pwd_context.verify(plain_password, stored_hash)


def create_access_token(subject_user_id: int) -> str:
    now = datetime.now(UTC)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    # sub = the user id the token stands for; exp = when it stops being valid.
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
