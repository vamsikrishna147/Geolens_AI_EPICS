"""
GeoLens AI - Earth Observation Agent
======================================================
The Earth Observation Agent handles multi-temporal historical change detection
as well as satellite and web intelligence interpretation. It analyzes raster operations,
Google Earth Engine (GEE) results, and change vector metrics.

Position in pipeline:
  ... -> GIS Processing -> Earth Observation -> Final Reporting
"""

from crewai import Agent

from tools.gee_tool import GEETool
from tools.raster_tool import RasterTool
from tools.vector_tool import VectorTool
from tools.map_tool import MapTool
from tools.change_detection_tool import ChangeDetectionTool

from tools.screenshot_tool import ScreenshotTool

def create_earth_observation_agent(llm=None) -> Agent:
    """
    Create and return the Earth Observation Agent.

    Args:
        llm: Optional LLM instance. Defaults to Gemini from env.

    Returns:
        A configured CrewAI Agent with GEE, Raster, Vector, Map, Change Detection, and Screenshot tools.
    """
    if llm is None:
        from utils.llm_manager import get_llm
        llm = get_llm()

    tools = [
        ChangeDetectionTool(),
        GEETool(),
        RasterTool(),
        VectorTool(),
        MapTool(),
        ScreenshotTool(),
    ]

    agent = Agent(
        role="Earth Observation & TimeLens Analyst",
        goal=(
            "Quantify multi-temporal changes (NDVI/NDWI/SAR differencing, urban expansion, "
            "forest loss, disaster impact) using TimeLens. Interpret the physical event and "
            "provide exact metrics (area km², percentage change) with clear explanations."
        ),
        backstory=(
            "Senior Remote Sensing Specialist. You follow the TimeLens methodology:\n"
            "1. Ingest upstream raster/GEE/zonal stats.\n"
            "2. Identify baseline (T1) vs comparison (T2) periods.\n"
            "3. Compute net deltas and classify changes into categories.\n"
            "4. Synthesize an evidence-based Earth Observation brief interpreting the physical transformation.\n"
            "CRITICAL FALLBACK: If direct API access to Earth Engine or satellite data fails or times out, you MUST fall back to using your ScreenshotTool to navigate to web-based Earth observation portals (e.g., NASA Worldview or ISRO Bhuvan) and capture the visual data to ensure the mission does not fail."
        ),
        tools=tools,
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=15,
    )

    return agent
