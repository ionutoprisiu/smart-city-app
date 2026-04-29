"""HTTP client for the ACO (Ant Colony Optimization) microservice."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 120.0


class AcoServiceError(RuntimeError):
    """Raised when the ACO service is unavailable or returns an error."""


def optimize(payload: dict[str, Any], *, timeout: float = DEFAULT_TIMEOUT) -> dict[str, Any]:
    """POST `/optimize` against the ACO service and return the parsed response."""
    url = f"{settings.aco_service_url.rstrip('/')}/optimize"
    log.info("Calling ACO /optimize")
    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.ConnectError as exc:
        raise AcoServiceError("ACO service is not available. Is the Python service running?") from exc
    except httpx.HTTPStatusError as exc:
        raise AcoServiceError(f"ACO service error: {exc}") from exc
