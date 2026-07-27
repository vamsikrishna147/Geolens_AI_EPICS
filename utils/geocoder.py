"""
GeoLens AI - Geocoder Utility
================================
Converts location names (e.g. "Konaseema district, Andhra Pradesh")
into coordinates and bounding boxes using the Nominatim OpenStreetMap API.

All results are cached in memory to respect Nominatim's 1 req/sec rate limit
and avoid redundant API calls within a session.
"""

import json
import os
import time
from functools import lru_cache
from typing import Optional

import requests

# Respect Nominatim's usage policy: max 1 request/second
_LAST_REQUEST_TIME = 0.0
_CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "geocode_cache.json")

# In-memory cache (also persisted to file across sessions)
_geocode_cache: dict = {}


def _load_cache() -> None:
    """Load the geocode cache from disk if it exists."""
    global _geocode_cache
    os.makedirs(os.path.dirname(_CACHE_FILE), exist_ok=True)
    if os.path.exists(_CACHE_FILE):
        try:
            with open(_CACHE_FILE, "r", encoding="utf-8") as f:
                _geocode_cache = json.load(f)
        except Exception:
            _geocode_cache = {}


def _save_cache() -> None:
    """Persist the geocode cache to disk."""
    os.makedirs(os.path.dirname(_CACHE_FILE), exist_ok=True)
    with open(_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(_geocode_cache, f, indent=2)


def _rate_limit() -> None:
    """Enforce 1 request/second for Nominatim."""
    global _LAST_REQUEST_TIME
    elapsed = time.time() - _LAST_REQUEST_TIME
    if elapsed < 1.1:
        time.sleep(1.1 - elapsed)
    _LAST_REQUEST_TIME = time.time()


def geocode_location(location: str) -> Optional[dict]:
    """
    Geocode a location name to coordinates and bounding box.

    Args:
        location: Human-readable location string.
                  e.g. "Konaseema district, Andhra Pradesh, India"
                       "Amazon rainforest, Brazil"
                       "Hyderabad, India"

    Returns:
        Dictionary with keys:
          - display_name: Full formatted name from Nominatim
          - lat: Latitude (center)
          - lon: Longitude (center)
          - bbox: [south, north, west, east] bounding box
          - bbox_str: "west,south,east,north" (GEE/Overpass format)
          - country: Country code (e.g. "IN", "BR")
        Returns None if geocoding fails.
    """
    global _geocode_cache

    # Load cache on first use
    if not _geocode_cache:
        _load_cache()

    # Check cache
    cache_key = location.lower().strip()
    if cache_key in _geocode_cache:
        return _geocode_cache[cache_key]

    # Call Nominatim API
    _rate_limit()
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": location,
                "format": "json",
                "addressdetails": 1,
                "limit": 1,
            },
            headers={
                "User-Agent": "GeoLensAI/1.0 (autonomous geospatial research platform)",
                "Accept-Language": "en",
            },
            timeout=10,
        )
        response.raise_for_status()
        results = response.json()

        if not results:
            print(f"[Geocoder] No results found for: '{location}'")
            return None

        r = results[0]
        bbox = r.get("boundingbox", [])  # [south, north, west, east]

        if len(bbox) < 4:
            # No bounding box — use small box around center point
            lat, lon = float(r["lat"]), float(r["lon"])
            bbox = [lat - 0.1, lat + 0.1, lon - 0.1, lon + 0.1]

        south, north, west, east = (
            float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])
        )

        result = {
            "display_name": r.get("display_name", location),
            "lat": float(r["lat"]),
            "lon": float(r["lon"]),
            "bbox": [south, north, west, east],
            "bbox_str": f"{west},{south},{east},{north}",
            "bbox_ee": [west, south, east, north],  # Earth Engine format [xmin, ymin, xmax, ymax]
            "country": r.get("address", {}).get("country_code", "").upper(),
            "type": r.get("type", "unknown"),
            "osm_type": r.get("osm_type", "unknown"),
        }

        # Save to cache
        _geocode_cache[cache_key] = result
        _save_cache()

        print(f"[Geocoder] '{location}' -> lat={result['lat']:.4f}, lon={result['lon']:.4f}")
        return result

    except requests.RequestException as e:
        print(f"[Geocoder] Error geocoding '{location}': {e}")
        return None


