"""
GeoLens AI - Data Sourcing Agent
======================================
Combines satellite dataset discovery and acquisition into a single agent.
Receives the analysis plan, searches the dataset registry, then fetches
and stores real geospatial data via the provided tools.

Pipeline position:
  Planner → Data Sourcing Agent → GIS Processing → ...
"""

from crewai import Agent

from tools.dataset_registry_tool import DatasetRegistryTool
from tools.osm_tool import OSMTool
from tools.boundary_tool import BoundaryTool
from tools.gee_tool import GEETool
from tools.web_search_tool import WebSearchTool
from tools.screenshot_tool import ScreenshotTool


def create_data_sourcing_agent(llm=None) -> Agent:
    """
    Create and return the Data Sourcing Agent.

    Args:
        llm: Optional LLM instance. Defaults to Gemini from env.

    Returns:
        A configured CrewAI Agent with dataset discovery and acquisition tools.
    """
    if llm is None:
        from utils.llm_manager import get_llm
        llm = get_llm()

    tools = [
        DatasetRegistryTool(),
        OSMTool(),
        BoundaryTool(),
        GEETool(),
        WebSearchTool(),
        ScreenshotTool(),
    ]

    agent = Agent(
        role="Data Acquisition Specialist",
        goal=(
            "Search the dataset registry for relevant satellite and open geospatial data, "
            "fetch it via the provided tools, and report what was retrieved, "
            "any failures, and where data is stored."
        ),
        backstory=(
            "Expert geospatial data engineer. Systematic approach:\n"
            "1. Read the analysis plan.\n"
            "2. Query DatasetRegistryTool for best-fit satellite datasets.\n"
            "3. Call acquisition tools (GEE, OSM, Boundary) with exact location/date.\n"
            "4. On failure, try alternatives.\n"
            "5. Summarise datasets found, retrieved, and stored."
        ),
        tools=tools,
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=18,
    )

    return agent
