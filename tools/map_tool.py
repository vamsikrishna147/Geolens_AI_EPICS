"""
GeoLens AI - Map Generation Tool
===================================
CrewAI tool wrapper for creating interactive Folium HTML maps
from GeoJSON data, markers, and raster overlays.
"""

import json
import os
from typing import Optional, Type

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from storage.storage_manager import StorageManager


class MapToolInput(BaseModel):
    geojson_path: str = Field(
        ...,
        description="Path to a GeoJSON file to display on the map."
    )
    title: str = Field(
        "GeoLens Analysis Map",
        description="Title for the map (used in filename and metadata)."
    )
    center_lat: Optional[float] = Field(
        None,
        description="Latitude for map center. Auto-detected from data if not provided."
    )
    center_lon: Optional[float] = Field(
        None,
        description="Longitude for map center. Auto-detected from data if not provided."
    )
    zoom: int = Field(
        10,
        description="Initial zoom level (1-18, higher = more zoomed in)."
    )
    style_color: str = Field(
        "#3388ff",
        description="Fill color for polygon/line features (hex color code)."
    )
    add_markers: bool = Field(
        True,
        description="If True, add clickable markers for point features."
    )
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


class MapTool(BaseTool):
    """
    Generates interactive HTML maps from GeoJSON data using Folium.
    The maps can be opened in any web browser.
    """

    name: str = "Interactive Map Generator Tool"
    description: str = (
        "Creates beautiful interactive HTML maps from GeoJSON data. "
        "The generated map shows features on a satellite/street basemap with "
        "popups, tooltips, and layer controls. Output is a standalone .html file "
        "that can be opened in any browser. Use this after processing vector data "
        "to visualize results like flood zones, buffer areas, or hospital locations."
    )
    args_schema: Type[BaseModel] = MapToolInput

    def _run(
        self,
        geojson_path: str,
        title: str = "GeoLens Analysis Map",
        center_lat: Optional[float] = None,
        center_lon: Optional[float] = None,
        zoom: int = 10,
        style_color: str = "#3388ff",
        add_markers: bool = True,
        query_id: str = "",
    ) -> str:
        from utils.map_generator import MapGenerator

        storage = StorageManager(query_id=query_id or None)
        maps_dir = os.path.join(storage.data_root, "maps")
        os.makedirs(maps_dir, exist_ok=True)

        print(f"[MapTool] Generating map from {geojson_path}")

        # Read geojson to detect center if not provided
        try:
            import geopandas as gpd
            gdf = gpd.read_file(geojson_path)
            
            if center_lat is None or center_lon is None:
                centroid = gdf.geometry.unary_union.centroid
                center_lat = centroid.y
                center_lon = centroid.x

            # Read raw geojson for the map layer
            with open(geojson_path, 'r', encoding='utf-8') as f:
                geojson_data = json.load(f)

        except Exception as e:
            return json.dumps({"error": f"Could not read GeoJSON file: {str(e)}"})

        try:
            # Create map
            mapper = MapGenerator(
                center_lat=center_lat,
                center_lon=center_lon,
                zoom=zoom,
                title=title,
            )

            # Add the GeoJSON layer
            style = {
                "fillColor": style_color,
                "color": style_color,
                "weight": 2,
                "fillOpacity": 0.3,
            }
            mapper.add_geojson_layer(
                geojson_data=geojson_data,
                layer_name=title,
                style=style,
            )

            # Add markers for point features
            if add_markers and len(gdf) > 0:
                point_features = gdf[gdf.geometry.geom_type == "Point"]
                if len(point_features) > 0:
                    points = []
                    for _, row in point_features.iterrows():
                        point = {"lat": row.geometry.y, "lon": row.geometry.x}
                        # Try to add a useful popup field
                        for col in ["name", "Name", "title", "description"]:
                            if col in row.index and row[col]:
                                point["popup"] = str(row[col])
                                break
                        points.append(point)
                    mapper.add_markers(points)

            mapper.add_layer_control()

            # Save
            safe_title = title.lower().replace(" ", "_")[:30]
            output_path = os.path.join(maps_dir, f"{safe_title}.html")
            saved_path = mapper.save(output_path=output_path)

        except Exception as e:
            return json.dumps({"error": f"Map generation failed: {str(e)}"})

        result = {
            "map_path": saved_path,
            "title": title,
            "center": {"lat": center_lat, "lon": center_lon},
            "feature_count": len(gdf),
            "summary": f"Interactive map '{title}' generated with {len(gdf)} features. Open in browser: {saved_path}",
        }
        storage.save_metadata(result, result_type="map")

        return json.dumps({
            "summary": f"✅ Interactive map generated!\n   Title: {title}\n   Features: {len(gdf)}\n   Open in browser: {saved_path}",
            "data": result,
        })
