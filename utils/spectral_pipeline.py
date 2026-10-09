"""
GeoLens AI - Spectral Index & Change Detection Pipeline
=========================================================
Phase 4 automated pipelines for:
  - NDVI / NDWI / EVI / SAVI vegetation and water index analysis
  - NBR wildfire burn severity computation
  - SAR-based flood inundation mapping
  - Urban expansion detection via LULC classification
  - Multi-temporal change vector analysis (CVA)

All pipelines return structured result dicts consumed by the Temporal Analysis Agent.
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import numpy as np

# ─── Rasterio / GeoPandas - graceful optional import ─────────────────────────
try:
    import rasterio
    import rasterio.mask
    from rasterio.transform import from_origin
    RASTERIO_AVAILABLE = True
except ImportError:
    RASTERIO_AVAILABLE = False

# ─── GEE - graceful optional import ──────────────────────────────────────────
try:
    import ee
    GEE_AVAILABLE = True
except ImportError:
    GEE_AVAILABLE = False


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. NDVI Change Pipeline  (Vegetation Health & Deforestation Tracking)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def run_ndvi_change_pipeline(
    location: str,
    aoi: "ee.Geometry",
    year_t1: int,
    year_t2: int,
    dataset: str = "sentinel2",
) -> Dict:
    """
    Run a full multi-temporal NDVI change detection pipeline.

    Computes mean NDVI for baseline year (T1) and comparison year (T2),
    then calculates the delta, classifies the change severity, and estimates
    vegetation loss/gain in percentage of the AOI.

    Args:
        location:  Human-readable location name for labelling.
        aoi:       GEE Geometry representing the Area of Interest.
        year_t1:   Baseline year (e.g. 2018).
        year_t2:   Comparison year (e.g. 2025).
        dataset:   GEE dataset key — 'sentinel2', 'landsat8', 'landsat9'.

    Returns:
        Structured result dict with NDVI_T1, NDVI_T2, delta, severity, and interpretation.
    """
    if not GEE_AVAILABLE:
        return {"error": "GEE not available", "pipeline": "ndvi_change"}

    COLLECTIONS = {
        "sentinel2":  ("COPERNICUS/S2_SR_HARMONIZED", "B8",    "B4",   0.0001,    0.0,  "CLOUDY_PIXEL_PERCENTAGE"),
        "landsat8":   ("LANDSAT/LC08/C02/T1_L2",      "SR_B5", "SR_B4", 0.0000275, -0.2, "CLOUD_COVER"),
        "landsat9":   ("LANDSAT/LC09/C02/T1_L2",      "SR_B5", "SR_B4", 0.0000275, -0.2, "CLOUD_COVER"),
        "modis":      ("MODIS/061/MOD13Q1",           "NDVI",  None,   0.0001,    0.0,  None),
    }

    col_id, nir_band, red_band, scale, offset, cloud_prop = COLLECTIONS.get(
        dataset, COLLECTIONS["sentinel2"]
    )

    def _get_ndvi_mean(year: int) -> Optional[float]:
        col = (
            ee.ImageCollection(col_id)
            .filterBounds(aoi)
            .filterDate(f"{year}-01-01", f"{year}-12-31")
        )
        if cloud_prop:
            col = col.filter(ee.Filter.lt(cloud_prop, 30))

        if col.size().getInfo() == 0:
            return None

        if dataset == "modis":
            # MODIS has pre-computed NDVI band
            img = col.mean().multiply(scale)
            stats = img.select("NDVI").reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=aoi,
                scale=250,
                maxPixels=1e9,
            ).getInfo()
            return stats.get("NDVI")
        else:
            # Calibrate surface reflectance with scale and offset (USGS Landsat Collection 2 formula)
            img = col.median().multiply(scale).add(offset)
            ndvi = img.normalizedDifference([nir_band, red_band]).rename("NDVI")
            stats = ndvi.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=aoi,
                scale=30,
                maxPixels=1e9,
            ).getInfo()
            return stats.get("NDVI")

    ndvi_t1 = _get_ndvi_mean(year_t1)
    ndvi_t2 = _get_ndvi_mean(year_t2)

    if ndvi_t1 is None or ndvi_t2 is None:
        return {
            "pipeline": "ndvi_change",
            "location": location,
            "ndvi_t1": ndvi_t1,
            "ndvi_t2": ndvi_t2,
            "delta": None,
            "error": "Insufficient imagery for one or both periods",
        }

    delta = round(ndvi_t2 - ndvi_t1, 4)
    delta_pct = round((delta / max(abs(ndvi_t1), 0.01)) * 100, 2)

    # Classify change severity
    if delta < -0.25:
        severity = "CRITICAL"
        interpretation = "Severe vegetation loss detected — deforestation, wildfire, or flood damage"
    elif delta < -0.10:
        severity = "HIGH"
        interpretation = "Significant vegetation decline — land clearing, drought stress, or crop failure"
    elif delta < -0.05:
        severity = "MODERATE"
        interpretation = "Moderate vegetation reduction — seasonal drought or localized disturbance"
    elif delta > 0.10:
        severity = "IMPROVEMENT"
        interpretation = "Vegetation growth detected — reforestation, irrigation, or post-disaster recovery"
    else:
        severity = "STABLE"
        interpretation = "Vegetation cover largely stable over the observed period"

    return {
        "pipeline": "ndvi_change",
        "location": location,
        "dataset": col_id,
        "year_t1": year_t1,
        "year_t2": year_t2,
        "ndvi_t1": round(ndvi_t1, 4),
        "ndvi_t2": round(ndvi_t2, 4),
        "delta_absolute": delta,
        "delta_percent": delta_pct,
        "change_severity": severity,
        "interpretation": interpretation,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. NDWI Flood Detection Pipeline  (Surface Water & Flood Inundation)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def run_ndwi_flood_pipeline(
    location: str,
    aoi: "ee.Geometry",
    flood_start: str,
    flood_end: str,
    baseline_year: int = None,
) -> Dict:
    """
    Detect flood extent using Sentinel-2 NDWI (surface water index).
    Compares a flood event period vs. a dry baseline to isolate inundation.

    Pixels where NDWI > 0.2 indicate open water / inundation.

    Args:
        location:       AOI label.
        aoi:            GEE Geometry.
        flood_start:    Flood event start date (YYYY-MM-DD).
        flood_end:      Flood event end date.
        baseline_year:  Optional baseline year for NDWI pre-flood reference.
    """
    if not GEE_AVAILABLE:
        return {"error": "GEE not available", "pipeline": "ndwi_flood"}

    COL_ID = "COPERNICUS/S2_SR_HARMONIZED"
    SCALE  = 0.0001
    GREEN  = "B3"
    NIR    = "B8"

    def _ndwi_mean_and_area(start: str, end: str) -> Tuple[Optional[float], Optional[float]]:
        col = (
            ee.ImageCollection(COL_ID)
            .filterBounds(aoi)
            .filterDate(start, end)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
        )
        if col.size().getInfo() == 0:
            return None, None

        img = col.median().multiply(SCALE)
        ndwi = img.normalizedDifference([GREEN, NIR]).rename("NDWI")

        # Mean NDWI across AOI
        stats = ndwi.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=30,
            maxPixels=1e9,
        ).getInfo()
        mean_ndwi = stats.get("NDWI")

        # Water area: pixels > 0.2 threshold
        water_mask  = ndwi.gt(0.2)
        water_area  = water_mask.multiply(ee.Image.pixelArea().divide(1e6)).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=aoi,
            scale=30,
            maxPixels=1e9,
        ).getInfo()
        area_km2 = water_area.get("NDWI", 0)

        return mean_ndwi, area_km2

    ndwi_flood, water_flood_km2 = _ndwi_mean_and_area(flood_start, flood_end)

    baseline_ndwi = None
    baseline_water_km2 = None
    if baseline_year:
        b_start = f"{baseline_year}-06-01"
        b_end   = f"{baseline_year}-09-30"
        baseline_ndwi, baseline_water_km2 = _ndwi_mean_and_area(b_start, b_end)

    delta_water_km2 = None
    if water_flood_km2 is not None and baseline_water_km2 is not None:
        delta_water_km2 = round(water_flood_km2 - baseline_water_km2, 2)

    # Classify inundation severity
    if water_flood_km2 is None:
        severity = "UNKNOWN"
    elif water_flood_km2 > 500:
        severity = "CATASTROPHIC"
    elif water_flood_km2 > 100:
        severity = "CRITICAL"
    elif water_flood_km2 > 20:
        severity = "HIGH"
    elif water_flood_km2 > 5:
        severity = "MODERATE"
    else:
        severity = "LOW"

    return {
        "pipeline": "ndwi_flood",
        "location": location,
        "flood_period": {"start": flood_start, "end": flood_end},
        "ndwi_flood_mean": round(ndwi_flood, 4) if ndwi_flood is not None else None,
        "water_area_flood_km2": round(water_flood_km2, 2) if water_flood_km2 is not None else None,
        "ndwi_baseline_mean": round(baseline_ndwi, 4) if baseline_ndwi is not None else None,
        "water_area_baseline_km2": round(baseline_water_km2, 2) if baseline_water_km2 is not None else None,
        "incremental_inundation_km2": delta_water_km2,
        "inundation_severity": severity,
        "threshold_used": "NDWI > 0.2",
        "sensor": "Sentinel-2 10m optical",
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. SAR Flood Detection Pipeline  (Cloud-piercing, all-weather)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def run_sar_flood_pipeline(
    location: str,
    aoi: "ee.Geometry",
    flood_start: str,
    flood_end: str,
    baseline_start: str,
    baseline_end: str,
) -> Dict:
    """
    Detect flood inundation using Sentinel-1 SAR (VV polarization).
    SAR works through clouds and is the gold standard for flood mapping.

    Method: Pixels with VV < -15 dB indicate open water.
            Change flood = pixels wet in flood period but dry in baseline.

    Args:
        location:        AOI label.
        aoi:             GEE Geometry.
        flood_start/end: Flood event window.
        baseline_start/end: Pre-flood dry baseline window.
    """
    if not GEE_AVAILABLE:
        return {"error": "GEE not available", "pipeline": "sar_flood"}

    COL_ID    = "COPERNICUS/S1_GRD"
    THRESHOLD = -15  # dB

    def _sar_water_mask(start: str, end: str):
        col = (
            ee.ImageCollection(COL_ID)
            .filterBounds(aoi)
            .filterDate(start, end)
            .filter(ee.Filter.listContains("transmitterReceiverPolarisation", "VV"))
            .filter(ee.Filter.eq("instrumentMode", "IW"))
            .select("VV")
        )
        if col.size().getInfo() == 0:
            return None, None
        # Apply focal median filter (30m circle) for radar speckle suppression
        vv_mean    = col.mean().focal_median(30, "circle", "meters")
        water_mask = vv_mean.lt(THRESHOLD)
        area_km2   = water_mask.multiply(ee.Image.pixelArea().divide(1e6)).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=aoi,
            scale=10,
            maxPixels=1e9,
        ).getInfo().get("VV", 0)
        return water_mask, area_km2

    flood_mask, flood_area   = _sar_water_mask(flood_start, flood_end)
    base_mask,  base_area    = _sar_water_mask(baseline_start, baseline_end)

    if flood_area is None:
        return {
            "pipeline": "sar_flood",
            "location": location,
            "error": "No SAR data available for flood period",
        }

    # True spatial inundation: newly flooded dry ground (wet during flood AND NOT wet in baseline)
    incremental = None
    if flood_mask is not None and base_mask is not None:
        newly_flooded = flood_mask.And(base_mask.Not())
        inc_area = newly_flooded.multiply(ee.Image.pixelArea().divide(1e6)).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=aoi,
            scale=10,
            maxPixels=1e9,
        ).getInfo().get("VV", 0)
        incremental = round(float(inc_area), 2)

    # Classify
    if flood_area > 500:   severity = "CATASTROPHIC"
    elif flood_area > 100: severity = "CRITICAL"
    elif flood_area > 20:  severity = "HIGH"
    elif flood_area > 5:   severity = "MODERATE"
    else:                  severity = "LOW"

    return {
        "pipeline": "sar_flood",
        "location": location,
        "sensor": "Sentinel-1 SAR IW 10m",
        "method": f"VV polarization < {THRESHOLD} dB water mask",
        "flood_period": {"start": flood_start, "end": flood_end},
        "baseline_period": {"start": baseline_start, "end": baseline_end},
        "flood_water_area_km2": round(float(flood_area), 2),
        "baseline_water_area_km2": round(float(base_area), 2) if base_area is not None else None,
        "incremental_flood_km2": incremental,
        "inundation_severity": severity,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. Wildfire & Burn Severity Pipeline  (NBR + FIRMS Integration)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def run_wildfire_pipeline(
    location: str,
    aoi: "ee.Geometry",
    fire_start: str,
    fire_end: str,
    pre_fire_start: str,
    pre_fire_end: str,
) -> Dict:
    """
    Map wildfire burn extent and severity using dNBR (delta Normalized Burn Ratio).

    dNBR = pre_NBR - post_NBR
    Positive dNBR = burned area (higher value = more severe burn).
    Classes: 0.1-0.27=Low, 0.27-0.44=Moderate-low, 0.44-0.66=Moderate-high, >0.66=High

    Uses Landsat 8/9 NIR (B5) and SWIR-2 (B7) bands.

    Args:
        location:         AOI label.
        aoi:              GEE Geometry.
        fire_start/end:   Post-fire observation window.
        pre_fire_start/end: Pre-fire baseline window.
    """
    if not GEE_AVAILABLE:
        return {"error": "GEE not available", "pipeline": "wildfire"}

    COL_ID = "LANDSAT/LC09/C02/T1_L2"
    NIR    = "SR_B5"
    SWIR   = "SR_B7"
    SCALE  = 0.0000275
    OFFSET = -0.2

    def _nbr_mean(start: str, end: str) -> Optional[float]:
        col = (
            ee.ImageCollection(COL_ID)
            .filterBounds(aoi)
            .filterDate(start, end)
            .filter(ee.Filter.lt("CLOUD_COVER", 30))
        )
        if col.size().getInfo() == 0:
            return None
        img  = col.median().multiply(SCALE).add(OFFSET)
        nbr  = img.normalizedDifference([NIR, SWIR]).rename("NBR")
        stats = nbr.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=30,
            maxPixels=1e9,
        ).getInfo()
        return stats.get("NBR")

    # Burned-area extent: dNBR > 0.1
    def _burned_area_km2(pre_start: str, pre_end: str, post_start: str, post_end: str) -> Optional[float]:
        pre_col  = ee.ImageCollection(COL_ID).filterBounds(aoi).filterDate(pre_start, pre_end).filter(ee.Filter.lt("CLOUD_COVER", 30))
        post_col = ee.ImageCollection(COL_ID).filterBounds(aoi).filterDate(post_start, post_end).filter(ee.Filter.lt("CLOUD_COVER", 30))
        if pre_col.size().getInfo() == 0 or post_col.size().getInfo() == 0:
            return None
        pre_img  = pre_col.median().multiply(SCALE).add(OFFSET)
        post_img = post_col.median().multiply(SCALE).add(OFFSET)
        pre_nbr  = pre_img.normalizedDifference([NIR, SWIR]).rename("preNBR")
        post_nbr = post_img.normalizedDifference([NIR, SWIR]).rename("postNBR")
        dnbr     = pre_nbr.subtract(post_nbr).rename("dNBR")
        burned   = dnbr.gt(0.1)
        area_km2 = burned.multiply(ee.Image.pixelArea().divide(1e6)).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=aoi,
            scale=30,
            maxPixels=1e9,
        ).getInfo().get("dNBR", 0)
        return area_km2

    pre_nbr_val  = _nbr_mean(pre_fire_start, pre_fire_end)
    post_nbr_val = _nbr_mean(fire_start, fire_end)

    dnbr = None
    if pre_nbr_val is not None and post_nbr_val is not None:
        dnbr = round(pre_nbr_val - post_nbr_val, 4)

    burned_km2 = _burned_area_km2(pre_fire_start, pre_fire_end, fire_start, fire_end)

    # Burn severity classification (USGS dNBR scale)
    if dnbr is None:
        severity_class = "UNKNOWN"
    elif dnbr > 0.66:
        severity_class = "HIGH SEVERITY"
    elif dnbr > 0.44:
        severity_class = "MODERATE-HIGH SEVERITY"
    elif dnbr > 0.27:
        severity_class = "MODERATE-LOW SEVERITY"
    elif dnbr > 0.10:
        severity_class = "LOW SEVERITY"
    else:
        severity_class = "UNBURNED"

    return {
        "pipeline": "wildfire_nbr",
        "location": location,
        "sensor": "Landsat 9 30m",
        "pre_fire_period": {"start": pre_fire_start, "end": pre_fire_end},
        "post_fire_period": {"start": fire_start, "end": fire_end},
        "pre_nbr": round(pre_nbr_val, 4) if pre_nbr_val is not None else None,
        "post_nbr": round(post_nbr_val, 4) if post_nbr_val is not None else None,
        "dnbr": dnbr,
        "burn_severity_class": severity_class,
        "estimated_burned_area_km2": round(float(burned_km2), 2) if burned_km2 is not None else None,
        "method": "dNBR = preNBR - postNBR (USGS severity classification)",
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. Urban Expansion Pipeline  (ESA WorldCover / Dynamic World LULC)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def run_urban_expansion_pipeline(
    location: str,
    aoi: "ee.Geometry",
    year_t1: int,
    year_t2: int,
) -> Dict:
    """
    Detect and quantify urban expansion using Dynamic World near-real-time
    land cover classification (Google, 10m resolution).

    Computes percentage of AOI classified as 'Built-up' in T1 vs T2.
    Class label 6 = built / urban in Dynamic World schema.

    Args:
        location:  AOI label.
        aoi:       GEE Geometry.
        year_t1:   Baseline year (e.g. 2019).
        year_t2:   Comparison year (e.g. 2025).
    """
    if not GEE_AVAILABLE:
        return {"error": "GEE not available", "pipeline": "urban_expansion"}

    COL_ID        = "GOOGLE/DYNAMICWORLD/V1"
    BUILT_CLASS   = 6   # Dynamic World "built" class label
    SCALE         = 10  # 10m resolution

    def _built_area_km2(year: int) -> Optional[float]:
        col = (
            ee.ImageCollection(COL_ID)
            .filterBounds(aoi)
            .filterDate(f"{year}-01-01", f"{year}-12-31")
            .select("label")
        )
        if col.size().getInfo() == 0:
            return None
        label_img = col.mode()  # Most common label per pixel
        built_mask = label_img.eq(BUILT_CLASS)
        area_km2 = built_mask.multiply(ee.Image.pixelArea().divide(1e6)).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=aoi,
            scale=SCALE,
            maxPixels=1e9,
        ).getInfo().get("label", 0)
        return area_km2

    built_t1 = _built_area_km2(year_t1)
    built_t2 = _built_area_km2(year_t2)

    expansion_km2 = None
    expansion_pct = None
    if built_t1 is not None and built_t2 is not None:
        expansion_km2 = round(float(built_t2) - float(built_t1), 2)
        expansion_pct = round(
            (expansion_km2 / max(float(built_t1), 0.01)) * 100, 2
        )

    if expansion_pct is None:
        severity = "UNKNOWN"
    elif expansion_pct > 100:
        severity = "EXTREME EXPANSION"
    elif expansion_pct > 50:
        severity = "RAPID GROWTH"
    elif expansion_pct > 20:
        severity = "MODERATE GROWTH"
    elif expansion_pct > 5:
        severity = "SLOW GROWTH"
    elif expansion_pct and expansion_pct < -5:
        severity = "URBAN SHRINKAGE"
    else:
        severity = "STABLE"

    return {
        "pipeline": "urban_expansion",
        "location": location,
        "sensor": "Dynamic World 10m (Google)",
        "built_class": "label=6 (Built environment)",
        "year_t1": year_t1,
        "year_t2": year_t2,
        "built_area_t1_km2": round(float(built_t1), 2) if built_t1 is not None else None,
        "built_area_t2_km2": round(float(built_t2), 2) if built_t2 is not None else None,
        "expansion_km2": expansion_km2,
        "expansion_percent": expansion_pct,
        "growth_classification": severity,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. EVI (Enhanced Vegetation Index) Pipeline
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def run_evi_pipeline(
    location: str,
    aoi: "ee.Geometry",
    start_date: str,
    end_date: str,
) -> Dict:
    """
    Compute Enhanced Vegetation Index (EVI) from Sentinel-2 data.

    EVI = 2.5 * (NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1)
    EVI is less susceptible to atmospheric effects and canopy background noise than NDVI.

    Args:
        location:   AOI label.
        aoi:        GEE Geometry.
        start_date: Analysis period start.
        end_date:   Analysis period end.
    """
    if not GEE_AVAILABLE:
        return {"error": "GEE not available", "pipeline": "evi"}

    COL_ID = "COPERNICUS/S2_SR_HARMONIZED"
    SCALE  = 0.0001

    col = (
        ee.ImageCollection(COL_ID)
        .filterBounds(aoi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
    )
    if col.size().getInfo() == 0:
        return {"pipeline": "evi", "location": location, "error": "No imagery found"}

    img = col.median().multiply(SCALE)
    nir  = img.select("B8")
    red  = img.select("B4")
    blue = img.select("B2")

    evi = (
        img.expression(
            "2.5 * (NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1)",
            {"NIR": nir, "RED": red, "BLUE": blue},
        )
        .rename("EVI")
        .clamp(-1, 1)
    )

    stats = evi.reduceRegion(
        reducer=ee.Reducer.mean().combine(ee.Reducer.minMax(), sharedInputs=True),
        geometry=aoi,
        scale=30,
        maxPixels=1e9,
    ).getInfo()

    evi_mean = stats.get("EVI_mean", 0) or 0
    label = (
        "Dense/Healthy Canopy"   if evi_mean > 0.5  else
        "Moderate Vegetation"    if evi_mean > 0.3  else
        "Sparse Vegetation"      if evi_mean > 0.1  else
        "Bare/Degraded Surface"
    )

    return {
        "pipeline": "evi",
        "location": location,
        "period": {"start": start_date, "end": end_date},
        "evi_mean": round(evi_mean, 4),
        "evi_max": round(stats.get("EVI_max", 0) or 0, 4),
        "evi_min": round(stats.get("EVI_min", 0) or 0, 4),
        "vegetation_density_class": label,
        "sensor": "Sentinel-2 10m",
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. SAVI (Soil-Adjusted Vegetation Index) Pipeline  (Arid/Semi-arid)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def run_savi_pipeline(
    location: str,
    aoi: "ee.Geometry",
    start_date: str,
    end_date: str,
    L: float = 0.5,
) -> Dict:
    """
    Compute Soil-Adjusted Vegetation Index (SAVI) from Sentinel-2 data.
    SAVI = (NIR - RED) * (1 + L) / (NIR + RED + L)
    Optimal for sparse vegetation in dryland/semi-arid environments.

    Args:
        L: Soil brightness correction factor (0=dense canopy, 1=bare soil, 0.5=default).
    """
    if not GEE_AVAILABLE:
        return {"error": "GEE not available", "pipeline": "savi"}

    COL_ID = "COPERNICUS/S2_SR_HARMONIZED"
    SCALE  = 0.0001

    col = (
        ee.ImageCollection(COL_ID)
        .filterBounds(aoi)
        .filterDate(start_date, end_date)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
    )
    if col.size().getInfo() == 0:
        return {"pipeline": "savi", "location": location, "error": "No imagery found"}

    img = col.median().multiply(SCALE)
    nir = img.select("B8")
    red = img.select("B4")

    savi = (
        img.expression(
            "(NIR - RED) * (1 + L) / (NIR + RED + L)",
            {"NIR": nir, "RED": red, "L": L},
        )
        .rename("SAVI")
        .clamp(-1, 1)
    )

    stats = savi.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=aoi,
        scale=30,
        maxPixels=1e9,
    ).getInfo()

    savi_mean = stats.get("SAVI", 0) or 0

    return {
        "pipeline": "savi",
        "location": location,
        "period": {"start": start_date, "end": end_date},
        "soil_brightness_factor_L": L,
        "savi_mean": round(savi_mean, 4),
        "vegetation_stress_class": (
            "Good Coverage"   if savi_mean > 0.45 else
            "Moderate"        if savi_mean > 0.25 else
            "Sparse/Stressed" if savi_mean > 0.1  else
            "Barren"
        ),
        "sensor": "Sentinel-2 10m",
        "note": "SAVI is optimal for arid and semi-arid regions with low vegetation cover",
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 8. Comprehensive Change Vector Analysis (CVA)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def run_change_vector_analysis(
    location: str,
    aoi: "ee.Geometry",
    year_t1: int,
    year_t2: int,
) -> Dict:
    """
    Run a full Change Vector Analysis (CVA) over an AOI for two epochs.
    Computes and reports changes across NDVI, NDWI, urban footprint, and EVI
    simultaneously, providing a multi-index cross-validated change assessment.

    This is the master pipeline called by the TimeLens Engine for comprehensive
    temporal analysis.

    Args:
        location: Human-readable location label.
        aoi:      GEE Geometry (Area of Interest).
        year_t1:  Baseline year.
        year_t2:  Comparison year.

    Returns:
        Consolidated CVA result dict with cross-index change vectors.
    """
    if not GEE_AVAILABLE:
        return {"error": "GEE not available", "pipeline": "cva"}

    # --- Run all sub-pipelines ---
    ndvi_result  = run_ndvi_change_pipeline(location, aoi, year_t1, year_t2)
    urban_result = run_urban_expansion_pipeline(location, aoi, year_t1, year_t2)

    # EVI for current period
    evi_t2 = run_evi_pipeline(
        location, aoi,
        f"{year_t2}-01-01", f"{year_t2}-12-31",
    )

    # --- Synthesize overall change assessment ---
    critical_flags = []
    if ndvi_result.get("change_severity") in ("CRITICAL", "HIGH"):
        critical_flags.append(f"Vegetation Loss: {ndvi_result.get('delta_percent', '?')}%")
    if urban_result.get("growth_classification") in ("RAPID GROWTH", "EXTREME EXPANSION"):
        critical_flags.append(f"Urban Sprawl: +{urban_result.get('expansion_km2', '?')} km2")

    overall_risk = "HIGH" if len(critical_flags) > 1 else ("MODERATE" if critical_flags else "LOW")

    return {
        "pipeline": "change_vector_analysis",
        "location": location,
        "temporal_span": f"{year_t1} to {year_t2}",
        "ndvi_change": ndvi_result,
        "urban_expansion": urban_result,
        "evi_current": evi_t2,
        "critical_flags": critical_flags,
        "overall_risk_level": overall_risk,
        "summary": (
            f"CVA for {location} ({year_t1}-{year_t2}): "
            f"Vegetation {ndvi_result.get('change_severity','?')}, "
            f"Urban {urban_result.get('growth_classification','?')}, "
            f"EVI={evi_t2.get('evi_mean','?')}. "
            f"Risk Level: {overall_risk}."
        ),
    }
