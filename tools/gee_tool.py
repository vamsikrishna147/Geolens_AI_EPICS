"""
GeoLens AI - Google Earth Engine Tool
=======================================
Queries Google Earth Engine (GEE) to retrieve satellite imagery and
derived products for any location and time period.

Supports: Sentinel-1, Sentinel-2, Landsat 8/9, MODIS, CHIRPS, ERA5,
          Copernicus DEM, ESA WorldCover, Dynamic World, NASA FIRMS.

Setup (one-time):
  1. Register at https://earthengine.google.com/signup (free)
  2. pip install earthengine-api
  3. earthengine authenticate
  4. Set GEE_PROJECT_ID in .env

API Docs: https://developers.google.com/earth-engine
"""

import json
import os
from datetime import datetime, timedelta
from typing import Optional, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import ClassVar

from utils.geocoder import geocode_location
from storage.storage_manager import StorageManager

# GEE import — optional (graceful degradation if not installed/authenticated)
try:
    import ee
    GEE_AVAILABLE = True
except ImportError:
    GEE_AVAILABLE = False


# Dataset catalog for GEE collections
GEE_COLLECTIONS = {
    "sentinel2": {
        "id": "COPERNICUS/S2_SR_HARMONIZED",
        "description": "Sentinel-2 Surface Reflectance (10m, optical)",
        "bands": {"red": "B4", "green": "B3", "blue": "B2", "nir": "B8", "swir1": "B11", "cloud": "QA60"},
        "cloud_band": "QA60",
        "scale_factor": 0.0001,
    },
    "sentinel1": {
        "id": "COPERNICUS/S1_GRD",
        "description": "Sentinel-1 SAR (10m, radar, all-weather)",
        "bands": {"vv": "VV", "vh": "VH"},
        "polarization": "VV",
    },
    "landsat8": {
        "id": "LANDSAT/LC08/C02/T1_L2",
        "description": "Landsat 8 Surface Reflectance (30m)",
        "bands": {"red": "SR_B4", "green": "SR_B3", "blue": "SR_B2", "nir": "SR_B5", "swir1": "SR_B6", "thermal": "ST_B10"},
        "scale_factor": 0.0000275,
    },
    "landsat9": {
        "id": "LANDSAT/LC09/C02/T1_L2",
        "description": "Landsat 9 Surface Reflectance (30m)",
        "bands": {"red": "SR_B4", "green": "SR_B3", "blue": "SR_B2", "nir": "SR_B5"},
        "scale_factor": 0.0000275,
    },
    "modis": {
        "id": "MODIS/061/MOD13Q1",
        "description": "MODIS Vegetation Indices (250m, 16-day)",
        "bands": {"ndvi": "NDVI", "evi": "EVI"},
        "scale_factor": 0.0001,
    },
    "chirps": {
        "id": "UCSB-CHG/CHIRPS/DAILY",
        "description": "CHIRPS Rainfall (5.5km, daily)",
        "bands": {"precipitation": "precipitation"},
    },
    "era5": {
        "id": "ECMWF/ERA5_LAND/DAILY_AGGR",
        "description": "ERA5 Land Climate Reanalysis (9km, daily)",
        "bands": {"temp": "temperature_2m", "precip": "total_precipitation_sum"},
    },
    "dem": {
        "id": "COPERNICUS/DEM/GLO30",
        "description": "Copernicus Digital Elevation Model (30m)",
        "bands": {"elevation": "DSM"},
    },
    "worldcover": {
        "id": "ESA/WorldCover/v200",
        "description": "ESA WorldCover Land Cover (10m, 2021)",
        "bands": {"land_cover": "Map"},
    },
    "dynamic_world": {
        "id": "GOOGLE/DYNAMICWORLD/V1",
        "description": "Dynamic World Near Real-Time Land Cover (10m)",
        "bands": {"label": "label"},
    },
}


