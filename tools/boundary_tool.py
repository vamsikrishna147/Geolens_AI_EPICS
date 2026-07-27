"""
GeoLens AI - Administrative Boundary Tool (GADM + Natural Earth)
=================================================================
Downloads administrative boundaries (country, state, district level)
using GADM (Global Administrative Areas) and Natural Earth datasets.
No API key required. Results cached locally and stored in PostGIS.

GADM: https://gadm.org
Natural Earth: https://www.naturalearthdata.com
"""

import json
import os
import time
from typing import Optional, Type

import requests
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import ClassVar

from utils.geocoder import geocode_location
from storage.storage_manager import StorageManager


class BoundaryToolInput(BaseModel):
    location: str = Field(..., description="Country or region name, e.g. 'India', 'Andhra Pradesh, India'")
    admin_level: Optional[int] = Field(
        2,
        description="Administrative level: 0=country, 1=state/province, 2=district/county, 3=sub-district"
    )
    country_code: Optional[str] = Field("", description="ISO3 country code (e.g. IND, BRA, USA). Auto-detected from location if not provided.")
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


# ISO3 codes for common countries in GeoLens use cases
COUNTRY_ISO3 = {
    "india": "IND", "brazil": "BRA", "usa": "USA", "united states": "USA",
    "indonesia": "IDN", "australia": "AUS", "kenya": "KEN", "nigeria": "NGA",
    "pakistan": "PAK", "bangladesh": "BGD", "china": "CHN", "myanmar": "MMR",
    "philippines": "PHL", "vietnam": "VNM", "thailand": "THA",
}


class BoundaryTool(BaseTool):
    """
    Downloads and stores administrative boundary GeoJSON for any country
    using GADM and Natural Earth datasets. Caches locally, stores in PostGIS.
    """

    name: str = "Administrative Boundary Tool"
    description: str = (
        "Downloads administrative boundary polygons (country, state, district level) "
        "from GADM and Natural Earth. No API key required. Provides exact geographic "
        "boundaries for any country or region, stored in PostGIS for spatial analysis. "
        "Essential for clipping satellite imagery and defining Areas of Interest (AOI). "
        "Provide a location name and admin level (0=country, 1=state, 2=district)."
    )
    args_schema: Type[BaseModel] = BoundaryToolInput

    # GADM GeoJSON download URLs
    GADM_URL: ClassVar[str] = "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_{iso3}_{level}.json"
    # Alternative GADM URL
    GADM_ALT_URL: ClassVar[str] = "https://biogeo.ucdavis.edu/data/gadm4.1/json/gadm41_{iso3}_{level}.json"

    def _run(
        self,
        location: str,
        admin_level: Optional[int] = 2,
        country_code: Optional[str] = "",
        query_id: str = "",
    ) -> str:
        storage = StorageManager(query_id=query_id or None)

        # Resolve ISO3 country code
        iso3 = country_code.upper() if country_code else self._resolve_iso3(location)
        if not iso3:
            # Geocode to get country code
            geo = geocode_location(location)
            if geo:
                country = geo.get("country", "")
                # Convert ISO2 → ISO3
                iso3 = self._iso2_to_iso3(country)
        if not iso3:
            return json.dumps({"error": f"Could not determine country code for '{location}'. Please provide country_code (ISO3)."})

        level = max(0, min(admin_level or 2, 3))
        print(f"[BoundaryTool] Downloading GADM level-{level} boundaries for {iso3}")

        # Check local cache
        cache_dir = os.path.join(storage.data_root, "boundaries")
        cache_file = os.path.join(cache_dir, f"gadm41_{iso3}_{level}.geojson")

        if os.path.exists(cache_file):
            print(f"[BoundaryTool] Loading from cache: {cache_file}")
            with open(cache_file, "r", encoding="utf-8") as f:
                geojson = json.load(f)
            count = len(geojson.get("features", []))
            storage.db.index_file(query_id or "", "gadm", "geojson", cache_file, {"iso3": iso3, "level": level})
            return json.dumps({
                "summary": f"Boundaries for {iso3} (level-{level}): {count} features loaded from cache\nFile: {cache_file}",
                "count": count,
                "file": cache_file,
                "source": "GADM (gadm.org)",
                "cached": True,
            })

        # Download from GADM
        url = self.GADM_URL.format(iso3=iso3, level=level)
        try:
            time.sleep(0.5)
            response = requests.get(url, timeout=60, headers={"User-Agent": "GeoLensAI/1.0"})
            response.raise_for_status()
            geojson = response.json()
        except requests.RequestException as e:
            # Try alternate URL
            try:
                alt_url = self.GADM_ALT_URL.format(iso3=iso3, level=level)
                response = requests.get(alt_url, timeout=60)
                response.raise_for_status()
                geojson = response.json()
            except Exception:
                return json.dumps({
                    "error": f"Could not download GADM boundaries for {iso3} level {level}: {str(e)}",
                    "suggestion": f"Download manually from https://gadm.org/download_country.html and place in {cache_file}",
                })

        count = len(geojson.get("features", []))

        # Save to cache file
        os.makedirs(cache_dir, exist_ok=True)
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(geojson, f)

        # Save to PostGIS
        storage.save_geojson(geojson, source="gadm", feature_type=f"boundary_level_{level}")

        return json.dumps({
            "summary": (
                f"Administrative boundaries downloaded for {iso3} (level-{level}):\n"
                f"  - Features: {count} boundary polygons\n"
                f"  - Saved to PostGIS + cached at: {cache_file}\n"
                f"  - Source: GADM 4.1 (gadm.org, free, no API key)"
            ),
            "count": count,
            "file": cache_file,
            "iso3": iso3,
            "admin_level": level,
            "source": "GADM 4.1",
        })

    def _resolve_iso3(self, location: str) -> str:
        """Try to extract ISO3 code from location string."""
        location_lower = location.lower()
        for key, iso3 in COUNTRY_ISO3.items():
            if key in location_lower:
                return iso3
        return ""

    def _iso2_to_iso3(self, iso2: str) -> str:
        """Convert ISO2 country code to ISO3."""
        mapping = {
            "IN": "IND", "BR": "BRA", "US": "USA", "ID": "IDN",
            "AU": "AUS", "KE": "KEN", "NG": "NGA", "PK": "PAK",
            "BD": "BGD", "CN": "CHN", "MM": "MMR", "PH": "PHL",
            "VN": "VNM", "TH": "THA", "GB": "GBR", "DE": "DEU",
        }
        return mapping.get(iso2.upper(), "")
