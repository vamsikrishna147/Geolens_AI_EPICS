"""
Test Suite: 5-Agent GeoLens AI Pipeline — Integration Tests
=============================================================
Validates:
  1. All 5 agents instantiate correctly with proper roles & tool bindings
  2. GeoLensCrew builds the 5-task sequential pipeline without errors
  3. Geocoder search + nearby places utilities work
  4. LLM key pool initialises and returns status
  5. Spectral pipeline functions are callable
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agents import (
    create_planner_agent,
    create_data_sourcing_agent,
    create_gis_agent,
    create_earth_observation_agent,
    create_final_reporting_agent,
)
from crews.geolens_crew import GeoLensCrew


def test_agent_instantiations():
    print("Testing 5-agent instantiations...")

    planner = create_planner_agent()
    assert planner.role == "Geospatial Analysis Planner"
    print("  [OK] Planner Agent — role verified.")

    data_agent = create_data_sourcing_agent()
    assert data_agent.role == "Data Sourcing Agent"
    assert len(data_agent.tools) >= 4
    print(f"  [OK] Data Sourcing Agent — {len(data_agent.tools)} tools.")

    gis = create_gis_agent()
    assert gis.role == "GIS Processing Technician"
    assert len(gis.tools) == 3
    print(f"  [OK] GIS Agent — {len(gis.tools)} tools.")

    eo = create_earth_observation_agent()
    assert eo.role == "Earth Observation & TimeLens Analyst"
    assert len(eo.tools) >= 4
    print(f"  [OK] Earth Observation Agent — {len(eo.tools)} tools.")

    report = create_final_reporting_agent()
    assert report.role == "Senior Government Intelligence & Policy Strategist"
    print("  [OK] Report Intelligence Agent — no tools (text synthesis only).")

    print("\n[SUCCESS] All 5 agents instantiated with correct roles and tool bindings.\n")


def test_crew_instantiation():
    print("Testing 5-Agent GeoLensCrew initialization...")
    crew = GeoLensCrew()
    assert crew.planner is not None
    assert crew.data_agent is not None
    assert crew.gis_agent is not None
    assert crew.eo_agent is not None
    assert crew.reporting_agent is not None

    tasks = crew._build_tasks("Detect floods in Assam")
    assert len(tasks) == 5, f"Expected 5 tasks, got {len(tasks)}"
    print(f"  [OK] Pipeline builds {len(tasks)} tasks.")

    output_keys = GeoLensCrew._OUTPUT_KEYS
    assert output_keys == [
        "analysis_plan", "data_acquisition",
        "gis_processing", "earth_observation", "official_report"
    ]
    print(f"  [OK] Output keys: {output_keys}")
    print("[SUCCESS] GeoLensCrew 5-agent orchestration initialised cleanly!\n")


def test_geocoder():
    print("Testing Geocoder utilities...")
    from utils.geocoder import geocode_location, get_nearby_places

    geo = geocode_location("Hyderabad")
    assert geo is not None
    assert "lat" in geo and "lon" in geo
    print(f"  [OK] Geocoded 'Hyderabad': lat={geo['lat']:.2f}, lon={geo['lon']:.2f}")

    targets = get_nearby_places("Hyderabad")
    assert len(targets) >= 2
    types = {t["type"] for t in targets}
    assert "MACRO_VIEW" in types
    print(f"  [OK] Nearby places: {len(targets)} targets returned.")


def test_llm_pool():
    print("Testing LLM key pool...")
    from utils.llm_manager import get_pool, pool_status

    pool = get_pool()
    status = pool_status()
    assert len(status) >= 1
    print(f"  [OK] LLM pool active with slots: {list(status.keys())}")


def test_spectral_functions_importable():
    print("Testing spectral pipeline imports...")
    from utils.spectral_pipeline import (
        run_change_vector_analysis,
        run_ndwi_flood_pipeline,
        run_sar_flood_pipeline,
        run_wildfire_pipeline,
        run_urban_expansion_pipeline,
        run_evi_pipeline,
    )
    print("  [OK] All spectral pipeline functions importable.")


if __name__ == "__main__":
    print("=" * 60)
    print("GEOLENS AI — 5-AGENT PIPELINE INTEGRATION TESTS")
    print("=" * 60 + "\n")

    test_agent_instantiations()
    test_crew_instantiation()
    test_geocoder()
    test_llm_pool()
    test_spectral_functions_importable()

    print("\n" + "=" * 60)
    print("[SUCCESS] ALL TESTS PASSED")
    print("=" * 60)
