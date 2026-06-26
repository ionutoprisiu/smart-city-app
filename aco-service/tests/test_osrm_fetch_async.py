from __future__ import annotations

from unittest.mock import MagicMock

import httpx
import pytest

from app.integrations import osrm_client


@pytest.mark.asyncio
async def test_fetch_matrices_returns_none_on_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    class BoomClient:
        async def __aenter__(self) -> BoomClient:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def get(self, _url: str) -> None:
            raise httpx.ConnectError("simulated network failure")

    def _client_factory(**_kwargs: object) -> BoomClient:
        return BoomClient()

    monkeypatch.setattr(httpx, "AsyncClient", _client_factory)
    pts = [{"id": 1, "latitude": 46.77, "longitude": 23.59}]
    dist, dur = await osrm_client.fetch_matrices(pts, "driving")
    assert dist is None and dur is None


@pytest.mark.asyncio
async def test_fetch_matrices_returns_none_on_non_ok_json(monkeypatch: pytest.MonkeyPatch) -> None:
    class OkClient:
        async def __aenter__(self) -> OkClient:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def get(self, _url: str) -> MagicMock:
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            resp.json.return_value = {"code": "NoRoute"}
            return resp

    monkeypatch.setattr(httpx, "AsyncClient", lambda **_k: OkClient())
    pts = [
        {"id": 1, "latitude": 46.77, "longitude": 23.59},
        {"id": 2, "latitude": 46.78, "longitude": 23.60},
    ]
    dist, dur = await osrm_client.fetch_matrices(pts, "driving")
    assert dist is None and dur is None
