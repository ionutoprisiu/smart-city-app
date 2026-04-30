"""Discover tourist attractions in Cluj-Napoca via the Overpass API.

Owns parsing/mapping of raw Overpass elements into `TouristAttraction` ORM
objects. The actual HTTP call lives in `app.integrations.overpass_client`.
"""

from __future__ import annotations

import logging
from collections import OrderedDict
from collections.abc import Mapping
from datetime import datetime
from typing import Any

from app.integrations import overpass_client
from app.models.enums import AttractionCategory
from app.models.tourist_attraction import TouristAttraction

log = logging.getLogger(__name__)

CITY = "Cluj-Napoca"


def discover_attractions(lat: float, lon: float, radius_km: float) -> list[TouristAttraction]:
    """Return a deduplicated list of attractions for the given area."""
    try:
        log.info("Discovering attractions in %s (city-wide)", CITY)
        city_wide = _parse_response(
            overpass_client.execute_query(overpass_client.build_city_area_query(CITY))
        )
        if city_wide:
            deduped = _dedupe_attractions(city_wide)
            log.info("Discovered %s city-wide attractions", len(deduped))
            return deduped

        radius_m = radius_km * 1000.0
        around = _parse_response(
            overpass_client.execute_query(overpass_client.build_around_query(lat, lon, radius_m))
        )
        deduped = _dedupe_attractions(around)
        log.info("Discovered %s attractions via fallback around query", len(deduped))
        return deduped
    except Exception as exc:
        log.error("Error discovering attractions: %s", exc)
        return []


def _parse_response(response: Mapping[str, Any]) -> list[TouristAttraction]:
    out: list[TouristAttraction] = []
    elements = response.get("elements")
    if not isinstance(elements, list):
        return out
    for el in elements:
        try:
            attraction = _parse_element(el)
            if attraction is not None:
                out.append(attraction)
        except Exception as exc:
            log.warning("Skipping element: %s", exc)
    return out


def _dedupe_attractions(attractions: list[TouristAttraction]) -> list[TouristAttraction]:
    unique: OrderedDict[str, TouristAttraction] = OrderedDict()
    for attraction in attractions:
        key = _dedupe_key(attraction)
        if key not in unique:
            unique[key] = attraction
    return list(unique.values())


def _dedupe_key(attraction: TouristAttraction) -> str:
    name = (attraction.name or "").strip().lower()
    lat = round(attraction.latitude * 10000)
    lon = round(attraction.longitude * 10000)
    return f"{name}|{lat}|{lon}"


def _parse_element(element: Mapping[str, Any]) -> TouristAttraction | None:
    tags = element.get("tags")
    if not isinstance(tags, dict):
        return None
    name = tags.get("name")
    if not name or not str(name).strip():
        return None

    lat: float | None = None
    lon: float | None = None
    if "lat" in element and "lon" in element:
        lat = float(element["lat"])
        lon = float(element["lon"])
    elif "center" in element and isinstance(element["center"], dict):
        center = element["center"]
        lat = float(center["lat"])
        lon = float(center["lon"])
    if lat is None or lon is None:
        return None

    category = _determine_category(tags)
    description = tags.get("description") or tags.get("tourism") or tags.get("amenity") or ""

    return TouristAttraction(
        name=str(name).strip(),
        description=str(description) if description else "",
        latitude=lat,
        longitude=lon,
        city=CITY,
        category=category.value,
        estimated_visit_time=_estimate_visit_time(category),
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )


def _determine_category(tags: dict[str, Any]) -> AttractionCategory:
    tourism = tags.get("tourism")
    if tourism:
        t = str(tourism).lower()
        if t == "museum":
            return AttractionCategory.MUSEUM
        if t == "attraction":
            return AttractionCategory.MONUMENT
        if t == "gallery":
            return AttractionCategory.MUSEUM
        if t == "viewpoint":
            return AttractionCategory.MONUMENT
        if t == "hotel":
            return AttractionCategory.HOTEL
        if t == "artwork":
            return AttractionCategory.MONUMENT
        return AttractionCategory.OTHER

    amenity = tags.get("amenity")
    if amenity:
        a = str(amenity).lower()
        if a == "cafe":
            return AttractionCategory.CAFE
        if a == "museum":
            return AttractionCategory.MUSEUM
        if a == "theatre":
            return AttractionCategory.THEATER
        if a == "place_of_worship":
            return AttractionCategory.CHURCH
        if a == "library":
            return AttractionCategory.LIBRARY
        if a in ("restaurant", "pub", "bar"):
            return AttractionCategory.RESTAURANT
        return AttractionCategory.OTHER

    if tags.get("historic"):
        return AttractionCategory.MONUMENT
    if tags.get("leisure") == "park":
        return AttractionCategory.PARK
    return AttractionCategory.OTHER


def _estimate_visit_time(category: AttractionCategory) -> int:
    return {
        AttractionCategory.MUSEUM: 90,
        AttractionCategory.RESTAURANT: 60,
        AttractionCategory.PARK: 45,
        AttractionCategory.CAFE: 30,
        AttractionCategory.CHURCH: 30,
        AttractionCategory.MONUMENT: 30,
        AttractionCategory.THEATER: 120,
    }.get(category, 30)
