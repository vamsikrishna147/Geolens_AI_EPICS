"""
Test Suite: GeoLens AI — End-to-End Integration
================================================
Validates:
  1. Geocoder search resolves locations to lat/lon + bbox
  2. Nearby places returns MACRO and MICRO targets
  3. LLM key pool initialises with at least 1 slot
  4. Spectral pipeline functions are callable
  5. GeoLensCrew 5-task pipeline builds correctly
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def test_geocoder_search_and_nearby():
    print("Testing Geocoder Search & Nearby...")
    from utils.geocoder import geocode_location, get_nearby_places

    geo = geocode_location("New York City")
    assert geo is not None
    assert "lat" in geo and "lon" in geo
    assert round(geo["lat"], 1) == 40.7
    print(f"  [OK] Geocoded 'New York City': lat={geo['lat']}, lon={geo['lon']}")

    targets = get_nearby_places("New York City")
    assert len(targets) >= 2
    types = [t["type"] for t in targets]
    assert "MACRO_VIEW" in types
    assert "MICRO_VIEW" in types
    print(f"  [OK] get_nearby_places returned {len(targets)} targets: {types}")


def test_llm_key_pool():
    print("Testing Gemini LLM Key Pool...")
    from utils.llm_manager import get_pool, pool_status

    pool = get_pool()
    status = pool_status()
    assert len(status) >= 1
    # At least one slot should contain KEY_1 or OLLAMA
    assert any("KEY_1" in k or "OLLAMA" in k for k in status)
    print(f"  [OK] LLM pool active: {list(status.keys())}")


def test_spectral_pipelines_importable():
    print("Testing spectral pipeline imports...")
    from utils.spectral_pipeline import (
        run_change_vector_analysis,
        run_urban_expansion_pipeline,
        run_evi_pipeline,
        run_ndwi_flood_pipeline,
        run_wildfire_pipeline,
    )
    print("  [OK] All Phase-4 spectral functions importable.")


def test_crew_pipeline_instantiation():
    print("Testing 5-Agent GeoLensCrew pipeline build...")
    from crews.geolens_crew import GeoLensCrew

    crew = GeoLensCrew()
    tasks = crew._build_tasks("Analyze NDVI changes in Kerala")
    assert len(tasks) == 5, f"Expected 5 tasks, got {len(tasks)}"

    # Verify all output keys are defined
    assert len(GeoLensCrew._OUTPUT_KEYS) == 5
    print(f"  [OK] Crew builds 5 tasks with output keys: {GeoLensCrew._OUTPUT_KEYS}")


if __name__ == "__main__":
    print("=" * 60)
    print("GEOLENS AI — END-TO-END INTEGRATION TEST SUITE")
    print("=" * 60 + "\n")

    test_geocoder_search_and_nearby()
    test_llm_key_pool()
    test_spectral_pipelines_importable()
    test_crew_pipeline_instantiation()

    print("\n" + "=" * 60)
    print("[SUCCESS] ALL INTEGRATION TESTS PASSED")
    print("=" * 60)
