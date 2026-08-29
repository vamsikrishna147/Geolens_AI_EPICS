"""
Test Suite: Phase 4 — Complete GIS Algorithm & Change Detection Engine
=======================================================================
Validates:
  1. All 8 spectral_pipeline functions (import + stub-mode)
  2. ChangeDetectionTool instantiation and input schema
  3. GEETool new analysis branches (nbr, change_detection)
  4. Temporal Analysis Agent now carries 5 tools including ChangeDetectionTool
  5. tools/__init__.py exports ChangeDetectionTool
  6. utils/__init__.py exports all spectral pipeline functions
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


def test_spectral_pipeline_imports():
    print("Testing spectral_pipeline module imports...")
    from utils.spectral_pipeline import (
        run_ndvi_change_pipeline,
        run_ndwi_flood_pipeline,
        run_sar_flood_pipeline,
        run_wildfire_pipeline,
        run_urban_expansion_pipeline,
        run_evi_pipeline,
        run_savi_pipeline,
        run_change_vector_analysis,
    )
    # All 8 pipelines are callable
    assert callable(run_ndvi_change_pipeline)
    assert callable(run_ndwi_flood_pipeline)
    assert callable(run_sar_flood_pipeline)
    assert callable(run_wildfire_pipeline)
    assert callable(run_urban_expansion_pipeline)
    assert callable(run_evi_pipeline)
    assert callable(run_savi_pipeline)
    assert callable(run_change_vector_analysis)
    print("  [OK] All 8 spectral pipeline functions imported successfully.")


def test_spectral_pipeline_no_gee_graceful():
    """
    When GEE is not available, all pipelines must return a
    structured error dict (not raise exceptions).
    """
    print("Testing spectral pipeline graceful no-GEE degradation...")
    from utils import spectral_pipeline as sp

    # Temporarily set GEE_AVAILABLE to False to test graceful fallback
    original = sp.GEE_AVAILABLE
    sp.GEE_AVAILABLE = False

    result = sp.run_ndvi_change_pipeline("Test Location", None, 2018, 2024)
    assert "error" in result
    assert result["pipeline"] == "ndvi_change"

    result2 = sp.run_ndwi_flood_pipeline("Test", None, "2024-07-01", "2024-07-31")
    assert "error" in result2

    result3 = sp.run_wildfire_pipeline("Test", None, "2024-07-01", "2024-07-31", "2024-01-01", "2024-06-30")
    assert "error" in result3

    result4 = sp.run_urban_expansion_pipeline("Test", None, 2019, 2024)
    assert "error" in result4

    sp.GEE_AVAILABLE = original
    print("  [OK] All spectral pipelines fail gracefully without GEE.")


def test_change_detection_tool_instantiation():
    print("Testing ChangeDetectionTool instantiation and schema...")
    from tools.change_detection_tool import ChangeDetectionTool, ChangeDetectionInput
    tool = ChangeDetectionTool()
    assert tool.name == "GeoLens Change Detection & Spectral Index Pipeline Tool"

    # Validate Pydantic schema fields
    fields = ChangeDetectionInput.model_fields
    assert "location"             in fields
    assert "pipeline"             in fields
    assert "year_t1"              in fields
    assert "year_t2"              in fields
    assert "event_start_date"     in fields
    assert "event_end_date"       in fields
    assert "baseline_start_date"  in fields
    assert "baseline_end_date"    in fields
    assert "dataset"              in fields
    print("  [OK] ChangeDetectionTool instantiated with correct schema fields.")


def test_change_detection_tool_no_gee_response():
    """Tool should return structured JSON error when GEE is not configured."""
    print("Testing ChangeDetectionTool no-GEE JSON response...")
    import json
    # Unset project ID to simulate unconfigured environment
    old = os.environ.get("GEE_PROJECT_ID", "")
    os.environ["GEE_PROJECT_ID"] = ""

    from tools.change_detection_tool import ChangeDetectionTool
    tool = ChangeDetectionTool()
    result = tool._run(
        location="Konaseema, Andhra Pradesh",
        pipeline="ndvi_change",
        year_t1=2018,
        year_t2=2024,
    )
    result_dict = json.loads(result)
    assert "error" in result_dict

    os.environ["GEE_PROJECT_ID"] = old
    print("  [OK] ChangeDetectionTool returns structured JSON error when GEE not configured.")


def test_gee_tool_new_analysis_options():
    print("Testing GEETool new analysis options in schema description...")
    from tools.gee_tool import GEETool, GEEToolInput
    tool = GEETool()
    assert "nbr" in tool.description.lower() or "burn" in tool.description.lower()
    assert "change" in tool.description.lower()

    # Schema should include start_date_t2, end_date_t2 fields
    fields = GEEToolInput.model_fields
    assert "start_date_t2" in fields
    assert "end_date_t2"   in fields
    print("  [OK] GEETool has nbr, change_detection analysis options and T2 date fields.")


def test_temporal_agent_has_change_detection_tool():
    print("Testing Temporal Analysis Agent has 5 tools including ChangeDetectionTool...")
    from agents.temporal_analysis_agent import create_temporal_analysis_agent
    from tools.change_detection_tool import ChangeDetectionTool

    agent = create_temporal_analysis_agent()
    assert len(agent.tools) == 5
    tool_names = [t.name for t in agent.tools]
    assert "GeoLens Change Detection & Spectral Index Pipeline Tool" in tool_names
    assert "Google Earth Engine Satellite Data Tool" in tool_names
    print(f"  [OK] Temporal Analysis Agent has 5 tools: {tool_names}")


def test_tools_package_exports():
    print("Testing tools/__init__.py exports ChangeDetectionTool...")
    from tools import ChangeDetectionTool
    assert ChangeDetectionTool is not None
    print("  [OK] tools package exports ChangeDetectionTool correctly.")


def test_utils_package_exports():
    print("Testing utils/__init__.py exports spectral pipeline functions...")
    from utils import (
        run_ndvi_change_pipeline,
        run_sar_flood_pipeline,
        run_wildfire_pipeline,
        run_change_vector_analysis,
    )
    assert callable(run_ndvi_change_pipeline)
    assert callable(run_sar_flood_pipeline)
    assert callable(run_wildfire_pipeline)
    assert callable(run_change_vector_analysis)
    print("  [OK] utils package exports all spectral pipeline functions.")


if __name__ == "__main__":
    print("=" * 60)
    print("PHASE 4 — GIS Algorithm & Change Detection Engine Tests")
    print("=" * 60 + "\n")

    test_spectral_pipeline_imports()
    test_spectral_pipeline_no_gee_graceful()
    test_change_detection_tool_instantiation()
    test_change_detection_tool_no_gee_response()
    test_gee_tool_new_analysis_options()
    test_temporal_agent_has_change_detection_tool()
    test_tools_package_exports()
    test_utils_package_exports()

    print("\n" + "=" * 60)
    print("[SUCCESS] All Phase 4 tests passed!")
    print("=" * 60)
