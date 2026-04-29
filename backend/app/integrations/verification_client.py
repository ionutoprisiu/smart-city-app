"""HTTP client for the Verification microservice (face + ID OCR)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 60.0


class VerificationServiceError(RuntimeError):
    """Raised when the verification service is unavailable or returns an error."""


async def submit(
    *,
    user_id: int,
    id_card_filename: str,
    id_card_bytes: bytes,
    selfie_filename: str,
    selfie_bytes: bytes,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """POST `/verify` with multipart payload and return the parsed JSON body."""
    url = f"{settings.verification_service_url.rstrip('/')}/verify"
    log.info("Calling verification /verify for user_id=%s", user_id)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                url,
                data={"userId": str(user_id)},
                files={
                    "idCardImage": (id_card_filename, id_card_bytes, "image/jpeg"),
                    "selfieImage": (selfie_filename, selfie_bytes, "image/jpeg"),
                },
            )
    except httpx.HTTPError as exc:
        raise VerificationServiceError("Verification service unavailable") from exc

    if response.status_code >= 400:
        message = "Verification failed"
        try:
            details = response.json()
            message = str(details.get("detail", message))
        except Exception:
            pass
        raise VerificationServiceError(message)

    return response.json()
