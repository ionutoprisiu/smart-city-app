"""HTTP client for the AI microservice (support Q/A matching)."""

from __future__ import annotations

import logging

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

HTTP_TIMEOUT_SECONDS = 90.0


class AiServiceError(RuntimeError):
    """Raised when the AI service is unavailable or returns an HTTP error."""


def support_match(*, message: str, candidates: list[dict[str, object]]) -> dict[str, object]:
    url = f"{settings.ai_service_url.rstrip('/')}/api/v1/support/match"
    payload = {"message": message, "candidates": candidates}
    log.info("Calling AI /api/v1/support/match")
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT_SECONDS) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.ConnectError as exc:
        raise AiServiceError("AI service is not available. Is the ai-service container running?") from exc
    except httpx.HTTPStatusError as exc:
        raise AiServiceError(f"AI service error: {exc}") from exc
