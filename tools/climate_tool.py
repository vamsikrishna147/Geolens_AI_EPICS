"""
GeoLens AI - Climate Data Tool (NASA POWER)
============================================
Fetches historical solar radiation, temperature, wind, and precipitation
data from NASA POWER API. No API key required.

NASA POWER: https://power.larc.nasa.gov/api
Parameters: https://power.larc.nasa.gov/docs/methodology/
"""

import json
from datetime import datetime, timedelta
from typing import Optional, Type

import requests
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import ClassVar

from utils.geocoder import geocode_location
from storage.storage_manager import StorageManager


class ClimateToolInput(BaseModel):
    location: str = Field(..., description="Location name, e.g. 'Hyderabad, India'")
    start_date: Optional[str] = Field(None, description="Start date YYYY-MM-DD. Default: 30 days ago.")
    end_date: Optional[str] = Field(None, description="End date YYYY-MM-DD. Default: yesterday.")
    parameters: Optional[str] = Field(
        "T2M,PRECTOTCORR,RH2M,WS10M,ALLSKY_SFC_SW_DWN",
        description=(
            "NASA POWER parameters (comma-separated). Key params: "
            "T2M (temp 2m), PRECTOTCORR (precipitation), RH2M (humidity), "
            "WS10M (wind speed), ALLSKY_SFC_SW_DWN (solar radiation), "
            "T2M_MAX, T2M_MIN, EVPTRNS (evapotranspiration)"
        )
    )
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class ClimateTool(BaseTool):
    """
    Fetches historical climate data from NASA POWER API.
    Provides temperature, precipitation, humidity, wind, and solar radiation.
    No API key required. Data available from 1981 to present.
    """

    name: str = "NASA POWER Climate Data Tool"
    description: str = (
        "Fetches historical climate and meteorological data from NASA POWER (free, no API key). "
        "Provides temperature, precipitation, humidity, wind speed, and solar radiation "
        "for any location from 1981 to present. Ideal for long-term climate analysis, "
        "drought assessment, agricultural planning, and historical baseline comparisons. "
        "Complements Open-Meteo for deeper historical records."
    )
    args_schema: Type[BaseModel] = ClimateToolInput

    NASA_POWER_URL: ClassVar[str] = "https://power.larc.nasa.gov/api/temporal/daily/point"

    def _run(
        self,
        location: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        parameters: Optional[str] = None,
        query_id: str = "",
    ) -> str:
        today = datetime.now()
        if not end_date:
            end_date = (today - timedelta(days=1)).strftime("%Y-%m-%d")
        if not start_date:
            start_date = (today - timedelta(days=30)).strftime("%Y-%m-%d")
        if not parameters:
            parameters = "T2M,PRECTOTCORR,RH2M,WS10M,ALLSKY_SFC_SW_DWN"

        # Geocode
        geo = geocode_location(location)
        if not geo:
            return json.dumps({"error": f"Could not geocode: '{location}'"})

        lat, lon = geo["lat"], geo["lon"]
        print(f"[ClimateTool] Fetching NASA POWER data for {location} ({lat:.4f},{lon:.4f})")

        # Format dates for NASA POWER (YYYYMMDD)
        start_fmt = start_date.replace("-", "")
        end_fmt = end_date.replace("-", "")

        try:
            response = requests.get(
                self.NASA_POWER_URL,
                params={
                    "parameters": parameters,
                    "community": "RE",
                    "longitude": lon,
                    "latitude": lat,
                    "start": start_fmt,
                    "end": end_fmt,
                    "format": "JSON",
                    "user": "GeoLensAI",
                },
                timeout=30,
            )
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            return json.dumps({"error": f"NASA POWER API error: {str(e)}"})

        # Extract daily data
        properties = data.get("properties", {})
        parameter_data = properties.get("parameter", {})

        # Build summary stats for each parameter
        param_summaries = {}
        param_labels = {
            "T2M": "Avg Temperature (°C)",
            "T2M_MAX": "Max Temperature (°C)",
            "T2M_MIN": "Min Temperature (°C)",
            "PRECTOTCORR": "Precipitation (mm/day)",
            "RH2M": "Relative Humidity (%)",
            "WS10M": "Wind Speed (m/s)",
            "ALLSKY_SFC_SW_DWN": "Solar Radiation (kWh/m²/day)",
            "EVPTRNS": "Evapotranspiration (mm/day)",
        }

        for param, values_dict in parameter_data.items():
            values = [v for v in values_dict.values() if v is not None and v != -999.0]
            if values:
                param_summaries[param] = {
                    "label": param_labels.get(param, param),
                    "mean": round(sum(values) / len(values), 3),
                    "max": round(max(values), 3),
                    "min": round(min(values), 3),
                    "total": round(sum(values), 3) if param in ("PRECTOTCORR", "ALLSKY_SFC_SW_DWN") else None,
                    "days": len(values),
                }

        result = {
            "location": location,
            "coordinates": {"lat": lat, "lon": lon},
            "period": {"start": start_date, "end": end_date},
            "parameter_summaries": param_summaries,
            "raw_data": parameter_data,
            "source": "NASA POWER (power.larc.nasa.gov)",
            "api_key_required": False,
        }

        # Store
        storage = StorageManager(query_id=query_id or None)
        storage.save_metadata(result, result_type="climate_summary")

        # Build readable summary
        lines = [f"NASA POWER climate data for {location} ({start_date} to {end_date}):"]
        for param, stats in param_summaries.items():
            label = stats["label"]
            if stats.get("total") is not None:
                lines.append(f"  - {label}: Total={stats['total']}, Daily avg={stats['mean']}")
            else:
                lines.append(f"  - {label}: Avg={stats['mean']}, Max={stats['max']}, Min={stats['min']}")
        lines.append(f"  - Source: NASA POWER (free, no API key)")
        lines.append(f"  - Saved to: {storage.data_root}/weather/")

        return json.dumps({"summary": "\n".join(lines), "data": result})
