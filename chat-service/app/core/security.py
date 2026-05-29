from __future__ import annotations

import jwt

from app.core.config import settings


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )


def user_id_from_token(token: str) -> int:
    payload = decode_access_token(token)
    sub = payload.get("sub")
    if sub is None:
        raise ValueError("Invalid token")
    return int(sub)
