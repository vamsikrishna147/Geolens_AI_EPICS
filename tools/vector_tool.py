"""
GeoLens AI - Vector Processing Tool
======================================
CrewAI tool wrapper for vector GIS operations: buffer, intersect,
reproject, and format conversion using GeoPandas & Shapely.
"""

import json
import os
from typing import Optional, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from storage.storage_manager import StorageManager


class VectorToolInput(BaseModel):
    operation: str = Field(
        ...,
        description=(
            "The vector GIS operation to perform. Options: "
            "'buffer' (create buffer zone around features), "
            "'intersect' (find overlap between two layers), "
            "'reproject' (change coordinate system), "
            "'area' (calculate area in sq km), "
            "'to_geojson' (convert data to GeoJSON file)"
        )
    )
    input_path: str = Field(
        ...,
        description="Path to input GeoJSON or Shapefile."
    )
    input_path_2: Optional[str] = Field(
        None,
        description="Path to second input file (required for 'intersect' operation)."
    )
    buffer_km: float = Field(
        5.0,
        description="Buffer distance in kilometers (only for 'buffer' operation)."
    )
    target_crs: str = Field(
        "EPSG:4326",
        description="Target CRS for 'reproject' operation (e.g., 'EPSG:4326', 'EPSG:32644')."
    )
    output_path: Optional[str] = Field(
        None,
        description="Optional output file path. Auto-generated if not provided."
    )
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class VectorTool(BaseTool):
    """
    Performs vector GIS operations: buffering, intersection, reprojection,
    area calculation, and format conversion on geospatial vector data.
    """

    name: str = "Vector GIS Processing Tool"
    description: str = (
        "Performs vector geospatial operations on GeoJSON/Shapefile data. "
        "Can create buffer zones (e.g., 5km around a flood point), intersect "
        "two layers (e.g., hospitals within a flood zone), reproject coordinates, "
        "calculate polygon areas in sq km, and convert between formats. "
        "Input files must be GeoJSON (.geojson) or Shapefile (.shp)."
    )
    args_schema: Type[BaseModel] = VectorToolInput

    def _run(
        self,
        operation: str,
        input_path: str,
        input_path_2: Optional[str] = None,
        buffer_km: float = 5.0,
        target_crs: str = "EPSG:4326",
        output_path: Optional[str] = None,
        query_id: str = "",
    ) -> str:
        import geopandas as gpd

        from utils.vector_ops import (
            reproject_geodataframe,
            create_buffer,
            spatial_intersection,
            geodataframe_to_geojson,
            calculate_area_km2,
        )

        storage = StorageManager(query_id=query_id or None)
        gis_dir = os.path.join(storage.data_root, "gis_output")
        os.makedirs(gis_dir, exist_ok=True)

        print(f"[VectorTool] Operation: {operation} | Input: {input_path}")

        try:
            gdf = gpd.read_file(input_path)
        except Exception as e:
            return json.dumps({"error": f"Could not read input file: {str(e)}"})

        op = operation.lower().strip()

        try:
            if op == "buffer":
                result_gdf = create_buffer(gdf, distance_km=buffer_km)
                out = output_path or os.path.join(gis_dir, "buffered.geojson")
                result_gdf.to_file(out, driver="GeoJSON")
                summary = f"Created {buffer_km}km buffer around {len(gdf)} features. Saved to {out}"

            elif op == "intersect":
                if not input_path_2:
                    return json.dumps({"error": "intersect requires input_path_2"})
                gdf2 = gpd.read_file(input_path_2)
                result_gdf = spatial_intersection(gdf, gdf2)
                out = output_path or os.path.join(gis_dir, "intersection.geojson")
                result_gdf.to_file(out, driver="GeoJSON")
                summary = f"Intersection produced {len(result_gdf)} features. Saved to {out}"

            elif op == "reproject":
                result_gdf = reproject_geodataframe(gdf, target_crs=target_crs)
                out = output_path or os.path.join(gis_dir, "reprojected.geojson")
                result_gdf.to_file(out, driver="GeoJSON")
                summary = f"Reprojected {len(gdf)} features to {target_crs}. Saved to {out}"

            elif op == "area":
                result_gdf = calculate_area_km2(gdf)
                total_area = result_gdf["area_km2"].sum()
                out = output_path or os.path.join(gis_dir, "areas.geojson")
                result_gdf.to_file(out, driver="GeoJSON")
                summary = f"Calculated areas for {len(gdf)} features. Total area: {total_area:.2f} km². Saved to {out}"

            elif op == "to_geojson":
                out = output_path or os.path.join(gis_dir, "converted.geojson")
                geojson_dict = geodataframe_to_geojson(gdf, output_path=out)
                summary = f"Converted {len(gdf)} features to GeoJSON. Saved to {out}"

            else:
                return json.dumps({"error": f"Unknown operation: '{operation}'. Use: buffer, intersect, reproject, area, to_geojson"})

        except Exception as e:
            return json.dumps({"error": f"Vector operation '{operation}' failed: {str(e)}"})

        result = {
            "operation": operation,
            "input": input_path,
            "output_path": out,
            "feature_count": len(result_gdf) if 'result_gdf' in dir() else 0,
            "summary": summary,
        }
        storage.save_metadata(result, result_type="vector_gis")

        return json.dumps({"summary": summary, "data": result})
