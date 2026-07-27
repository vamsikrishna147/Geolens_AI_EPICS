"""
GeoLens AI - Weather Tool (Open-Meteo)
========================================
Fetches current, forecast, and historical weather data using the
Open-Meteo API. No API key required. Free for non-commercial use.

API Docs: https://open-meteo.com/en/docs
Historical: https://open-meteo.com/en/docs/historical-weather-api
"""

import json
import os
from datetime import datetime, timedelta
from typing import Optional, Type

import requests
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from utils.geocoder import geocode_location
from storage.storage_manager import StorageManager


class WeatherToolInput(BaseModel):
    location: str = Field(..., description="Location name, e.g. 'Konaseema district, Andhra Pradesh, India'")
    start_date: Optional[str] = Field(None, description="Start date in YYYY-MM-DD format. Defaults to 7 days ago.")
    end_date: Optional[str] = Field(None, description="End date in YYYY-MM-DD format. Defaults to today.")
    variables: Optional[str] = Field(
        "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,et0_fao_evapotranspiration",
        description="Comma-separated weather variables. Common: temperature_2m_max, precipitation_sum, windspeed_10m_max, relative_humidity_2m_max"
    )
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class WeatherTool(BaseTool):
    """
    Fetches historical and current weather data from Open-Meteo API.
    No API key required. Returns temperature, precipitation, wind, humidity
    filtered by location and date range.
    """

    name: str = "Weather Data Tool"
    description: str = (
        "Fetches historical and current weather data for any location using the free "
        "Open-Meteo API (no key needed). Provides temperature, precipitation, wind speed, "
        "humidity, and evapotranspiration data. Use this for flood risk analysis, drought "
        "monitoring, agriculture planning, and climate assessment. Accepts a location name "
        "and date range."
    )
    args_schema: Type[BaseModel] = WeatherToolInput

    def _run(
        self,
        location: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        variables: Optional[str] = None,
        query_id: str = "",
    ) -> str:
        # Default date range: last 7 days
        today = datetime.now()
        if not end_date:
            end_date = today.strftime("%Y-%m-%d")
        if not start_date:
            start_date = (today - timedelta(days=7)).strftime("%Y-%m-%d")
        if not variables:
            variables = "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max"

        # Geocode the location
        geo = geocode_location(location)
        if not geo:
            return json.dumps({"error": f"Could not geocode location: '{location}'"})

        lat, lon = geo["lat"], geo["lon"]
        print(f"[WeatherTool] Fetching weather for {location} ({lat:.4f},{lon:.4f}) | {start_date} to {end_date}")

        # Determine if historical or forecast
        today_str = today.strftime("%Y-%m-%d")
        if end_date <= today_str:
            # Historical data endpoint
            url = "https://archive-api.open-meteo.com/v1/archive"
        else:
            url = "https://api.open-meteo.com/v1/forecast"

        try:
            response = requests.get(
                url,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "daily": variables,
                    "start_date": start_date,
                    "end_date": end_date,
                    "timezone": "auto",
                },
                timeout=20,
            )
            response.raise_for_status()
            raw_data = response.json()
        except requests.RequestException as e:
            return json.dumps({"error": f"Open-Meteo API error: {str(e)}"})

        # Parse and summarize
        daily = raw_data.get("daily", {})
        dates = daily.get("time", [])
        precip = daily.get("precipitation_sum", [])
        temp_max = daily.get("temperature_2m_max", [])
        temp_min = daily.get("temperature_2m_min", [])
        wind = daily.get("windspeed_10m_max", [])

        # Calculate summary statistics
        valid_precip = [p for p in precip if p is not None]
        valid_temp_max = [t for t in temp_max if t is not None]
        valid_temp_min = [t for t in temp_min if t is not None]

        summary = {
            "location": location,
            "display_name": geo.get("display_name", location),
            "coordinates": {"lat": lat, "lon": lon},
            "period": {"start": start_date, "end": end_date, "days": len(dates)},
            "statistics": {
                "total_precipitation_mm": round(sum(valid_precip), 2) if valid_precip else None,
                "max_daily_precipitation_mm": round(max(valid_precip), 2) if valid_precip else None,
                "avg_temp_max_c": round(sum(valid_temp_max) / len(valid_temp_max), 2) if valid_temp_max else None,
                "avg_temp_min_c": round(sum(valid_temp_min) / len(valid_temp_min), 2) if valid_temp_min else None,
                "max_wind_speed_kmh": round(max(w for w in wind if w is not None), 2) if any(w is not None for w in wind) else None,
            },
            "daily_data": {
                "dates": dates,
                "precipitation_mm": precip,
                "temp_max_c": temp_max,
                "temp_min_c": temp_min,
                "wind_speed_kmh": wind,
            },
            "source": "Open-Meteo (open-meteo.com)",
            "api_key_required": False,
        }

        # Store result
        storage = StorageManager(query_id=query_id or None)
        storage.save_metadata(summary, result_type="weather_summary")

        # Create a human-readable summary for the agent
        s = summary["statistics"]
        readable = (
            f"Weather data retrieved for {location} ({start_date} to {end_date}):\n"
            f"  - Total Rainfall: {s['total_precipitation_mm']} mm over {len(dates)} days\n"
            f"  - Peak Daily Rainfall: {s['max_daily_precipitation_mm']} mm\n"
            f"  - Avg Max Temperature: {s['avg_temp_max_c']}°C\n"
            f"  - Max Wind Speed: {s['max_wind_speed_kmh']} km/h\n"
            f"  - Data source: Open-Meteo (free, no API key)\n"
            f"  - Saved to: {storage.data_root}/weather/"
        )

        return json.dumps({"summary": readable, "data": summary})
