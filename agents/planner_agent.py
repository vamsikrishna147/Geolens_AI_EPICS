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

from crewai import Agent


def create_planner_agent(llm=None) -> Agent:
    """
    Create and return the Planner Agent.

    Args:
        llm: Optional LLM instance. If not provided, uses Gemini Flash
             from environment variable GEMINI_API_KEY.

    Returns:
        A configured CrewAI Agent for geospatial analysis planning.
    """
    if llm is None:
        from utils.llm_manager import get_llm
        llm = get_llm()

    planner = Agent(
        role="Geospatial Analysis Planner",
        goal=(
            "Parse the user's geospatial query into a structured plan "
            "covering location, time, analysis types, data needs, and outputs "
            "for downstream agents."
        ),
        backstory=(
            "You are a geospatial analyst who breaks down any query into:\n"
            "1. Location/AOI with coordinates if possible\n"
            "2. Time period (historical, current, or comparison range)\n"
            "3. Analysis types (NDVI, flood detection, change detection, land cover, etc.)\n"
            "4. Data categories (satellite imagery, weather, elevation, etc.)\n"
            "5. Expected outputs (maps, statistics, reports, comparisons)\n\n"
            "Choose data sources appropriate for the required spatial/temporal "
            "resolution and geographic coverage."
        ),
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=8,
    )

    return planner
