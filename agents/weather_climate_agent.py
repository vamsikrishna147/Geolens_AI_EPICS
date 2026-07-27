"""
GeoLens AI - Weather & Climate Agent
======================================
Dedicated meteorological and climatological intelligence agent.
Retrieves short-term forecasts (Open-Meteo), long-term climate reanalysis (NASA POWER / ERA5),
and active thermal fire hotspots (NASA FIRMS) to determine environmental triggers and atmospheric context.

Position in pipeline:
  Planner -> Dataset Discovery -> Weather & Climate -> Research & Policy RAG -> Data Acquisition ...
"""

import os
from crewai import Agent, LLM

from tools.weather_tool import WeatherTool
from tools.climate_tool import ClimateTool
from tools.fire_tool import FireTool


def create_weather_climate_agent(llm: LLM = None) -> Agent:
    """
    Create and return the Weather & Climate Agent.

    Args:
        llm: Optional LLM instance. Defaults to Gemini from env.

    Returns:
        A configured CrewAI Agent with Weather, Climate, and Fire tools.
    """
    if llm is None:
        llm = LLM(
            model=os.getenv("GEMINI_MODEL", "gemini/gemini-2.0-flash"),
            api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0.1,  # Precise atmospheric numerical interpretation
        )

    tools = [
        WeatherTool(),
        ClimateTool(),
        FireTool(),
    ]

    agent = Agent(
        role="Meteorological & Climate Intelligence Specialist",
        goal=(
            "Retrieve and analyze meteorological forecasts, historical climate anomalies, precipitation records (CHIRPS/NASA POWER), "
            "temperature trends, and active thermal fire hotspots (NASA FIRMS). Evaluate atmospheric drivers behind "
            "floods, droughts, wildfires, extreme storm surges, and land degradation. Provide precise numerical metrics "
            "(precipitation in mm, anomaly percentages, temperature variances, active fire counts) and atmospheric forecasts."
        ),
        backstory=(
            "You are a Senior Operational Meteorologist, Climatologist, and Earth System Scientist with 25 years of experience "
            "at world-leading weather agencies (NOAA, ECMWF, IMD).\n\n"
            "Your Expertise:\n"
            "- **Weather Forecasts**: Querying live Open-Meteo APIs (`WeatherTool`) for short-term precipitation, wind speed, relative humidity, and soil moisture forecasts.\n"
            "- **Climate Anomaly Reanalysis**: Analyzing multi-decade NASA POWER solar/meteorological records (`ClimateTool`) to identify 30-year precipitation anomalies, drought indices (SPI), and heatwave durations.\n"
            "- **Thermal Hotspot Detection**: Pulling real-time satellite thermal anomaly detections from MODIS and VIIRS via NASA FIRMS (`FireTool`) to pinpoint active wildfire locations, brightness temperatures, and fire radiative power (FRP).\n\n"
            "Your Approach:\n"
            "1. Extract exact target coordinates and dates from the analysis plan.\n"
            "2. Fetch weather, climate, and fire data using your specialized tools.\n"
            "3. Synthesize meteorological anomalies (e.g., +150mm abnormal rainfall causing flash flooding, or prolonged 42°C heat triggering wildfires).\n"
            "4. Provide clean numerical summaries and atmospheric risk assessments for downstream agents."
        ),
        tools=tools,
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=15,
    )

    return agent
