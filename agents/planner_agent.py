"""
GeoLens AI - Planner Agent
============================
The Planner Agent is the brain of GeoLens AI. It receives a user's
natural language geospatial query and produces a structured analysis plan.

Responsibilities:
- Parse the user's query to extract location, time period, and intent
- Identify what types of geospatial analysis are needed
- Determine what data categories are required
- Output a structured plan that downstream agents can act on
"""

import os

from crewai import Agent, LLM


def create_planner_agent(llm: LLM = None) -> Agent:
    """
    Create and return the Planner Agent.

    Args:
        llm: Optional LLM instance. If not provided, uses Gemini Flash
             from environment variable GEMINI_API_KEY.

    Returns:
        A configured CrewAI Agent for geospatial analysis planning.
    """
    if llm is None:
        llm = LLM(
            model=os.getenv("GEMINI_MODEL", "gemini/gemini-2.0-flash"),
            api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0.3,  # Lower temperature for more structured output
        )

    planner = Agent(
        role="Geospatial Analysis Planner",
        goal=(
            "Analyze the user's natural language geospatial query and create "
            "a comprehensive, structured analysis plan. Identify the location "
            "or area of interest, time period, types of analysis needed "
            "(e.g., NDVI, flood detection, change detection, land cover), "
            "data requirements, and expected outputs. Your plan will be used "
            "by downstream agents to discover datasets and perform analysis."
        ),
        backstory=(
            "You are a senior geospatial analyst and project planner with "
            "20 years of experience in remote sensing, GIS, environmental "
            "monitoring, disaster management, urban planning, and agriculture. "
            "You have deep expertise in satellite imagery analysis (Sentinel, "
            "Landsat, MODIS), vegetation indices (NDVI, NDWI, EVI), land "
            "cover classification, flood detection, wildfire monitoring, "
            "change detection, and terrain analysis.\n\n"
            "When a user asks a geospatial question — no matter how simple "
            "or complex — you systematically break it down into:\n"
            "1. Location/Area of Interest (AOI) with coordinates if possible\n"
            "2. Time period (historical, current, or comparison range)\n"
            "3. Analysis types required (what algorithms/methods to apply)\n"
            "4. Data categories needed (satellite imagery, weather, elevation, etc.)\n"
            "5. Expected outputs (maps, statistics, reports, comparisons)\n\n"
            "You always think about what data sources would be most appropriate "
            "for the spatial resolution, temporal resolution, and geographic "
            "coverage required by the query. You consider cloud cover for "
            "optical imagery, suggest SAR alternatives when appropriate, and "
            "recommend complementary datasets that strengthen the analysis."
        ),
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=15,
    )

    return planner
