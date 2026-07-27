"""
GeoLens AI - Data Acquisition Agent
======================================
The Data Acquisition Agent is the executor of GeoLens AI. It receives
the analysis plan and dataset recommendations from the first two agents,
then actually calls the relevant APIs to fetch, filter, and store real data.

Position in pipeline:
  Planner Agent → Dataset Discovery Agent → Data Acquisition Agent

Responsibilities:
- Call the correct data tools based on what the Dataset Discovery Agent recommended
- Pass location, date range, and other parameters from the analysis plan
- Handle errors gracefully (try alternatives if a tool fails)
- Report exactly what was retrieved, stored, and where to find it
"""

import os
from crewai import Agent, LLM

from tools.weather_tool import WeatherTool
from tools.fire_tool import FireTool
from tools.osm_tool import OSMTool
from tools.boundary_tool import BoundaryTool
from tools.climate_tool import ClimateTool
from tools.research_tool import ResearchTool
from tools.soil_tool import SoilTool, PopulationTool
from tools.india_gov_tool import IndiaGovTool
from tools.gee_tool import GEETool
from tools.web_search_tool import WebSearchTool
from tools.screenshot_tool import ScreenshotTool


def create_data_acquisition_agent(llm: LLM = None) -> Agent:
    """
    Create and return the Data Acquisition Agent.

    Args:
        llm: Optional LLM instance. Defaults to Gemini Flash from env.

    Returns:
        A configured CrewAI Agent with all 10 data acquisition tools.
    """
    if llm is None:
        llm = LLM(
            model=os.getenv("GEMINI_MODEL", "gemini/gemini-2.0-flash"),
            api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0.1,  # Very low — this agent should be precise and deterministic
        )

    # Instantiate all tools
    tools = [
        WeatherTool(),
        FireTool(),
        OSMTool(),
        BoundaryTool(),
        ClimateTool(),
        ResearchTool(),
        SoilTool(),
        PopulationTool(),
        IndiaGovTool(),
        GEETool(),
        WebSearchTool(),
        ScreenshotTool(),
    ]

    agent = Agent(
        role="Geospatial Data Acquisition Specialist",
        goal=(
            "Execute the data acquisition plan: call the relevant APIs and tools "
            "to actually download and store the geospatial data identified in the "
            "analysis plan and dataset recommendations. For each data requirement, "
            "use the appropriate tool, passing the correct location and date range. "
            "Report exactly what was retrieved, any failures, and where data is stored."
        ),
        backstory=(
            "You are a meticulous data engineer with deep expertise in geospatial "
            "APIs and data pipelines. You know exactly how to:\n\n"
            "- Fetch weather data from Open-Meteo (free, no key needed)\n"
            "- Download active fire data from NASA FIRMS\n"
            "- Query OpenStreetMap via Overpass API for map features\n"
            "- Download administrative boundaries from GADM\n"
            "- Retrieve climate data from NASA POWER (1981-present)\n"
            "- Search scientific papers via OpenAlex\n"
            "- Get soil properties from SoilGrids\n"
            "- Fetch population data from WorldPop\n"
            "- Query Indian government datasets from data.gov.in\n"
            "- Access satellite imagery via Google Earth Engine (Sentinel, Landsat, MODIS)\n"
            "- Search the web via Google for disaster reports and news\n"
            "- Capture screenshots of portals like ISRO Bhuvan or NDMA\n\n"
            "Your approach is systematic:\n"
            "1. Read the analysis plan and dataset recommendations carefully\n"
            "2. Identify which tools to call and in what order\n"
            "3. Call each tool with the exact location and date range from the plan\n"
            "4. If a tool fails, try an alternative (e.g., NASA POWER if Open-Meteo fails)\n"
            "5. Compile a clear summary of everything retrieved and stored\n\n"
            "You are efficient — you don't call tools unnecessarily. If the plan "
            "needs weather and fire data, you call WeatherTool and FireTool. If it "
            "also needs boundaries, you call BoundaryTool. You don't fetch data "
            "that wasn't identified as needed in the analysis plan.\n\n"
            "All data you retrieve is automatically stored in PostGIS (if connected) "
            "and local files. You report the file paths so downstream agents can use them."
        ),
        tools=tools,
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=25,  # Needs more iterations — calls multiple tools
    )

    return agent
