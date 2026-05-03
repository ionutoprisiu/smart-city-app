"""Async tests for ``osrm_client.fetch_route_segments`` edge cases."""

from __future__ import annotations

from unittest.mock import MagicMock

import httpx
import pytest

from app.integrations import osrm_client


@pytest.mark.asyncio
async def test_fetch_route_segments_single_point_no_http() -> None:
    pts = [{"id": 0, "latitude": 46.77, "longitude": 23.59}]
    segs, durs = await osrm_client.fetch_route_segments(pts, "driving")
    assert durs == []
    assert len(segs) == 1
    assert segs[0][0]["latitude"] == pytest.approx(46.77)


@pytest.mark.asyncio
async def test_fetch_route_segments_non_ok_json_uses_straight_lines(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Client:
        async def __aenter__(self) -> Client:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def get(self, _url: str) -> MagicMock:
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            resp.json.return_value = {"code": "NoRoute", "routes": []}
            return resp

    monkeypatch.setattr(httpx, "AsyncClient", lambda **_k: Client())
    a = {"id": 0, "latitude": 46.77, "longitude": 23.59}
    b = {"id": 1, "latitude": 46.78, "longitude": 23.60}
    segs, durs = await osrm_client.fetch_route_segments([a, b], "driving")
    assert len(segs) == 1
    assert len(segs[0]) == 2
    assert segs[0][0]["latitude"] == a["latitude"]
    assert segs[0][1]["latitude"] == b["latitude"]
    assert durs == [0.0]


@pytest.mark.asyncio
async def test_fetch_route_segments_http_error_falls_back_straight_lines(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class Boom:
        async def __aenter__(self) -> Boom:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def get(self, _url: str) -> None:
            raise httpx.TimeoutException("slow")

    monkeypatch.setattr(httpx, "AsyncClient", lambda **_k: Boom())
    a = {"id": 0, "latitude": 46.77, "longitude": 23.59}
    b = {"id": 1, "latitude": 46.78, "longitude": 23.60}
    c = {"id": 2, "latitude": 46.79, "longitude": 23.61}
    segs, durs = await osrm_client.fetch_route_segments([a, b, c], "foot")
    assert len(segs) == 2
    assert durs == [0.0, 0.0]
    assert segs[0][1]["latitude"] == b["latitude"]
    assert segs[1][1]["latitude"] == c["latitude"]


@pytest.mark.asyncio
async def test_fetch_route_segments_first_leg_ok_second_raises_rebuilds_straight_lines(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """If any leg fails after partial success, the handler replaces all legs with straight lines."""

    class Stateful:
        def __init__(self) -> None:
            self.calls = 0

        async def __aenter__(self) -> Stateful:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def get(self, _url: str) -> MagicMock:
            self.calls += 1
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            if self.calls == 1:
                resp.json.return_value = {
                    "code": "Ok",
                    "routes": [
                        {
                            "duration": 10.0,
                            "geometry": {"coordinates": [[23.59, 46.77], [23.60, 46.78]]},
                        }
                    ],
                }
            else:
                raise httpx.ConnectError("second leg down")
            return resp

    st = Stateful()
    monkeypatch.setattr(httpx, "AsyncClient", lambda **_k: st)
    a = {"id": 0, "latitude": 46.77, "longitude": 23.59}
    b = {"id": 1, "latitude": 46.78, "longitude": 23.60}
    c = {"id": 2, "latitude": 46.79, "longitude": 23.61}
    segs, durs = await osrm_client.fetch_route_segments([a, b, c], "driving")
    assert len(segs) == 2
    assert durs == [0.0, 0.0]
    assert segs[0] == [
        {"latitude": a["latitude"], "longitude": a["longitude"]},
        {"latitude": b["latitude"], "longitude": b["longitude"]},
    ]
    assert segs[1][1]["latitude"] == c["latitude"]


@pytest.mark.asyncio
async def test_fetch_route_segments_ok_geometry(monkeypatch: pytest.MonkeyPatch) -> None:
    class Client:
        async def __aenter__(self) -> Client:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def get(self, _url: str) -> MagicMock:
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            resp.json.return_value = {
                "code": "Ok",
                "routes": [
                    {
                        "duration": 90.0,
                        "geometry": {"coordinates": [[23.59, 46.77], [23.60, 46.78]]},
                    }
                ],
            }
            return resp

    monkeypatch.setattr(httpx, "AsyncClient", lambda **_k: Client())
    a = {"id": 0, "latitude": 46.77, "longitude": 23.59}
    b = {"id": 1, "latitude": 46.78, "longitude": 23.60}
    segs, durs = await osrm_client.fetch_route_segments([a, b], "driving")
    assert len(segs) == 1
    assert durs == [90.0]
    assert segs[0][0]["latitude"] == pytest.approx(46.77)
    assert segs[0][-1]["latitude"] == pytest.approx(46.78)
