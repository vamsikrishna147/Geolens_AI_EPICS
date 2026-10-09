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
import logging
from functools import lru_cache
from typing import Optional

import requests

try:
    from storage.redis_client import get_redis_client
    _redis = get_redis_client()
except Exception:
    _redis = None

logger = logging.getLogger("geolens.geocoder")

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


def geocode_location(location: str, lang: str = "en") -> Optional[dict]:
    """
    Geocode a location name to coordinates and bounding box.

    Args:
        location: Human-readable location string.
                  e.g. "Konaseema district, Andhra Pradesh, India"
                       "Amazon rainforest, Brazil"
                       "Hyderabad, India"
        lang: Language code for result names (e.g. 'en', 'hi', 'te', 'ta', 'bn'). Default 'en'.

    Returns:
        Dictionary with keys:
          - display_name: Full formatted name from Nominatim in requested language
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

    lang_code = (lang or "en").lower().strip()
    # Check cache
    cache_key = f"{location.lower().strip()}:{lang_code}"
    legacy_key = f"{location.lower().strip()}" if lang_code == "en" else None
    if cache_key in _geocode_cache:
        val = _geocode_cache[cache_key]
        if _redis and _redis.is_connected:
            if not _redis.exists(f"geolens:geocode:{cache_key}"):
                _redis.set(f"geolens:geocode:{cache_key}", val, ttl=604800)
            if legacy_key and not _redis.exists(f"geolens:geocode:{legacy_key}"):
                _redis.set(f"geolens:geocode:{legacy_key}", val, ttl=604800)
        return val

    # Check Redis cache
    if _redis and _redis.is_connected:
        cached_val = _redis.get(f"geolens:geocode:{cache_key}")
        if not cached_val and legacy_key:
            cached_val = _redis.get(f"geolens:geocode:{legacy_key}")
        if cached_val:
            _geocode_cache[cache_key] = cached_val
            return cached_val

    # 1. Try Photon first (instantaneous, multi-language support, no strict rate limit)
    photon_lang = lang_code if lang_code in ["de", "fr", "it"] else "en"
    try:
        p_resp = requests.get(
            "https://photon.komoot.io/api/",
            params={"q": location, "limit": 1, "lang": photon_lang},
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) GeoLensAI/2.0"},
            timeout=3.0,
        )
        if p_resp.status_code == 200:
            p_data = p_resp.json()
            features = p_data.get("features", [])
            if features:
                feat = features[0]
                props = feat.get("properties", {})
                coords = feat.get("geometry", {}).get("coordinates", [0, 0])
                lon, lat = float(coords[0]), float(coords[1])
                name = props.get("name", "")
                city = props.get("city", "")
                state = props.get("state", "")
                country = props.get("country", "")
                country_code = props.get("countrycode", "").upper()
                
                parts = [p for p in [name or city, state, country] if p]
                display_name = ", ".join(parts) if parts else (name or location)
                
                extent = props.get("extent") # [minLon, maxLat, maxLon, minLat]
                if extent and len(extent) == 4:
                    min_lon, max_lat, max_lon, min_lat = float(extent[0]), float(extent[1]), float(extent[2]), float(extent[3])
                    south, north = min(min_lat, max_lat), max(min_lat, max_lat)
                    west, east = min(min_lon, max_lon), max(min_lon, max_lon)
                else:
                    south, north = lat - 0.1, lat + 0.1
                    west, east = lon - 0.1, lon + 0.1

                result = {
                    "display_name": display_name,
                    "lat": lat,
                    "lon": lon,
                    "bbox": [south, north, west, east],
                    "bbox_str": f"{west},{south},{east},{north}",
                    "bbox_ee": [west, south, east, north],
                    "country": country_code,
                    "type": props.get("type", "place"),
                    "osm_type": props.get("osm_type", "unknown"),
                }
                _geocode_cache[cache_key] = result
                _save_cache()
                if _redis and _redis.is_connected:
                    _redis.set(f"geolens:geocode:{cache_key}", result, ttl=604800)
                    if legacy_key:
                        _redis.set(f"geolens:geocode:{legacy_key}", result, ttl=604800)
                logger.info("Geocoded '%s' (Photon) -> lat=%.4f, lon=%.4f", location, lat, lon)
                return result
    except Exception as p_err:
        logger.debug("Photon lookup failed, falling back to Nominatim: %s", p_err)

    # 2. Call Nominatim API as fallback
    _rate_limit()
    try:
        accept_lang_val = f"{lang_code},en;q=0.8" if lang_code != "en" else "en"
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": location,
                "format": "json",
                "addressdetails": 1,
                "limit": 1,
                "accept-language": accept_lang_val,
            },
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) GeoLensAI/2.0",
                "Accept-Language": accept_lang_val,
            },
            timeout=10,
        )
        response.raise_for_status()
        results = response.json()

        if not results:
            logger.info("No geocoding results found for: '%s'", location)
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

        # Save to memory and disk cache
        _geocode_cache[cache_key] = result
        _save_cache()

        # Save to Redis cache (7 days TTL)
        if _redis and _redis.is_connected:
            _redis.set(f"geolens:geocode:{cache_key}", result, ttl=604800)
            if legacy_key:
                _redis.set(f"geolens:geocode:{legacy_key}", result, ttl=604800)

        logger.info("Geocoded '%s' -> lat=%.4f, lon=%.4f", location, result['lat'], result['lon'])
        return result

    except requests.RequestException as e:
        logger.warning("Error geocoding '%s': %s", location, e)
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


def get_nearby_places(location: str, lang: str = "en") -> list[dict]:
    """
    Find or generate recommended nearby places and zoom targets around a given location.

    For any location (e.g., 'New York City'), computes:
      - Center coordinates (lat, lon)
      - Micro local view bounding box (high resolution, e.g. zoom 15)
      - Macro regional view bounding box (wide area, e.g. zoom 8)
      - 4 to 6 nearby places / districts fetched via Nominatim or spatial offset
    """
    geo = geocode_location(location, lang=lang)
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
    # We use a viewbox around the target to find nearby cities/towns
    try:
        _rate_limit()
        # Create a bounding box roughly +/- 1.0 degrees (~111km) around the target
        south, north = lat - 1.0, lat + 1.0
        west, east = lon - 1.0, lon + 1.0
        
        lang_code = (lang or "en").lower().strip()
        accept_lang_val = f"{lang_code},en;q=0.8" if lang_code != "en" else "en"
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": "city",
                "viewbox": f"{west},{north},{east},{south}",
                "bounded": 1,
                "format": "json",
                "limit": 8,
                "accept-language": accept_lang_val,
            },
            headers={"User-Agent": "GeoLensAI/2.0", "Accept-Language": accept_lang_val},
            timeout=8
        )
        if resp.ok:
            for item in resp.json():
                name = item.get("name", "") or item.get("display_name", "").split(",")[0]
                # Avoid adding the EXACT same place if it matches the current location
                if name.lower() not in location.lower() and location.lower() not in name.lower():
                    nearby_targets.append({
                        "name": name,
                        "type": item.get("type", "CITY").upper(),
                        "lat": float(item["lat"]),
                        "lon": float(item["lon"]),
                        "zoom": 11,
                        "description": item.get("display_name", ""),
                        "bbox": [float(b) for b in item.get("boundingbox", [lat-0.05, lat+0.05, lon-0.05, lon+0.05])]
                    })
                    if len(nearby_targets) >= 6:  # limit to 4 actual nearby places (+2 views = 6 total)
                        break
    except Exception as e:
        logger.warning("Failed to fetch nearby places: %s", e)

    # Fallback offset targets ONLY if we found absolutely nothing from the real API
    if len(nearby_targets) < 3:
        offsets = [
            ("North Sector", 0.05, 0.0),
            ("South Sector", -0.05, 0.0),
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


def get_location_suggestions(query: str, limit: int = 6, lang: str = "en") -> list[dict]:
    """
    Fast keystroke-by-keystroke location autocomplete suggestions using Photon & Nominatim.
    Returns results in user-defined language (default: 'en'), avoiding untranslated native scripts.
    Accelerated with Redis cache for sub-millisecond response on repeat keystrokes.
    """
    if not query or len(query.strip()) < 2:
        return []
    
    q = query.strip()
    lang_code = (lang or "en").lower().strip()
    cache_key = f"geolens:suggest:{q.lower()}:{limit}:{lang_code}"
    legacy_key = f"geolens:suggest:{q.lower()}:{limit}" if lang_code == "en" else None
    if _redis and _redis.is_connected:
        cached_res = _redis.get(cache_key)
        if cached_res is None and legacy_key:
            cached_res = _redis.get(legacy_key)
        if cached_res is not None:
            if legacy_key and not _redis.exists(legacy_key):
                _redis.set(legacy_key, cached_res, ttl=86400)
            return cached_res

    seen = set()
    suggestions = []

    # Photon supports 'en', 'de', 'fr', 'it'. If lang_code is not one of these, default to 'en'
    photon_lang = lang_code if lang_code in ["de", "fr", "it"] else "en"

    # 1. Try Photon (ultra-low latency OSM geocoder)
    try:
        resp = requests.get(
            "https://photon.komoot.io/api/",
            params={"q": q, "limit": limit, "lang": photon_lang},
            headers={"User-Agent": "GeoLensAI/2.0"},
            timeout=2.5
        )
        if resp.status_code == 200:
            data = resp.json()
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                coords = feature.get("geometry", {}).get("coordinates", [0, 0])
                name = props.get("name", "")
                city = props.get("city", "")
                state = props.get("state", "")
                country = props.get("country", "")
                
                parts = [p for p in [name or city, state, country] if p]
                display_name = ", ".join(parts) if parts else name
                place_type = props.get("osm_value") or props.get("type") or ""
                extent = props.get("extent") # [minLon, maxLat, maxLon, minLat]
                
                if display_name and display_name not in seen:
                    seen.add(display_name)
                    suggestions.append({
                        "display_name": display_name,
                        "short_name": name or city or display_name.split(",")[0],
                        "state": state,
                        "country": country,
                        "type": place_type,
                        "bbox": extent,
                        "lat": float(coords[1]),
                        "lon": float(coords[0])
                    })
            if suggestions:
                if _redis and _redis.is_connected:
                    _redis.set(cache_key, suggestions[:limit], ttl=86400)
                    if legacy_key:
                        _redis.set(legacy_key, suggestions[:limit], ttl=86400)
                return suggestions[:limit]
    except Exception:
        pass

    # 2. Fallback to Nominatim search with Accept-Language header
    try:
        _rate_limit()
        accept_lang_val = f"{lang_code},en;q=0.8" if lang_code != "en" else "en"
        resp = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": q,
                "format": "json",
                "addressdetails": 1,
                "limit": limit,
                "accept-language": accept_lang_val
            },
            headers={"User-Agent": "GeoLensAI/2.0", "Accept-Language": accept_lang_val},
            timeout=3.0
        )
        if resp.status_code == 200:
            for item in resp.json():
                disp = item.get("display_name", "")
                place_type = item.get("type") or item.get("class") or ""
                bbox = item.get("boundingbox") # [minLat, maxLat, minLon, maxLon]
                if disp not in seen:
                    seen.add(disp)
                    suggestions.append({
                        "display_name": disp,
                        "short_name": item.get("name", "") or disp.split(",")[0],
                        "state": item.get("address", {}).get("state", ""),
                        "country": item.get("address", {}).get("country", ""),
                        "type": place_type,
                        "bbox": bbox,
                        "lat": float(item.get("lat", 0)),
                        "lon": float(item.get("lon", 0))
                    })
            if suggestions and _redis and _redis.is_connected:
                _redis.set(cache_key, suggestions[:limit], ttl=86400)
                if legacy_key:
                    _redis.set(legacy_key, suggestions[:limit], ttl=86400)
            return suggestions[:limit]
    except Exception:
        pass

    return []


def clear_geocode_cache() -> dict:
    """Clear memory, file, and Redis geocode and suggestion caches."""
    global _geocode_cache
    _geocode_cache.clear()
    if os.path.exists(_CACHE_FILE):
        try:
            with open(_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump({}, f)
        except Exception:
            pass
    redis_keys_cleared = 0
    if _redis and _redis.is_connected:
        redis_keys_cleared += _redis.flush_prefix("geolens:geocode:")
        redis_keys_cleared += _redis.flush_prefix("geolens:suggest:")
    return {
        "status": "cleared",
        "redis_keys_cleared": redis_keys_cleared,
        "file_cleared": True,
    }


# Pre-load cache on module import
_load_cache()

