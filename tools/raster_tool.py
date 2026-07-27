"""
GeoLens AI - Raster Processing Tool
======================================
CrewAI tool wrapper for raster GIS operations: clip, zonal stats,
band math (NDVI/NDWI), and raster info using Rasterio & NumPy.
"""

import json
import os
from typing import Optional, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from storage.storage_manager import StorageManager


class RasterToolInput(BaseModel):
    operation: str = Field(
        ...,
        description=(
            "The raster GIS operation to perform. Options: "
            "'clip' (clip raster to polygon boundary), "
            "'zonal_stats' (calculate statistics within polygon zones), "
            "'ndvi' (compute NDVI from red+nir bands), "
            "'ndwi' (compute NDWI from green+nir bands), "
            "'info' (get raster metadata)"
        )
    )
    raster_path: str = Field(
        ...,
        description="Path to input GeoTIFF raster file."
    )
    raster_path_2: Optional[str] = Field(
        None,
        description="Path to second raster (NIR band for ndvi/ndwi operations)."
    )
    boundary_path: Optional[str] = Field(
        None,
        description="Path to GeoJSON/Shapefile boundary for 'clip' and 'zonal_stats' operations."
    )
    output_path: Optional[str] = Field(
        None,
        description="Optional output file path. Auto-generated if not provided."
    )
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class RasterTool(BaseTool):
    """
    Performs raster GIS operations: clipping to boundaries, computing zonal
    statistics, calculating vegetation/water indices, and reading metadata.
    """

    name: str = "Raster GIS Processing Tool"
    description: str = (
        "Performs raster geospatial operations on GeoTIFF satellite imagery. "
        "Can clip a raster to a district/state boundary, calculate statistics "
        "(mean NDVI, max elevation) within polygon zones, compute NDVI/NDWI "
        "indices from raw bands, and inspect raster metadata. "
        "Input must be GeoTIFF (.tif) files."
    )
    args_schema: Type[BaseModel] = RasterToolInput

    def _run(
        self,
        operation: str,
        raster_path: str,
        raster_path_2: Optional[str] = None,
        boundary_path: Optional[str] = None,
        output_path: Optional[str] = None,
        query_id: str = "",
    ) -> str:
        from utils.raster_ops import (
            clip_raster_to_boundary,
            zonal_statistics,
            compute_ndvi,
            compute_ndwi,
            raster_info,
            compute_raster_difference,
            compute_nbr,
            compute_land_cover_transition,
        )

        storage = StorageManager(query_id=query_id or None)
        gis_dir = os.path.join(storage.data_root, "gis_output")
        os.makedirs(gis_dir, exist_ok=True)

        print(f"[RasterTool] Operation: {operation} | Input: {raster_path}")

        op = operation.lower().strip()

        try:
            if op == "clip":
                if not boundary_path:
                    return json.dumps({"error": "clip requires boundary_path (GeoJSON/Shapefile)"})
                import geopandas as gpd
                boundary_gdf = gpd.read_file(boundary_path)
                out = output_path or os.path.join(gis_dir, "clipped.tif")
                result_path = clip_raster_to_boundary(raster_path, boundary_gdf, output_path=out)
                summary = f"Clipped raster to boundary. Output: {result_path}"
                result = {"output_path": result_path, "summary": summary}

            elif op == "zonal_stats":
                if not boundary_path:
                    return json.dumps({"error": "zonal_stats requires boundary_path"})
                import geopandas as gpd
                zones_gdf = gpd.read_file(boundary_path)
                result_gdf = zonal_statistics(raster_path, zones_gdf)
                out = output_path or os.path.join(gis_dir, "zonal_stats.geojson")
                result_gdf.to_file(out, driver="GeoJSON")
                stat_cols = [c for c in result_gdf.columns if c.startswith("raster_")]
                stats_summary = {}
                for col in stat_cols:
                    stats_summary[col] = round(result_gdf[col].mean(), 4)
                summary = f"Zonal statistics computed for {len(zones_gdf)} zones. Stats: {stats_summary}. Saved to {out}"
                result = {"output_path": out, "statistics": stats_summary, "summary": summary}

            elif op == "ndvi":
                if not raster_path_2:
                    return json.dumps({"error": "ndvi requires raster_path (RED band) and raster_path_2 (NIR band)"})
                out = output_path or os.path.join(gis_dir, "ndvi.tif")
                result_path = compute_ndvi(raster_path, raster_path_2, output_path=out)
                summary = f"NDVI computed from RED + NIR bands. Output: {result_path}"
                result = {"output_path": result_path, "summary": summary}

            elif op == "ndwi":
                if not raster_path_2:
                    return json.dumps({"error": "ndwi requires raster_path (GREEN band) and raster_path_2 (NIR band)"})
                out = output_path or os.path.join(gis_dir, "ndwi.tif")
                result_path = compute_ndwi(raster_path, raster_path_2, output_path=out)
                summary = f"NDWI computed from GREEN + NIR bands. Output: {result_path}"
                result = {"output_path": result_path, "summary": summary}

            elif op in ["difference", "delta"]:
                if not raster_path_2:
                    return json.dumps({"error": "difference requires raster_path (T1) and raster_path_2 (T2)"})
                out = output_path or os.path.join(gis_dir, "delta.tif")
                diff_res = compute_raster_difference(raster_path, raster_path_2, output_path=out)
                summary = f"Multi-temporal difference computed. Mean Delta: {diff_res['mean_delta']}, Changed: {diff_res['significant_change_pct']}%"
                result = diff_res

            elif op == "nbr":
                if not raster_path_2:
                    return json.dumps({"error": "nbr requires raster_path (NIR band) and raster_path_2 (SWIR band)"})
                out = output_path or os.path.join(gis_dir, "nbr.tif")
                result_path = compute_nbr(raster_path, raster_path_2, output_path=out)
                summary = f"NBR Normalized Burn Ratio computed. Output: {result_path}"
                result = {"output_path": result_path, "summary": summary}

            elif op == "transition_matrix":
                if not raster_path_2:
                    return json.dumps({"error": "transition_matrix requires raster_path (LandCover T1) and raster_path_2 (LandCover T2)"})
                trans_res = compute_land_cover_transition(raster_path, raster_path_2)
                summary = f"Land cover transition matrix computed for {trans_res['total_transitions']} class pairs."
                result = trans_res

            elif op == "info":
                info = raster_info(raster_path)
                summary = (
                    f"Raster info for {raster_path}:\n"
                    f"  CRS: {info.get('crs')}\n"
                    f"  Size: {info.get('width')}x{info.get('height')}\n"
                    f"  Bands: {info.get('band_count')}\n"
                    f"  Resolution: {info.get('resolution')}\n"
                    f"  Bounds: {info.get('bounds')}"
                )
                result = {"raster_info": info, "summary": summary}

            else:
                return json.dumps({"error": f"Unknown operation: '{operation}'. Use: clip, zonal_stats, ndvi, ndwi, difference, nbr, transition_matrix, info"})

        except Exception as e:
            return json.dumps({"error": f"Raster operation '{operation}' failed: {str(e)}"})

        result["operation"] = operation
        result["input"] = raster_path
        storage.save_metadata(result, result_type="raster_gis")

        return json.dumps({"summary": summary, "data": result})
