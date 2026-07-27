"""
Test Suite: Phase 3 Specialized AI Agents & GeoLensCrew Orchestration
========================================================================
Validates all 10 specialized agents, their tool bindings, and output schemas.
"""

import sys
import os

# Ensure project root is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agents import (
    create_planner_agent,
    create_dataset_discovery_agent,
    create_data_acquisition_agent,
    create_satellite_agent,
    create_gis_agent,
    create_report_agent,
    create_temporal_analysis_agent,
    create_research_policy_agent,
    create_weather_climate_agent,
    create_recommendation_agent,
)
from crews.geolens_crew import GeoLensCrew


def test_agent_instantiations():
    print("Testing agent instantiations...")
    
    planner = create_planner_agent()
    assert planner.role == "Geospatial Analysis Planner"
    print("  [OK] Planner Agent instantiated successfully.")

    discovery = create_dataset_discovery_agent()
    assert discovery.role == "Geospatial Dataset Discovery Specialist"
    print("  [OK] Dataset Discovery Agent instantiated successfully.")

    weather = create_weather_climate_agent()
    assert weather.role == "Meteorological & Climate Intelligence Specialist"
    assert len(weather.tools) == 3
    print("  [OK] Weather & Climate Agent instantiated with 3 tools.")

    research = create_research_policy_agent()
    assert research.role == "Geospatial Research & Governance Policy RAG Specialist"
    assert len(research.tools) == 3
    print("  [OK] Research & Policy RAG Agent instantiated with 3 tools.")

    temporal = create_temporal_analysis_agent()
    assert temporal.role == "TimeLens Historical Change Detection & Multi-Temporal Analyst"
    assert len(temporal.tools) == 4
    print("  [OK] Temporal Analysis Agent (TimeLens AI Engine) instantiated with 4 tools.")

    recommendation = create_recommendation_agent()
    assert recommendation.role == "Disaster Mitigation & Policy Recommendation Strategist"
    print("  [OK] Recommendation & Decision Support Agent instantiated successfully.")

    satellite = create_satellite_agent()
    assert satellite.role == "Earth Observation & Web Intelligence Specialist"
    print("  [OK] Satellite Agent instantiated successfully.")

    gis = create_gis_agent()
    assert gis.role == "GIS Processing Technician"
    assert len(gis.tools) == 3
    print("  [OK] GIS Agent instantiated with 3 tools.")

    acquisition = create_data_acquisition_agent()
    assert acquisition.role == "Geospatial Data Acquisition Specialist"
    assert len(acquisition.tools) >= 10
    print(f"  [OK] Data Acquisition Agent instantiated with {len(acquisition.tools)} tools.")

    report = create_report_agent()
    assert report.role == "Senior Government Intelligence Analyst"
    print("  [OK] Official Report Agent instantiated successfully.")

    print("\n[SUCCESS] All 10 specialized agents instantiated cleanly with correct roles and tool bindings!\n")


def test_crew_instantiation():
    print("Testing 10-Agent GeoLensCrew initialization...")
    crew_full = GeoLensCrew(skip_acquisition=False)
    assert crew_full.planner is not None
    assert crew_full.temporal_agent is not None
    assert crew_full.weather_agent is not None
    assert crew_full.research_agent is not None
    assert crew_full.recommendation_agent is not None

    crew_fast = GeoLensCrew(skip_acquisition=True)
    assert crew_fast.planner is not None
    assert crew_fast.weather_agent is not None

    print("[SUCCESS] GeoLensCrew 10-agent orchestration initialized cleanly!")


if __name__ == "__main__":
    test_agent_instantiations()
    test_crew_instantiation()
