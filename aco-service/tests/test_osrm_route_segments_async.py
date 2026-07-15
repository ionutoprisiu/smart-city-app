from __future__ import annotations

from unittest.mock import MagicMock

import httpx
import pytest

from app.integrations import osrm_client


def _route_ok_response(*, legs: list[dict], geometry_coords: list[list[float]]) -> dict:
    return {
        "code": "Ok",
        "routes": [
            {
                "duration": sum(float(leg.get("duration", 0)) for leg in legs),
                "geometry": {"coordinates": geometry_coords},
                "legs": legs,
            }
        ],
    }


@pytest.mark.asyncio
async def test_fetch_route_details_single_point_no_http() -> None:
    pts = [{"id": 0, "latitude": 46.77, "longitude": 23.59}]
    geom, segs, durs = await osrm_client.fetch_route_details(pts, "driving")
    assert durs == []
    assert len(segs) == 1
    assert segs[0][0]["latitude"] == pytest.approx(46.77)
    assert geom[0]["latitude"] == pytest.approx(46.77)


@pytest.mark.asyncio
async def test_fetch_route_details_non_ok_json_uses_straight_lines(
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
    geom, segs, durs = await osrm_client.fetch_route_details([a, b], "driving")
    assert len(segs) == 1
    assert len(segs[0]) == 2
    assert segs[0][0]["latitude"] == a["latitude"]
    assert segs[0][1]["latitude"] == b["latitude"]
    assert durs == [0.0]
    assert len(geom) == 2


@pytest.mark.asyncio
async def test_fetch_route_details_http_error_falls_back_straight_lines(
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
    geom, segs, durs = await osrm_client.fetch_route_details([a, b, c], "foot")
    assert len(segs) == 2
    assert durs == [0.0, 0.0]
    assert segs[0][1]["latitude"] == b["latitude"]
    assert segs[1][1]["latitude"] == c["latitude"]
    assert len(geom) >= 3


@pytest.mark.asyncio
async def test_fetch_route_details_ok_multi_leg_geometry(monkeypatch: pytest.MonkeyPatch) -> None:
    class Client:
        async def __aenter__(self) -> Client:
            return self

        async def __aexit__(self, *_args: object) -> None:
            return None

        async def get(self, _url: str) -> MagicMock:
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            resp.json.return_value = _route_ok_response(
                geometry_coords=[[23.59, 46.77], [23.595, 46.775], [23.60, 46.78], [23.61, 46.79]],
                legs=[
                    {
                        "duration": 60.0,
                        "steps": [
                            {
                                "geometry": {
                                    "coordinates": [[23.59, 46.77], [23.595, 46.775], [23.60, 46.78]],
                                }
                            }
                        ],
                    },
                    {
                        "duration": 40.0,
                        "steps": [
                            {
                                "geometry": {
                                    "coordinates": [[23.60, 46.78], [23.61, 46.79]],
                                }
                            }
                        ],
                    },
                ],
            )
            return resp

    monkeypatch.setattr(httpx, "AsyncClient", lambda **_k: Client())
    a = {"id": 0, "latitude": 46.77, "longitude": 23.59}
    b = {"id": 1, "latitude": 46.78, "longitude": 23.60}
    c = {"id": 2, "latitude": 46.79, "longitude": 23.61}
    geom, segs, durs = await osrm_client.fetch_route_details([a, b, c], "driving")
    assert len(segs) == 2
    assert durs == [60.0, 40.0]
    assert len(segs[0]) == 3
    assert len(segs[1]) == 2
    assert len(geom) == 4