def get_bounding_box(location: str) -> Optional[list]:
    """
    Get just the bounding box [south, north, west, east] for a location.

    Args:
        location: Human-readable location string.

    Returns:
        [south, north, west, east] list, or None if geocoding fails.
    """
    result = geocode_location(location)
    return result["bbox"] if result else None


def bbox_to_wkt(bbox: list) -> str:
    """
    Convert [south, north, west, east] bounding box to WKT POLYGON for PostGIS.

    Args:
        bbox: [south, north, west, east]

    Returns:
        WKT polygon string.
    """
    south, north, west, east = bbox
    return (
        f"POLYGON(({west} {south}, {east} {south}, "
        f"{east} {north}, {west} {north}, {west} {south}))"
    )


def expand_bbox(bbox: list, factor: float = 0.1) -> list:
    """
    Expand a bounding box by a proportional factor (useful for small AOIs).

    Args:
        bbox: [south, north, west, east]
        factor: Expansion factor (0.1 = 10% on each side)

    Returns:
        Expanded [south, north, west, east]
    """
    south, north, west, east = bbox
    lat_delta = (north - south) * factor
    lon_delta = (east - west) * factor
    return [
        south - lat_delta,
        north + lat_delta,
        west - lon_delta,
        east + lon_delta,
    ]


def get_nearby_places(location: str) -> list[dict]:
    """
    Find or generate recommended nearby places and zoom targets around a given location.

    For any location (e.g., 'New York City'), computes:
      - Center coordinates (lat, lon)
      - Micro local view bounding box (high resolution, e.g. zoom 15)
      - Macro regional view bounding box (wide area, e.g. zoom 8)
      - 4 to 6 nearby places / districts fetched via Nominatim or spatial offset
    """
    geo = geocode_location(location)
    if not geo:
        return []

    lat, lon = geo["lat"], geo["lon"]
    display_name = geo["display_name"]

    # Call Nominatim reverse or search for nearby features
    nearby_targets = []

    # 1. Add Macro Regional View
    nearby_targets.append({
        "name": f"Greater {location} Metro Area",
        "type": "MACRO_VIEW",
        "lat": lat,
        "lon": lon,
        "zoom": 8,
        "description": "Zoom out for regional spatial overview (100km scale)",
        "bbox": expand_bbox(geo["bbox"], factor=2.5)
    })

    # 2. Add High-Detail Micro View
    nearby_targets.append({
        "name": f"{location} Core Area",
        "type": "MICRO_VIEW",
        "lat": lat,
        "lon": lon,
        "zoom": 15,
        "description": "Zoom in for street-level high-resolution detail (10m scale)",
        "bbox": expand_bbox(geo["bbox"], factor=-0.2)
    })

    # 3. Fetch actual nearby places from Nominatim search around the lat,lon
    try:
        _rate_limit()
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": f"places near {location}",
                "format": "json",
                "limit": 6,
            },
            headers={"User-Agent": "GeoLensAI/1.0", "Accept-Language": "en"},
            timeout=8
        )
        if resp.ok:
            for item in resp.json()[:5]:
                name = item.get("display_name", "").split(",")[0]
                if name.lower() != location.lower():
                    nearby_targets.append({
                        "name": name,
                        "type": "NEARBY_DISTRICT",
                        "lat": float(item["lat"]),
                        "lon": float(item["lon"]),
                        "zoom": 12,
                        "description": item.get("display_name", ""),
                        "bbox": [float(b) for b in item.get("boundingbox", [lat-0.05, lat+0.05, lon-0.05, lon+0.05])]
                    })
    except Exception:
        pass

    # Fallback offset targets if Nominatim nearby yields few results
    if len(nearby_targets) < 4:
        offsets = [
            ("North Sector", 0.1, 0.0),
            ("South Sector", -0.1, 0.0),
            ("East Sector", 0.0, 0.1),
            ("West Sector", 0.0, -0.1),
        ]
        for label, dlat, dlon in offsets:
            nearby_targets.append({
                "name": f"{location} {label}",
                "type": "SECTOR",
                "lat": round(lat + dlat, 4),
                "lon": round(lon + dlon, 4),
                "zoom": 12,
                "description": f"Adjacent {label.lower()} area of interest",
                "bbox": [lat+dlat-0.05, lat+dlat+0.05, lon+dlon-0.05, lon+dlon+0.05]
            })

    return nearby_targets


# Pre-load cache on module import
_load_cache()

