from __future__ import annotations

from app.integrations.osrm_client import _anchor_segment, _straight_line


def test_anchor_empty_segment_returns_straight_line() -> None:
    start = {"latitude": 46.77, "longitude": 23.59}
    end = {"latitude": 46.78, "longitude": 23.60}
    out = _anchor_segment([], start, end)
    assert out == _straight_line(start, end)


def test_anchor_first_point_identical_to_start_snaps() -> None:
    start = {"latitude": 46.77, "longitude": 23.59}
    end = {"latitude": 46.79, "longitude": 23.61}
    seg = [
        {"latitude": 46.77, "longitude": 23.59},
        {"latitude": 46.785, "longitude": 23.605},
        {"latitude": 46.79, "longitude": 23.61},
    ]
    out = _anchor_segment(seg, start, end)
    assert out[0] == {"latitude": start["latitude"], "longitude": start["longitude"]}


def test_anchor_last_point_identical_to_end_snaps() -> None:
    start = {"latitude": 46.76, "longitude": 23.58}
    end = {"latitude": 46.79, "longitude": 23.61}
    seg = [
        {"latitude": 46.76, "longitude": 23.58},
        {"latitude": 46.775, "longitude": 23.595},
        {"latitude": 46.79, "longitude": 23.61},
    ]
    out = _anchor_segment(seg, start, end)
    assert out[-1] == {"latitude": end["latitude"], "longitude": end["longitude"]}


def test_anchor_does_not_snap_when_far_from_poi() -> None:
    start = {"latitude": 46.0, "longitude": 23.0}
    end = {"latitude": 47.0, "longitude": 24.0}
    seg = [
        {"latitude": 46.5, "longitude": 23.5},
        {"latitude": 46.7, "longitude": 23.7},
    ]
    out = _anchor_segment(seg, start, end)
    assert out[0] == seg[0]
    assert out[-1] == seg[-1]


def test_anchor_trims_tail_loop_past_destination() -> None:
    start = {"latitude": 46.77, "longitude": 23.59}
    end = {"latitude": 46.771, "longitude": 23.591}
    seg = [
        {"latitude": 46.77, "longitude": 23.59},
        {"latitude": 46.7705, "longitude": 23.5905},
        {"latitude": 46.771, "longitude": 23.591},
        {"latitude": 46.7708, "longitude": 23.5908},
        {"latitude": 46.7706, "longitude": 23.5906},
    ]
    out = _anchor_segment(seg, start, end)
    assert len(out) == 3
    assert out[-1] == {"latitude": end["latitude"], "longitude": end["longitude"]}