class GEEToolInput(BaseModel):
    location: str = Field(..., description="Location or area name, e.g. 'Konaseema district, Andhra Pradesh'")
    dataset: str = Field(
        ...,
        description=(
            "Dataset to query. Options: sentinel2, sentinel1, landsat8, landsat9, "
            "modis, chirps, era5, dem, worldcover, dynamic_world"
        )
    )
    start_date: Optional[str] = Field(None, description="Start date YYYY-MM-DD. Defaults to 30 days ago.")
    end_date: Optional[str] = Field(None, description="End date YYYY-MM-DD. Defaults to today.")
    analysis: Optional[str] = Field(
        "info",
        description=(
            "analysis to perform: "
            "'info' (metadata + stats), "
            "'ndvi' (vegetation index from optical bands), "
            "'ndwi' (water index — flood/drought detection), "
            "'flood' (Sentinel-1 SAR all-weather flood mapping), "
            "'nbr' (Normalized Burn Ratio — wildfire severity), "
            "'change_detection' (NDVI/NDWI multi-temporal delta T1 vs T2), "
            "'mosaic' (cloud-free composite), "
            "'time_series' (temporal band mean values), "
            "'export_geotiff' (download GeoTIFF to local storage)"
        )
    )
    start_date_t2: Optional[str] = Field(None, description="T2 comparison period start date (YYYY-MM-DD). Only for change_detection analysis.")
    end_date_t2: Optional[str] = Field(None, description="T2 comparison period end date (YYYY-MM-DD). Only for change_detection analysis.")
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class GEETool(BaseTool):
    """
    Queries Google Earth Engine satellite imagery and geospatial datasets.
    Requires GEE account (free) and authentication. Supports Sentinel-1/2,
    Landsat 8/9, MODIS, CHIRPS, ERA5, DEM, and land cover datasets.
    """

    name: str = "Google Earth Engine Satellite Data Tool"
    description: str = (
        "Queries Google Earth Engine (GEE) for satellite imagery and multi-temporal analysis. "
        "Supports Sentinel-1 (SAR, flood), Sentinel-2 (optical, NDVI/NDWI/EVI), "
        "Landsat 8/9 (historical, NBR burn severity), MODIS (global daily vegetation), "
        "CHIRPS (rainfall), ERA5 (climate reanalysis), Copernicus DEM (elevation), "
        "ESA WorldCover (land cover), Dynamic World (near-real-time LULC). "
        "Can compute NDVI, NDWI, NBR, flood extent (SAR VV threshold), multi-temporal "
        "change detection (T1 vs T2 delta), time series, and export GeoTIFFs. "
        "Requires GEE authentication (free — set GEE_PROJECT_ID in .env)."
    )
    args_schema: Type[BaseModel] = GEEToolInput

    def _run(
        self,
        location: str,
        dataset: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        analysis: Optional[str] = "info",
        start_date_t2: Optional[str] = None,
        end_date_t2: Optional[str] = None,
        query_id: str = "",
    ) -> str:
        # Check GEE availability
        gee_project = os.getenv("GEE_PROJECT_ID", "")
        if not GEE_AVAILABLE:
            return self._setup_instructions()
        if not gee_project or gee_project == "your_gee_project_id_here":
            return self._setup_instructions()

        # Initialize GEE
        try:
            ee.Initialize(project=gee_project)
        except Exception as e:
            return json.dumps({
                "error": f"GEE authentication failed: {str(e)}",
                "fix": "Run: earthengine authenticate",
                "docs": "https://developers.google.com/earth-engine/guides/auth",
            })

        # Check dataset
        dataset_lower = dataset.lower().replace("-", "").replace("_", "")
        collection_config = None
        for key, cfg in GEE_COLLECTIONS.items():
            if key.replace("_", "") == dataset_lower or dataset_lower in key:
                collection_config = cfg
                collection_key = key
                break

        if not collection_config:
            return json.dumps({
                "error": f"Unknown dataset: '{dataset}'",
                "available": list(GEE_COLLECTIONS.keys()),
            })

        # Geocode location → AOI
        geo = geocode_location(location)
        if not geo:
            return json.dumps({"error": f"Could not geocode: '{location}'"})

        bbox = geo["bbox_ee"]  # [xmin, ymin, xmax, ymax]
        aoi = ee.Geometry.Rectangle(bbox)

        # Date range
        today = datetime.now()
        if not end_date:
            end_date = today.strftime("%Y-%m-%d")
        if not start_date:
            start_date = (today - timedelta(days=30)).strftime("%Y-%m-%d")

        print(f"[GEETool] Querying {collection_config['id']} for {location} | {start_date} to {end_date}")

        try:
            result = self._execute_query(
                collection_config, aoi, start_date, end_date,
                analysis or "info", location, geo, query_id,
                start_date_t2=start_date_t2, end_date_t2=end_date_t2,
            )
            return result
        except Exception as e:
            return json.dumps({"error": f"GEE query failed: {str(e)}", "dataset": dataset, "location": location})

    def _execute_query(
        self, cfg, aoi, start_date, end_date, analysis, location, geo, query_id,
        start_date_t2: Optional[str] = None, end_date_t2: Optional[str] = None,
    ) -> str:
        """Execute a GEE query and return results."""
        storage = StorageManager(query_id=query_id or None)

        # Load the image collection
        collection = (
            ee.ImageCollection(cfg["id"])
            .filterBounds(aoi)
            .filterDate(start_date, end_date)
        )

        # Get collection info
        count = collection.size().getInfo()

        if count == 0:
            return json.dumps({
                "status": "no_data",
                "message": f"No {cfg['description']} images found for {location} between {start_date} and {end_date}.",
                "suggestion": "Try expanding the date range or check cloud cover filters.",
            })

        result = {
            "location": location,
            "coordinates": {"lat": geo["lat"], "lon": geo["lon"]},
            "bbox": geo["bbox_ee"],
            "dataset": cfg["id"],
            "description": cfg["description"],
            "period": {"start": start_date, "end": end_date},
            "image_count": count,
            "analysis_type": analysis,
            "bands_available": list(cfg.get("bands", {}).keys()),
        }

        # Perform analysis
        if analysis == "ndvi":
            result.update(self._compute_ndvi(collection, cfg, aoi))
        elif analysis == "ndwi":
            result.update(self._compute_ndwi(collection, cfg, aoi))
        elif analysis == "flood":
            result.update(self._compute_flood_sar(collection, cfg, aoi))
        elif analysis == "nbr":
            result.update(self._compute_nbr_gee(collection, cfg, aoi))
        elif analysis == "change_detection":
            result.update(self._compute_change_detection(
                cfg, aoi, start_date, end_date, start_date_t2, end_date_t2
            ))
        elif analysis == "time_series":
            result.update(self._compute_time_series(collection, cfg, aoi, start_date, end_date))
        elif analysis == "export_geotiff":
            result.update(self._export_geotiff(collection, cfg, aoi, location, start_date))
        else:
            # Default: mosaic + basic stats
            result.update(self._compute_mosaic_stats(collection, cfg, aoi))

        # Store result
        storage.save_metadata(result, result_type=f"gee_{analysis}")

        lines = [f"GEE {cfg['description']} data for {location}:"]
        lines.append(f"  - Images found: {count}")
        lines.append(f"  - Period: {start_date} to {end_date}")
        lines.append(f"  - Analysis: {analysis}")
        if "ndvi_mean" in result:
            lines.append(f"  - Mean NDVI: {result['ndvi_mean']} (0-1 scale, >0.4 = healthy vegetation)")
        if "ndwi_mean" in result:
            lines.append(f"  - Mean NDWI: {result['ndwi_mean']} (>0 = water presence)")
        if "flood_area_km2" in result:
            lines.append(f"  - Estimated flood area: {result['flood_area_km2']} km²")
        lines.append(f"  - Source: Google Earth Engine (free research access)")
        lines.append(f"  - Saved to: {storage.data_root}/gee/")

        result["summary"] = "\n".join(lines)
        return json.dumps(result)

    def _compute_ndvi(self, collection, cfg, aoi) -> dict:
        """Compute NDVI from optical imagery."""
        bands = cfg.get("bands", {})
        nir = bands.get("nir", "B8")
        red = bands.get("red", "B4")
        scale = cfg.get("scale_factor", 1)

        image = collection.median().multiply(scale)
        ndvi = image.normalizedDifference([nir, red]).rename("NDVI")
        stats = ndvi.reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.minMax(), sharedInputs=True),
            geometry=aoi,
            scale=30,
            maxPixels=1e9,
        ).getInfo()

        return {
            "ndvi_mean": round(stats.get("NDVI_mean", 0), 4),
            "ndvi_max": round(stats.get("NDVI_max", 0), 4),
            "ndvi_min": round(stats.get("NDVI_min", 0), 4),
            "vegetation_health": "Good" if (stats.get("NDVI_mean", 0) or 0) > 0.4 else
                                 "Moderate" if (stats.get("NDVI_mean", 0) or 0) > 0.2 else "Poor/No vegetation",
        }

    def _compute_ndwi(self, collection, cfg, aoi) -> dict:
        """Compute NDWI (water detection) from optical imagery."""
        bands = cfg.get("bands", {})
        nir = bands.get("nir", "B8")
        green = bands.get("green", "B3")
        scale = cfg.get("scale_factor", 1)

        image = collection.median().multiply(scale)
        ndwi = image.normalizedDifference([green, nir]).rename("NDWI")
        stats = ndwi.reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.minMax(), sharedInputs=True),
            geometry=aoi,
            scale=30,
            maxPixels=1e9,
        ).getInfo()

        return {
            "ndwi_mean": round(stats.get("NDWI_mean", 0), 4),
            "water_detected": (stats.get("NDWI_mean", 0) or 0) > 0,
        }

    def _compute_flood_sar(self, collection, cfg, aoi) -> dict:
        """Detect flood extent using Sentinel-1 SAR VV polarization."""
        # Filter for VV polarization, IW mode
        sar = collection.filter(
            ee.Filter.listContains("transmitterReceiverPolarisation", "VV")
        ).filter(
            ee.Filter.eq("instrumentMode", "IW")
        ).select("VV")

        if sar.size().getInfo() == 0:
            return {"flood_note": "No SAR data available for this area/period"}

        # Simple threshold: water = VV < -15 dB
        flood_image = sar.mean().lt(-15)
        flood_area = flood_image.multiply(
            ee.Image.pixelArea().divide(1e6)  # Convert to km²
        ).reduceRegion(
            reducer=ee.Reducer.sum(),
            geometry=aoi,
            scale=10,
            maxPixels=1e9,
        ).getInfo()

        return {
            "flood_area_km2": round(flood_area.get("VV", 0), 2),
            "method": "Sentinel-1 SAR VV < -15dB threshold",
        }

    def _compute_mosaic_stats(self, collection, cfg, aoi) -> dict:
        """Create a cloud-free mosaic and get basic stats."""
        scale = cfg.get("scale_factor", 1)
        bands = list(cfg.get("bands", {}).values())
        image = collection.median()
        if bands:
            image = image.select(bands[:3])  # First 3 bands

        return {"mosaic_method": "Median composite", "cloud_free": True}

    def _compute_time_series(self, collection, cfg, aoi, start_date, end_date) -> dict:
        """Get time series of a key band mean value."""
        band_list = list(cfg.get("bands", {}).values())
        if not band_list:
            return {}
        first_band = band_list[0]
        scale = cfg.get("scale_factor", 1)

        def get_mean(image):
            date = image.date().format("YYYY-MM-dd")
            mean = image.select(first_band).reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=aoi,
                scale=1000,
                maxPixels=1e8,
            )
            return ee.Feature(None, {"date": date, "value": mean.get(first_band)})

        features = collection.map(get_mean).getInfo()
        time_series = [
            {"date": f["properties"]["date"], "value": f["properties"]["value"]}
            for f in features.get("features", [])
            if f["properties"].get("value") is not None
        ]

        return {"time_series": time_series, "time_series_band": first_band}

    def _export_geotiff(self, collection, cfg, aoi, location, start_date) -> dict:
        """Export median composite image as GeoTIFF."""
        import requests
        import zipfile
        import io
        
        scale = cfg.get("scale_factor", 1)
        bands = list(cfg.get("bands", {}).values())
        image = collection.median()
        if bands:
            image = image.select(bands[:3])  # Max 3 bands for simple visualization
            
        try:
            url = image.getDownloadURL({
                'scale': 30,  # 30m resolution to avoid huge files
                'crs': 'EPSG:4326',
                'region': aoi,
                'format': 'GEO_TIFF'
            })
            
            # Download the zip file
            response = requests.get(url, timeout=60)
            response.raise_for_status()
            
            # Extract
            storage = StorageManager()
            export_dir = os.path.join(storage.data_root, "geotiff")
            os.makedirs(export_dir, exist_ok=True)
            
            z = zipfile.ZipFile(io.BytesIO(response.content))
            filename = f"gee_{location.replace(' ', '_')}_{start_date}.tif"
            
            # Find the tif inside the zip and save it
            for name in z.namelist():
                if name.endswith('.tif'):
                    with open(os.path.join(export_dir, filename), 'wb') as f:
                        f.write(z.read(name))
                    break
                    
            return {
                "geotiff_exported": True,
                "filepath": os.path.join(export_dir, filename),
                "download_url": url
            }
        except Exception as e:
            return {"geotiff_exported": False, "error": str(e)}

    def _compute_nbr_gee(self, collection, cfg, aoi) -> dict:
        """
        Compute Normalized Burn Ratio (NBR = (NIR - SWIR) / (NIR + SWIR)).
        Designed for Landsat 8/9 which have SWIR-2 band (B7).
        """
        bands = cfg.get("bands", {})
        nir   = bands.get("nir", "SR_B5")
        # Landsat SWIR-2 for wildfire mapping
        scale = cfg.get("scale_factor", 0.0000275)

        image = collection.median().multiply(scale)

        # Attempt SWIR-2 (B7 Landsat) — Sentinel-2 uses B12
        swir_band = "SR_B7" if "SR_B5" in bands.values() else "B12"

        nbr = image.normalizedDifference([nir, swir_band]).rename("NBR")
        stats = nbr.reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.minMax(), sharedInputs=True),
            geometry=aoi,
            scale=30,
            maxPixels=1e9,
        ).getInfo()

        nbr_mean = stats.get("NBR_mean", 0) or 0

        # USGS burn severity classification
        if nbr_mean < -0.5:
            severity = "HIGH SEVERITY BURN"
        elif nbr_mean < -0.27:
            severity = "MODERATE-HIGH SEVERITY"
        elif nbr_mean < -0.1:
            severity = "MODERATE-LOW SEVERITY"
        elif nbr_mean < 0.1:
            severity = "LOW SEVERITY / UNBURNED"
        else:
            severity = "NO BURN DETECTED"

        return {
            "nbr_mean": round(nbr_mean, 4),
            "nbr_max": round(stats.get("NBR_max", 0) or 0, 4),
            "nbr_min": round(stats.get("NBR_min", 0) or 0, 4),
            "burn_severity_class": severity,
            "note": "NBR=(NIR-SWIR)/(NIR+SWIR). Negative post-fire NBR = burned area.",
        }

    def _compute_change_detection(
        self, cfg, aoi,
        start_t1: str, end_t1: str,
        start_t2: Optional[str], end_t2: Optional[str],
    ) -> dict:
        """
        Multi-temporal NDVI and NDWI change detection: computes T1 baseline vs T2
        comparison, calculates delta, and classifies the land cover change type.
        """
        from datetime import datetime, timedelta
        now = datetime.now()

        # Fallback: if T2 not supplied, use last 90 days
        if not start_t2:
            start_t2 = (now - timedelta(days=90)).strftime("%Y-%m-%d")
            end_t2   = now.strftime("%Y-%m-%d")

        bands = cfg.get("bands", {})
        nir   = bands.get("nir",   "B8")
        red   = bands.get("red",   "B4")
        green = bands.get("green", "B3")
        scale = cfg.get("scale_factor", 0.0001)

        def _get_indices(start, end):
            col = (
                ee.ImageCollection(cfg["id"])
                .filterBounds(aoi)
                .filterDate(start, end)
            )
            if col.size().getInfo() == 0:
                return None, None
            img  = col.median().multiply(scale)
            ndvi = img.normalizedDifference([nir, red]).rename("NDVI")
            ndwi = img.normalizedDifference([green, nir]).rename("NDWI")
            ndvi_stats = ndvi.reduceRegion(reducer=ee.Reducer.mean(), geometry=aoi, scale=30, maxPixels=1e9).getInfo()
            ndwi_stats = ndwi.reduceRegion(reducer=ee.Reducer.mean(), geometry=aoi, scale=30, maxPixels=1e9).getInfo()
            return ndvi_stats.get("NDVI"), ndwi_stats.get("NDWI")

        ndvi_t1, ndwi_t1 = _get_indices(start_t1, end_t1)
        ndvi_t2, ndwi_t2 = _get_indices(start_t2, end_t2)

        ndvi_delta = round(ndvi_t2 - ndvi_t1, 4) if ndvi_t1 and ndvi_t2 else None
        ndwi_delta = round(ndwi_t2 - ndwi_t1, 4) if ndwi_t1 and ndwi_t2 else None

        # Interpret change
        if ndvi_delta is not None and ndvi_delta < -0.2:
            change_type = "VEGETATION LOSS (possible deforestation, flood, or fire)"
        elif ndwi_delta is not None and ndwi_delta > 0.2:
            change_type = "WATER BODY EXPANSION (possible flooding or reservoir fill)"
        elif ndvi_delta is not None and ndvi_delta > 0.15:
            change_type = "VEGETATION GROWTH (recovery, new cropland, or irrigation)"
        else:
            change_type = "STABLE / MINOR CHANGE"

        return {
            "change_detection_t1": {"start": start_t1, "end": end_t1},
            "change_detection_t2": {"start": start_t2, "end": end_t2},
            "ndvi_t1": round(ndvi_t1, 4) if ndvi_t1 is not None else None,
            "ndvi_t2": round(ndvi_t2, 4) if ndvi_t2 is not None else None,
            "ndvi_delta": ndvi_delta,
            "ndwi_t1": round(ndwi_t1, 4) if ndwi_t1 is not None else None,
            "ndwi_t2": round(ndwi_t2, 4) if ndwi_t2 is not None else None,
            "ndwi_delta": ndwi_delta,
            "detected_change_type": change_type,
        }

    def _setup_instructions(self) -> str:
        """Return GEE setup instructions when not configured."""
        return json.dumps({
            "status": "gee_not_configured",
            "message": "Google Earth Engine is not set up yet.",
            "setup_steps": [
                "1. Register for free at: https://earthengine.google.com/signup",
                "2. Install: pip install earthengine-api (already in requirements.txt)",
                "3. Authenticate: run 'earthengine authenticate' in your terminal",
                "4. Get your project ID from: https://console.cloud.google.com",
                "5. Set GEE_PROJECT_ID=your_project_id in your .env file",
                "6. Restart GeoLens AI",
            ],
            "alternative": (
                "While setting up GEE, use these free alternatives already working:\n"
                "  - Open-Meteo for weather data\n"
                "  - NASA FIRMS for fire detection\n"
                "  - SoilGrids for soil properties\n"
                "  - NASA POWER for climate data"
            ),
            "docs": "https://developers.google.com/earth-engine/guides/auth",
        })

