# GeoLens AI - Tools Package
"""All custom CrewAI tools for the GeoLens AI platform."""

from tools.dataset_registry_tool import DatasetRegistryTool
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
from tools.vector_tool import VectorTool
from tools.raster_tool import RasterTool
from tools.map_tool import MapTool
from tools.change_detection_tool import ChangeDetectionTool

__all__ = [
    "DatasetRegistryTool",
    "WeatherTool",
    "FireTool",
    "OSMTool",
    "BoundaryTool",
    "ClimateTool",
    "ResearchTool",
    "SoilTool",
    "PopulationTool",
    "IndiaGovTool",
    "GEETool",
    "WebSearchTool",
    "ScreenshotTool",
    "VectorTool",
    "RasterTool",
    "MapTool",
    "ChangeDetectionTool",
]
