from __future__ import annotations

from typing import Any

import httpx

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "SmartCityApp/1.0"
DEFAULT_TIMEOUT = httpx.Timeout(65.0, connect=10.0)


def execute_query(query: str) -> dict[str, Any]:
    with httpx.Client(timeout=DEFAULT_TIMEOUT) as client:
        response = client.post(
            OVERPASS_URL,
            data={"data": query},
            headers={"User-Agent": USER_AGENT},
        )
        response.raise_for_status()
        return response.json()


def build_around_query(lat: float, lon: float, radius_m: float) -> str:
    around = f"around:{radius_m},{lat},{lon}"
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


def build_city_area_query(city_name: str) -> str:
    return f"""
[out:json][timeout:60];
area["name"="{city_name}"]["boundary"="administrative"]->.searchArea;
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
