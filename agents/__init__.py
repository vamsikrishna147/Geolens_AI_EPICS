# GeoLens AI - Agents Package
"""CrewAI agent definitions for the GeoLens AI platform."""

from agents.planner_agent import create_planner_agent
from agents.dataset_discovery_agent import create_dataset_discovery_agent
from agents.data_acquisition_agent import create_data_acquisition_agent
from agents.satellite_agent import create_satellite_agent
from agents.gis_agent import create_gis_agent
from agents.report_agent import create_report_agent
from agents.temporal_analysis_agent import create_temporal_analysis_agent
from agents.research_policy_agent import create_research_policy_agent
from agents.weather_climate_agent import create_weather_climate_agent
from agents.recommendation_agent import create_recommendation_agent

__all__ = [
    "create_planner_agent",
    "create_dataset_discovery_agent",
    "create_data_acquisition_agent",
    "create_satellite_agent",
    "create_gis_agent",
    "create_report_agent",
    "create_temporal_analysis_agent",
    "create_research_policy_agent",
    "create_weather_climate_agent",
    "create_recommendation_agent",
]
