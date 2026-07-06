from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

HTTP_TIMEOUT_SECONDS = 120.0


class AcoServiceError(RuntimeError):
    pass


def optimize(payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{settings.aco_service_url.rstrip('/')}/optimize"
    log.info("Calling ACO /optimize")
    try:
        with httpx.Client(timeout=HTTP_TIMEOUT_SECONDS) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.ConnectError as exc:
        raise AcoServiceError("Serviciul de optimizare este momentan indisponibil. Încearcă din nou în câteva momente.") from exc
    except httpx.HTTPStatusError as exc:
        raise AcoServiceError("Serviciul de optimizare a întâmpinat o eroare. Încearcă din nou.") from exc
