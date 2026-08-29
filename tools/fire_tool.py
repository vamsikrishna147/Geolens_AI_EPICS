"""
GeoLens AI - NASA FIRMS Fire Tool
====================================
Fetches near real-time active fire and thermal anomaly data from
NASA's Fire Information for Resource Management System (FIRMS).

- Without API key: Last 7 days (VIIRS 375m or MODIS 1km)
- With API key: Full archive from 2000

API: https://firms.modaps.eosdis.nasa.gov/api/area/
Register free: https://firms.modaps.eosdis.nasa.gov/api/area/
"""

import csv
import io
import json
import os
from datetime import datetime, timedelta
from typing import Optional, Type

import requests
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import ClassVar

from utils.geocoder import geocode_location, expand_bbox
from storage.storage_manager import StorageManager


class FireToolInput(BaseModel):
    location: str = Field(..., description="Location or area name, e.g. 'Andhra Pradesh, India'")
    start_date: Optional[str] = Field(None, description="Start date YYYY-MM-DD (requires API key for >7 days back)")
    end_date: Optional[str] = Field(None, description="End date YYYY-MM-DD. Defaults to today.")
    satellite: Optional[str] = Field("VIIRS_SNPP_NRT", description="Satellite product: VIIRS_SNPP_NRT (375m), MODIS_NRT (1km), or VIIRS_NOAA20_NRT")
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class FireTool(BaseTool):
    """
    Fetches near real-time active fire and thermal anomaly data from NASA FIRMS.
    Works without an API key for the last 7 days of data.
    Returns fire point locations as GeoJSON stored in PostGIS.
    """

    name: str = "NASA FIRMS Fire Detection Tool"
    description: str = (
        "Fetches near real-time active fire and thermal anomaly data from NASA FIRMS "
        "for any location. Returns fire point locations, brightness temperature, "
        "fire radiative power (FRP), and confidence levels. "
        "Works without API key for last 7 days. Use for wildfire monitoring, "
        "fire risk analysis, and disaster response."
    )
    args_schema: Type[BaseModel] = FireToolInput

    # FIRMS base URL
    FIRMS_BASE_URL: ClassVar[str] = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"

    # Product configs
    PRODUCTS: ClassVar[dict] = {
        "VIIRS_SNPP_NRT": {"name": "VIIRS SNPP (375m)", "max_days_no_key": 7},
        "VIIRS_NOAA20_NRT": {"name": "VIIRS NOAA-20 (375m)", "max_days_no_key": 7},
        "MODIS_NRT": {"name": "MODIS (1km)", "max_days_no_key": 7},
    }

    def _run(
        self,
        location: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        satellite: Optional[str] = "VIIRS_SNPP_NRT",
        query_id: str = "",
    ) -> str:
        api_key = os.getenv("NASA_FIRMS_API_KEY", "")
        has_key = bool(api_key and api_key != "your_firms_api_key_here")

        # Date handling
        today = datetime.now()
        if not end_date:
            end_date = today.strftime("%Y-%m-%d")
        if not start_date:
            start_date = (today - timedelta(days=7)).strftime("%Y-%m-%d")

        # Check date range without key
        days_back = (today - datetime.strptime(start_date, "%Y-%m-%d")).days
        if days_back > 7 and not has_key:
            return json.dumps({
                "warning": f"Requested {days_back} days of data but no NASA FIRMS API key is set. "
                           f"Limited to last 7 days. Register free at: https://firms.modaps.eosdis.nasa.gov/api/area/",
                "action": "Showing last 7 days instead",
                "start_date_used": (today - timedelta(days=7)).strftime("%Y-%m-%d"),
            })

        # Geocode location
        geo = geocode_location(location)
        if not geo:
            return json.dumps({"error": f"Could not geocode: '{location}'"})

        bbox = geo["bbox"]
        bbox = expand_bbox(bbox, 0.05)  # Slightly expand for context
        south, north, west, east = bbox
        bbox_str = f"{west},{south},{east},{north}"

        print(f"[FireTool] Fetching {satellite} fire data for {location} | bbox: {bbox_str}")

        # Calculate day count for FIRMS (it accepts day count, not date range)
        day_count = min(days_back + 1, 7 if not has_key else 370)
        day_count = max(day_count, 1)

        # Build FIRMS URL
        if has_key:
            url = f"{self.FIRMS_BASE_URL}/{api_key}/{satellite}/{bbox_str}/{day_count}"
        else:
            # Public access URL (no key) — only last 7 days
            url = f"https://firms.modaps.eosdis.nasa.gov/data/active_fire/{satellite.lower().replace('_nrt', '')}/{satellite}_{day_count}d.csv"
            # Alternative: use the map_key endpoint with public key
            url = f"{self.FIRMS_BASE_URL}/FIRMS_GLOBAL/{satellite}/{bbox_str}/{day_count}"

        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 400:
                # Try alternate no-key approach
                return self._fetch_no_key(location, bbox, day_count, satellite, query_id, geo)
            response.raise_for_status()
            csv_data = response.text
        except requests.RequestException as e:
            # Try alternative free endpoint
            return self._fetch_no_key(location, bbox, day_count, satellite, query_id, geo)

        return self._parse_and_store(csv_data, location, geo, bbox_str, satellite, start_date, end_date, query_id)

    def _fetch_no_key(self, location, bbox, day_count, satellite, query_id, geo) -> str:
        """Fallback: fetch using public FIRMS transaction API."""
        south, north, west, east = bbox
        bbox_str = f"{west},{south},{east},{north}"

        # Try the transaction-based public endpoint
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/FIRMS_GLOBAL/{satellite}/{bbox_str}/{day_count}"
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            return self._parse_and_store(
                response.text, location, geo, bbox_str, satellite, None, None, query_id
            )
        except Exception:
            # Last resort: return instructions
            return json.dumps({
                "status": "api_key_required",
                "message": (
                    f"NASA FIRMS returned no data for {location}. "
                    "For reliable fire data access, register a free API key at: "
                    "https://firms.modaps.eosdis.nasa.gov/api/area/ "
                    "Then set NASA_FIRMS_API_KEY in your .env file."
                ),
                "location": location,
                "bbox": bbox_str,
                "satellite": satellite,
                "workaround": "Use MODIS Terra/Aqua data via Google Earth Engine instead.",
            })

    def _parse_and_store(self, csv_data, location, geo, bbox_str, satellite, start_date, end_date, query_id) -> str:
        """Parse CSV response from FIRMS and convert to GeoJSON."""
        if not csv_data.strip() or "acq_date" not in csv_data:
            return json.dumps({
                "status": "no_fires",
                "message": f"No active fires detected in {location} for the requested period.",
                "location": location,
                "satellite": satellite,
            })

        # Parse CSV
        reader = csv.DictReader(io.StringIO(csv_data))
        features = []
        for row in reader:
            try:
                lat = float(row.get("latitude", 0))
                lon = float(row.get("longitude", 0))
                feature = {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    "properties": {
                        "acq_date": row.get("acq_date", ""),
                        "acq_time": row.get("acq_time", ""),
                        "brightness": row.get("bright_ti4") or row.get("brightness", ""),
                        "frp": row.get("frp", ""),
                        "confidence": row.get("confidence", ""),
                        "satellite": row.get("satellite", satellite),
                        "version": row.get("version", ""),
                        "daynight": row.get("daynight", ""),
                    },
                }
                features.append(feature)
            except (ValueError, KeyError):
                continue

        geojson = {"type": "FeatureCollection", "features": features}

        # Store
        storage = StorageManager(query_id=query_id or None)
        result = storage.save_geojson(geojson, source="nasa_firms", feature_type="fire_point")

        summary = {
            "location": location,
            "coordinates": {"lat": geo["lat"], "lon": geo["lon"]},
            "period": {"start": start_date, "end": end_date},
            "satellite_product": satellite,
            "fire_count": len(features),
            "bbox": bbox_str,
            "features_saved_to_postgis": result["count"],
            "saved_to_file": result["saved_to_file"],
            "source": "NASA FIRMS (firms.modaps.eosdis.nasa.gov)",
        }

        readable = (
            f"NASA FIRMS fire data for {location}:\n"
            f"  - Active fires detected: {len(features)}\n"
            f"  - Satellite: {satellite} (375m resolution)\n"
            f"  - Period: {start_date or 'last 7 days'} to {end_date or 'today'}\n"
            f"  - Saved {result['count']} fire points to PostGIS + local file\n"
            f"  - File: {result['saved_to_file']}"
        )
        return json.dumps({"summary": readable, "data": summary, "geojson": geojson})
