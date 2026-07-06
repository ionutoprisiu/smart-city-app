from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

HTTP_TIMEOUT_SECONDS = 60.0


class VerificationServiceError(RuntimeError):
    pass


async def submit(
    *,
    user_id: int,
    id_card_filename: str,
    id_card_bytes: bytes,
    selfie_filename: str,
    selfie_bytes: bytes,
) -> dict[str, Any]:
    url = f"{settings.verification_service_url.rstrip('/')}/verify"
    log.info("Calling verification /verify for user_id=%s", user_id)

    try:
        async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
            # multipart/form-data: the two images travel as file parts, userId as a field.
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
