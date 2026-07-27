"""
GeoLens AI - SoilGrids Soil Data Tool
=======================================
Fetches soil property data from the ISRIC SoilGrids REST API.
No API key required. Data at 250m global resolution.

SoilGrids: https://soilgrids.org
API: https://rest.isric.org/soilgrids/v2.0/docs
"""

import json
from typing import Optional, Type

import requests
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import ClassVar

from utils.geocoder import geocode_location
from storage.storage_manager import StorageManager


class SoilToolInput(BaseModel):
    location: str = Field(..., description="Location name, e.g. 'Konaseema district, India'")
    properties: Optional[str] = Field(
        "phh2o,oc,clay,sand,silt,bdod,nitrogen",
        description=(
            "Comma-separated soil properties to fetch. Options: "
            "phh2o (pH), oc (organic carbon), clay, sand, silt, "
            "bdod (bulk density), nitrogen, wrb (soil classification)"
        )
    )
    depths: Optional[str] = Field(
        "0-5cm,5-15cm,15-30cm",
        description="Soil depth intervals: 0-5cm, 5-15cm, 15-30cm, 30-60cm, 60-100cm, 100-200cm"
    )
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class SoilTool(BaseTool):
    """
    Fetches soil property data from the ISRIC SoilGrids API.
    No API key required. Returns pH, organic carbon, clay/sand/silt content,
    bulk density, and nitrogen at multiple depth layers.
    """

    name: str = "SoilGrids Soil Property Tool"
    description: str = (
        "Fetches global soil property data from ISRIC SoilGrids API (free, no key needed). "
        "Provides soil pH, organic carbon, clay/sand/silt content, bulk density, and "
        "nitrogen at 250m resolution for any location. Essential for agriculture analysis, "
        "land degradation assessment, carbon sequestration studies, and flood risk modeling "
        "(soil infiltration capacity)."
    )
    args_schema: Type[BaseModel] = SoilToolInput

    SOILGRIDS_URL: ClassVar[str] = "https://rest.isric.org/soilgrids/v2.0/properties/query"

    def _run(
        self,
        location: str,
        properties: Optional[str] = None,
        depths: Optional[str] = None,
        query_id: str = "",
    ) -> str:
        if not properties:
            properties = "phh2o,oc,clay,sand,silt,bdod"
        if not depths:
            depths = "0-5cm,5-15cm,15-30cm"

        # Geocode
        geo = geocode_location(location)
        if not geo:
            return json.dumps({"error": f"Could not geocode: '{location}'"})

        lat, lon = geo["lat"], geo["lon"]
        print(f"[SoilTool] Fetching SoilGrids data for {location} ({lat:.4f},{lon:.4f})")

        prop_list = [p.strip() for p in properties.split(",")]
        depth_list = [d.strip() for d in depths.split(",")]

        try:
            response = requests.get(
                self.SOILGRIDS_URL,
                params={
                    "lon": lon,
                    "lat": lat,
                    "property": prop_list,
                    "depth": depth_list,
                    "value": "mean,uncertainty",
                },
                timeout=30,
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            return json.dumps({"error": f"SoilGrids API error: {str(e)}"})

        # Parse layers
        layers = data.get("properties", {}).get("layers", [])
        soil_summary = {}

        for layer in layers:
            prop_name = layer.get("name", "unknown")
            unit = layer.get("unit_measure", {}).get("mapped_units", "")
            conversion = layer.get("unit_measure", {}).get("d_factor", 1)
            depths_data = layer.get("depths", [])

            soil_summary[prop_name] = {
                "unit": unit,
                "depths": {}
            }
            for depth_entry in depths_data:
                depth_label = depth_entry.get("label", "")
                values = depth_entry.get("values", {})
                mean_val = values.get("mean")
                if mean_val is not None and conversion:
                    mean_val = round(mean_val / conversion, 3)
                soil_summary[prop_name]["depths"][depth_label] = mean_val

        result = {
            "location": location,
            "coordinates": {"lat": lat, "lon": lon},
            "soil_properties": soil_summary,
            "source": "SoilGrids v2.0 (ISRIC - soilgrids.org)",
            "resolution": "250m",
            "api_key_required": False,
        }

        # Store
        storage = StorageManager(query_id=query_id or None)
        storage.save_metadata(result, result_type="soil_report")

        # Build readable summary
        prop_labels = {
            "phh2o": "Soil pH (in water)",
            "oc": "Organic Carbon (g/kg)",
            "clay": "Clay content (%)",
            "sand": "Sand content (%)",
            "silt": "Silt content (%)",
            "bdod": "Bulk Density (cg/cm³)",
            "nitrogen": "Total Nitrogen (cg/kg)",
        }

        lines = [f"Soil properties for {location} (250m resolution):"]
        for prop, pdata in soil_summary.items():
            label = prop_labels.get(prop, prop)
            depth_vals = ", ".join(
                f"{d}: {v}" for d, v in pdata["depths"].items() if v is not None
            )
            lines.append(f"  - {label}: {depth_vals} {pdata['unit']}")
        lines.append(f"  Source: SoilGrids v2.0 (ISRIC, free, no key)")

        return json.dumps({"summary": "\n".join(lines), "data": result})


class PopulationToolInput(BaseModel):
    country: str = Field(..., description="Country name or ISO3 code, e.g. 'India' or 'IND'")
    year: Optional[int] = Field(2020, description="Population data year (2000-2020 available).")
    resolution: Optional[str] = Field("1km", description="Spatial resolution: '100m' or '1km'")
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class PopulationTool(BaseTool):
    """
    Fetches population density data from WorldPop API.
    No API key required. Downloads raster GeoTIFF or returns metadata.
    """

    name: str = "WorldPop Population Data Tool"
    description: str = (
        "Fetches population density data from WorldPop (free, no API key). "
        "Provides population counts and density estimates at 100m or 1km resolution "
        "for any country. Essential for disaster impact assessment, urban analysis, "
        "and resource allocation planning. Returns download URLs for GeoTIFF rasters "
        "and summary statistics."
    )
    args_schema: Type[BaseModel] = PopulationToolInput

    WORLDPOP_URL: ClassVar[str] = "https://www.worldpop.org/rest/data/pop/wpgp"

    # Country ISO3 code lookup
    COUNTRY_ISO3: ClassVar[dict] = {
        "india": "IND", "brazil": "BRA", "usa": "USA", "indonesia": "IDN",
        "nigeria": "NGA", "kenya": "KEN", "bangladesh": "BGD", "pakistan": "PAK",
        "philippines": "PHL", "vietnam": "VNM", "myanmar": "MMR",
    }

    def _run(self, country: str, year: Optional[int] = 2020, resolution: Optional[str] = "1km", query_id: str = "") -> str:
        # Resolve ISO3
        iso3 = country.upper() if len(country) == 3 else self.COUNTRY_ISO3.get(country.lower(), country.upper()[:3])
        year = year or 2020

        print(f"[PopulationTool] Fetching WorldPop data for {iso3} ({year})")

        try:
            response = requests.get(
                self.WORLDPOP_URL,
                params={"iso3": iso3},
                timeout=20,
                headers={"User-Agent": "GeoLensAI/1.0"},
            )
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            return json.dumps({"error": f"WorldPop API error: {str(e)}"})

        datasets = data.get("data", [])
        # Filter by year
        matching = [d for d in datasets if str(d.get("popyear", "")) == str(year)]
        if not matching:
            matching = datasets[:3]

        def extract_url_and_size(ds):
            """Extract download URL and file size regardless of API format."""
            files = ds.get("files", [])
            if not files:
                return "", 0
            first = files[0]
            if isinstance(first, str):
                return first, 0
            elif isinstance(first, dict):
                return first.get("file", first.get("url", "")), first.get("file_size", 0)
            return "", 0

        result = {
            "country": country,
            "iso3": iso3,
            "year": year,
            "resolution": resolution,
            "available_datasets": [
                {
                    "title": d.get("title", ""),
                    "year": d.get("popyear", ""),
                    "download_url": extract_url_and_size(d)[0],
                    "file_size_mb": round(extract_url_and_size(d)[1] / 1e6, 1) if extract_url_and_size(d)[1] else 0,
                }
                for d in matching[:3]
            ],
            "source": "WorldPop (worldpop.org)",
            "api_key_required": False,
        }

        storage = StorageManager(query_id=query_id or None)
        storage.save_metadata(result, result_type="population_report")

        lines = [f"WorldPop population data for {country} ({year}):"]
        for ds in result["available_datasets"]:
            lines.append(f"  - {ds['title']}")
            if ds["download_url"]:
                lines.append(f"    Download: {ds['download_url']} ({ds['file_size_mb']} MB)")
        lines.append("  Source: WorldPop (free, no API key)")

        return json.dumps({"summary": "\n".join(lines), "data": result})
