"""Overpass-based discovery (ported from Spring AttractionDiscoveryService)."""

from __future__ import annotations

import logging
from collections import OrderedDict
from collections.abc import Mapping
from typing import Any

import httpx

from app.models.enums import AttractionCategory
from app.models.tourist_attraction import TouristAttraction

log = logging.getLogger(__name__)

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
CITY = "Cluj-Napoca"


def discover_attractions(lat: float, lon: float, radius_km: float) -> list[TouristAttraction]:
    try:
        log.info("Discovering attractions in %s (city-wide)", CITY)
        city_wide = _parse_response(_execute_query(_build_city_area_query()))
        if city_wide:
            deduped = _dedupe_attractions(city_wide)
            log.info("Discovered %s city-wide attractions", len(deduped))
            return deduped

        radius_m = radius_km * 1000.0
        around = _parse_response(_execute_query(_build_around_query(lat, lon, radius_m)))
        deduped = _dedupe_attractions(around)
        log.info("Discovered %s attractions via fallback around query", len(deduped))
        return deduped
    except Exception as e:
        log.error("Error discovering attractions: %s", e)
        return []


def _build_around_query(lat: float, lon: float, radius: float) -> str:
    around = f"around:{radius},{lat},{lon}"
    return (
        f"[out:json][timeout:25];("
        f'node["tourism"]["name"]({around});'
        f'way["tourism"]["name"]({around});'
        f'node["amenity"="restaurant"]["name"]({around});'
        f'node["amenity"="cafe"]["name"]({around});'
        f'node["amenity"="museum"]["name"]({around});'
        f'node["amenity"="theatre"]["name"]({around});'
        f'node["historic"]["name"]({around});'
        f'way["historic"]["name"]({around});'
        f'node["leisure"="park"]["name"]({around});'
        f'way["leisure"="park"]["name"]({around});'
        f'node["amenity"="place_of_worship"]["name"]({around});'
        f'way["amenity"="place_of_worship"]["name"]({around});'
        ");out center meta;"
    )


def _build_city_area_query() -> str:
    return """
[out:json][timeout:60];
area["name"="Cluj-Napoca"]["boundary"="administrative"]->.searchArea;
(
  nwr["tourism"~"attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium|artwork"]["name"](area.searchArea);
  nwr["historic"]["name"](area.searchArea);
  nwr["amenity"~"museum|theatre|arts_centre|cinema|place_of_worship|library|university|restaurant|cafe|pub|bar"]["name"](area.searchArea);
  nwr["leisure"~"park|garden|nature_reserve"]["name"](area.searchArea);
  nwr["building"~"church|cathedral|synagogue|chapel"]["name"](area.searchArea);
  nwr["memorial"]["name"](area.searchArea);
);
out center tags;
"""


def _execute_query(query: str) -> dict[str, Any]:
    with httpx.Client(timeout=httpx.Timeout(65.0, connect=10.0)) as client:
        r = client.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": "SmartCityApp/1.0"},
        )
        r.raise_for_status()
        return r.json()


def _parse_response(response: Mapping[str, Any]) -> list[TouristAttraction]:
    out: list[TouristAttraction] = []
    elements = response.get("elements")
    if not isinstance(elements, list):
        return out
    for el in elements:
        try:
            a = _parse_element(el)
            if a is not None:
                out.append(a)
        except Exception as e:
            log.warning("Skipping element: %s", e)
    return out


def _dedupe_attractions(attractions: list[TouristAttraction]) -> list[TouristAttraction]:
    unique: OrderedDict[str, TouristAttraction] = OrderedDict()
    for a in attractions:
        key = _dedupe_key(a)
        if key not in unique:
            unique[key] = a
    return list(unique.values())


def _dedupe_key(a: TouristAttraction) -> str:
    name = (a.name or "").strip().lower()
    lat = round(a.latitude * 10000)
    lon = round(a.longitude * 10000)
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
        c = element["center"]
        lat = float(c["lat"])
        lon = float(c["lon"])
    if lat is None or lon is None:
        return None

    category = _determine_category(tags)
    desc = tags.get("description") or tags.get("tourism") or tags.get("amenity") or ""

    return TouristAttraction(
        name=str(name).strip(),
        description=str(desc) if desc else "",
        latitude=lat,
        longitude=lon,
        city=CITY,
        category=category.value,
        estimated_visit_time=_estimate_visit_time(category),
        is_active=True,
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
