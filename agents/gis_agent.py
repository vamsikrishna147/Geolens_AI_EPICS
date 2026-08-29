"""
GeoLens AI - GIS Processing Agent
====================================
The GIS Processing Agent is the 4th step in the pipeline. It takes the
file paths returned by the Data Acquisition Agent and executes GIS
operations: clipping, buffering, spatial joins, and map generation.

Pipeline position:
  Planner → Dataset Discovery → Data Acquisition → GIS Processing → Satellite Analysis
"""

from crewai import Agent

from tools.vector_tool import VectorTool
from tools.raster_tool import RasterTool
from tools.map_tool import MapTool


def create_gis_agent(llm=None) -> Agent:
    """
    Create and return the GIS Processing Agent.

    Args:
        llm: Optional LLM instance. Defaults to Gemini from env.

    Returns:
        A configured CrewAI Agent with Vector, Raster, and Map tools.
    """
    if llm is None:
        from utils.llm_manager import get_llm
        llm = get_llm()

    tools = [
        VectorTool(),
        RasterTool(),
        MapTool(),
    ]

    agent = Agent(
        role="GIS Processing Technician",
        goal=(
            "Process acquired geospatial data using vector/raster operations, "
            "generate interactive maps, and report all output file paths."
        ),
        backstory=(
            "You are a GIS technician. Use VectorTool, RasterTool, and MapTool.\n"
            "Supported operations:\n"
            "- Buffer: create buffer zones around features\n"
            "- Intersect: find features within a zone\n"
            "- Clip: crop rasters to boundaries\n"
            "- Zonal Stats: compute stats (mean NDVI, elevation) within polygons\n"
            "- Area: calculate polygon areas in sq km\n"
            "- Map: generate interactive HTML maps\n\n"
            "Always generate at least one map. Report all output file paths."
        ),
        tools=tools,
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=12,
    )

    return agent
