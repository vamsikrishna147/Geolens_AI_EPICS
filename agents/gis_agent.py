"""
GeoLens AI - GIS Processing Agent
====================================
The GIS Processing Agent is the 4th step in the pipeline. It takes the
file paths returned by the Data Acquisition Agent and executes GIS
operations: clipping, buffering, spatial joins, and map generation.

Pipeline position:
  Planner → Dataset Discovery → Data Acquisition → GIS Processing → Satellite Analysis
"""

import os
from crewai import Agent, LLM

from tools.vector_tool import VectorTool
from tools.raster_tool import RasterTool
from tools.map_tool import MapTool


def create_gis_agent(llm: LLM = None) -> Agent:
    """
    Create and return the GIS Processing Agent.

    Args:
        llm: Optional LLM instance. Defaults to Gemini from env.

    Returns:
        A configured CrewAI Agent with Vector, Raster, and Map tools.
    """
    if llm is None:
        llm = LLM(
            model=os.getenv("GEMINI_MODEL", "gemini/gemini-2.0-flash"),
            api_key=os.getenv("GEMINI_API_KEY"),
            temperature=0.1,  # Deterministic — GIS operations must be precise
        )

    tools = [
        VectorTool(),
        RasterTool(),
        MapTool(),
    ]

    agent = Agent(
        role="GIS Processing Technician",
        goal=(
            "Process the geospatial data files retrieved by the Data Acquisition Agent. "
            "Perform vector operations (buffer zones, spatial intersections, area calculations) "
            "and raster operations (clip to boundaries, zonal statistics). Then generate "
            "interactive HTML maps that visualize the final results. Report file paths "
            "for all outputs so the Satellite Analysis Agent can interpret them."
        ),
        backstory=(
            "You are an expert GIS technician with deep expertise in PostGIS, GeoPandas, "
            "and Rasterio. You take raw downloaded geospatial data and transform it into "
            "analysis-ready products.\n\n"
            "Your capabilities:\n"
            "- Buffer: Create buffer zones (e.g., 5km around a landslide point)\n"
            "- Intersect: Find features within a zone (e.g., hospitals in a flood area)\n"
            "- Clip: Crop satellite imagery to a district/state boundary\n"
            "- Zonal Stats: Calculate mean NDVI or elevation within a polygon\n"
            "- Area: Calculate the area of flood/landslide polygons in sq km\n"
            "- Map: Generate interactive HTML maps with satellite basemaps\n\n"
            "Your workflow:\n"
            "1. Read the Data Acquisition Agent's output to find file paths\n"
            "2. Identify which GIS operations would add analytical value\n"
            "3. Execute the operations using VectorTool, RasterTool, and MapTool\n"
            "4. Generate at least one interactive map for visualization\n"
            "5. Report all output file paths\n\n"
            "You are smart about choosing operations. If the query is about flooding, "
            "you clip the SAR data to the district boundary and calculate the flood area. "
            "If it's about landslides near infrastructure, you buffer the landslide points "
            "and intersect with OSM features. You always generate a map."
        ),
        tools=tools,
        llm=llm,
        verbose=True,
        allow_delegation=False,
        max_iter=20,
    )

    return agent
