"""
GeoLens AI - Change Detection Tool (Phase 4)
=============================================
A dedicated CrewAI BaseTool that wraps the spectral_pipeline module to give
the Temporal Analysis Agent (TimeLens Engine) direct access to all seven
Phase 4 geospatial change detection algorithms:

  1. NDVI Change Pipeline           - Vegetation health & deforestation tracking
  2. NDWI Optical Flood Pipeline    - Sentinel-2 surface water flood extent
  3. SAR Flood Pipeline             - Sentinel-1 all-weather flood mapping
  4. Wildfire NBR Pipeline          - Burn severity & fire perimeter mapping
  5. Urban Expansion Pipeline       - Dynamic World built-up area growth
  6. EVI Pipeline                   - Enhanced Vegetation Index
  7. SAVI Pipeline                  - Soil-Adjusted Vegetation Index (arid)
  8. Change Vector Analysis (CVA)   - Master multi-index change assessment
"""

import json
import os
from typing import Optional, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from utils.geocoder import geocode_location


# ── GEE graceful import ───────────────────────────────────────────────────────
try:
    import ee
    GEE_AVAILABLE = True
except ImportError:
    GEE_AVAILABLE = False


class ChangeDetectionInput(BaseModel):
    location: str = Field(
        ...,
        description=(
            "Location or area name to analyze. "
            "e.g. 'Konaseema district, Andhra Pradesh' or 'Chennai, India'"
        ),
    )
    pipeline: str = Field(
        ...,
        description=(
            "Change detection pipeline to run. Options: "
            "'ndvi_change' (vegetation loss T1 vs T2), "
            "'ndwi_flood' (optical flood extent via NDWI), "
            "'sar_flood' (Sentinel-1 SAR all-weather flood mapping), "
            "'wildfire' (NBR burn severity & fire perimeter), "
            "'urban_expansion' (Dynamic World built-up area growth), "
            "'evi' (Enhanced Vegetation Index analysis), "
            "'savi' (Soil-Adjusted Vegetation Index for arid regions), "
            "'cva' (Complete Change Vector Analysis — all indices combined)"
        ),
    )
    year_t1: Optional[int] = Field(
        None,
        description="Baseline year for multi-temporal analysis (e.g. 2018). Required for ndvi_change, urban_expansion, cva.",
    )
    year_t2: Optional[int] = Field(
        None,
        description="Comparison year (e.g. 2025). Required for ndvi_change, urban_expansion, cva.",
    )
    event_start_date: Optional[str] = Field(
        None,
        description="Event/analysis period start date (YYYY-MM-DD). Required for flood and wildfire pipelines.",
    )
    event_end_date: Optional[str] = Field(
        None,
        description="Event/analysis period end date (YYYY-MM-DD). Required for flood and wildfire pipelines.",
    )
    baseline_start_date: Optional[str] = Field(
        None,
        description="Baseline period start date (YYYY-MM-DD). Required for sar_flood and wildfire pipelines.",
    )
    baseline_end_date: Optional[str] = Field(
        None,
        description="Baseline period end date (YYYY-MM-DD). Required for sar_flood and wildfire pipelines.",
    )
    dataset: Optional[str] = Field(
        "sentinel2",
        description="Satellite dataset to use. Options: sentinel2, landsat8, landsat9, modis. Defaults to sentinel2.",
    )
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class ChangeDetectionTool(BaseTool):
    """
    Phase 4 Change Detection Tool for the TimeLens AI Engine.
    Wraps all spectral index and multi-temporal change detection pipelines.
    Requires Google Earth Engine (GEE) authentication.
    """

    name: str = "GeoLens Change Detection & Spectral Index Pipeline Tool"
    description: str = (
        "Runs automated Phase 4 geospatial change detection and spectral index pipelines. "
        "Supports NDVI vegetation change (deforestation), NDWI optical flood extent, "
        "SAR all-weather flood mapping (Sentinel-1), wildfire burn severity (dNBR), "
        "urban expansion (Dynamic World LULC), EVI, SAVI, and full multi-index "
        "Change Vector Analysis (CVA). Requires GEE authentication (set GEE_PROJECT_ID in .env). "
        "Returns quantitative metrics: area in km2, percentage change, severity classification."
    )
    args_schema: Type[BaseModel] = ChangeDetectionInput

    def _run(
        self,
        location: str,
        pipeline: str,
        year_t1: Optional[int] = None,
        year_t2: Optional[int] = None,
        event_start_date: Optional[str] = None,
        event_end_date: Optional[str] = None,
        baseline_start_date: Optional[str] = None,
        baseline_end_date: Optional[str] = None,
        dataset: str = "sentinel2",
        query_id: str = "",
    ) -> str:
        # Check GEE availability
        gee_project = os.getenv("GEE_PROJECT_ID", "")
        if not GEE_AVAILABLE:
            return json.dumps({
                "error": "earthengine-api not installed.",
                "fix": "pip install earthengine-api && earthengine authenticate",
            })
        if not gee_project or gee_project == "your_gee_project_id_here":
            return json.dumps({
                "error": "GEE_PROJECT_ID not configured.",
                "fix": "Set GEE_PROJECT_ID=your_project_id in .env and run earthengine authenticate",
            })

        # Authenticate GEE
        try:
            ee.Initialize(project=gee_project)
        except Exception as e:
            return json.dumps({"error": f"GEE initialization failed: {str(e)}"})

        # Geocode location to AOI
        geo = geocode_location(location)
        if not geo:
            return json.dumps({"error": f"Could not geocode location: '{location}'"})

        bbox = geo["bbox_ee"]  # [xmin, ymin, xmax, ymax]
        aoi  = ee.Geometry.Rectangle(bbox)

        print(f"[ChangeDetectionTool] Pipeline: {pipeline} | Location: {location} | AOI: {bbox}")

        # Import pipelines at runtime (avoids circular import)
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

        pipe = pipeline.lower().strip()

        try:
            if pipe == "ndvi_change":
                if not year_t1 or not year_t2:
                    return json.dumps({"error": "ndvi_change requires year_t1 and year_t2"})
                result = run_ndvi_change_pipeline(location, aoi, year_t1, year_t2, dataset)

            elif pipe == "ndwi_flood":
                if not event_start_date or not event_end_date:
                    return json.dumps({"error": "ndwi_flood requires event_start_date and event_end_date"})
                baseline_year = year_t1
                result = run_ndwi_flood_pipeline(location, aoi, event_start_date, event_end_date, baseline_year)

            elif pipe == "sar_flood":
                if not all([event_start_date, event_end_date, baseline_start_date, baseline_end_date]):
                    return json.dumps({"error": "sar_flood requires event_start_date, event_end_date, baseline_start_date, baseline_end_date"})
                result = run_sar_flood_pipeline(location, aoi, event_start_date, event_end_date, baseline_start_date, baseline_end_date)

            elif pipe == "wildfire":
                if not all([event_start_date, event_end_date, baseline_start_date, baseline_end_date]):
                    return json.dumps({"error": "wildfire requires event_start_date, event_end_date, baseline_start_date, baseline_end_date"})
                result = run_wildfire_pipeline(location, aoi, event_start_date, event_end_date, baseline_start_date, baseline_end_date)

            elif pipe == "urban_expansion":
                if not year_t1 or not year_t2:
                    return json.dumps({"error": "urban_expansion requires year_t1 and year_t2"})
                result = run_urban_expansion_pipeline(location, aoi, year_t1, year_t2)

            elif pipe == "evi":
                if not event_start_date or not event_end_date:
                    return json.dumps({"error": "evi requires event_start_date and event_end_date"})
                result = run_evi_pipeline(location, aoi, event_start_date, event_end_date)

            elif pipe == "savi":
                if not event_start_date or not event_end_date:
                    return json.dumps({"error": "savi requires event_start_date and event_end_date"})
                result = run_savi_pipeline(location, aoi, event_start_date, event_end_date)

            elif pipe in ("cva", "change_vector_analysis"):
                if not year_t1 or not year_t2:
                    return json.dumps({"error": "cva requires year_t1 and year_t2"})
                result = run_change_vector_analysis(location, aoi, year_t1, year_t2)

            else:
                return json.dumps({
                    "error": f"Unknown pipeline: '{pipeline}'",
                    "available": [
                        "ndvi_change", "ndwi_flood", "sar_flood", "wildfire",
                        "urban_expansion", "evi", "savi", "cva"
                    ],
                })

        except Exception as e:
            return json.dumps({
                "error": f"Pipeline '{pipeline}' execution failed: {str(e)}",
                "location": location,
            })

        # Save result metadata
        try:
            from storage.storage_manager import StorageManager
            storage = StorageManager(query_id=query_id or None)
            storage.save_metadata(result, result_type=f"change_{pipe}")
        except Exception:
            pass

        return json.dumps(result, indent=2)
