"""
GeoLens AI - OpenStreetMap / Overpass API Tool
================================================
Queries OpenStreetMap via the Overpass API to retrieve map features
for any location: roads, buildings, water bodies, land use,
administrative boundaries, hospitals, schools, and more.

No API key required. Free for all uses.
API: https://overpass-api.de
"""

import json
import time
from typing import Optional, Type

import requests
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from typing import ClassVar

from utils.geocoder import geocode_location, expand_bbox
from storage.storage_manager import StorageManager


class OSMToolInput(BaseModel):
    location: str = Field(..., description="Location name, e.g. 'Konaseema district, Andhra Pradesh'")
    feature_types: Optional[str] = Field(
        "waterway,water,flood_prone",
        description=(
            "Comma-separated OSM feature types to fetch. Options: "
            "waterway (rivers/streams), water (water bodies), "
            "building, road, landuse, boundary, natural, "
            "amenity (hospitals/schools), flood_prone"
        )
    )
    query_id: Optional[str] = Field("", description="Query ID for storage tracking.")


# Predefined Overpass QL query templates for common GeoLens use cases
OVERPASS_TEMPLATES = {
    "waterway": 'way["waterway"~"river|stream|canal|drain"]',
    "water": 'relation["natural"="water"] way["natural"="water"]',
    "building": 'way["building"]',
    "road": 'way["highway"~"primary|secondary|tertiary|residential"]',
    "landuse": 'way["landuse"~"farmland|forest|residential|industrial"]',
    "boundary": 'relation["boundary"="administrative"]["admin_level"~"4|5|6|7|8"]',
    "natural": 'way["natural"~"wood|forest|scrub|wetland"]',
    "amenity": 'node["amenity"~"hospital|school|fire_station|police"]',
    "flood_prone": 'way["flood_prone"="yes"] way["hazard"="flood"]',
}


class OSMTool(BaseTool):
    """
    Queries OpenStreetMap via Overpass API to retrieve map features
    for any location. No API key required. Returns GeoJSON stored in PostGIS.
    """

    name: str = "OpenStreetMap Feature Tool"
    description: str = (
        "Fetches map features from OpenStreetMap for any location using the free Overpass API. "
        "Can retrieve waterways, water bodies, buildings, roads, land use, boundaries, "
        "natural features, and amenities. Useful for infrastructure mapping, flood risk analysis "
        "(river networks), urban analysis, and area characterization. No API key needed."
    )
    args_schema: Type[BaseModel] = OSMToolInput

    OVERPASS_URL: ClassVar[str] = "https://overpass-api.de/api/interpreter"

    def _run(self, location: str, feature_types: Optional[str] = None, query_id: str = "") -> str:
        if not feature_types:
            feature_types = "waterway,water"

        # Geocode location
        geo = geocode_location(location)
        if not geo:
            return json.dumps({"error": f"Could not geocode: '{location}'"})

        bbox = geo["bbox"]
        south, north, west, east = bbox
        # Overpass uses (south, west, north, east)
        bbox_overpass = f"{south},{west},{north},{east}"

        print(f"[OSMTool] Querying OSM features [{feature_types}] for {location}")

        # Build Overpass QL query
        requested = [f.strip() for f in feature_types.split(",")]
        query_parts = []
        for feat in requested:
            templates = OVERPASS_TEMPLATES.get(feat, f'way["{feat}"]')
            if isinstance(templates, str):
                templates = [templates]
            else:
                templates = templates.split()
            for t in templates:
                query_parts.append(f"{t}({bbox_overpass});")

        overpass_query = f"""
        [out:json][timeout:30];
        (
          {chr(10).join(query_parts)}
        );
        out body geom;
        """

        try:
            time.sleep(0.5)  # Be respectful of rate limits
            response = requests.post(
                self.OVERPASS_URL,
                data=overpass_query,
                timeout=45,
                headers={"User-Agent": "GeoLensAI/1.0"},
            )
            response.raise_for_status()
            osm_data = response.json()
        except requests.RequestException as e:
            return json.dumps({"error": f"Overpass API error: {str(e)}"})

        elements = osm_data.get("elements", [])

        # Convert OSM elements to GeoJSON
        features = []
        for elem in elements:
            geometry = self._osm_to_geometry(elem)
            if geometry is None:
                continue
            feature = {
                "type": "Feature",
                "geometry": geometry,
                "properties": {
                    "osm_id": elem.get("id"),
                    "osm_type": elem.get("type"),
                    **elem.get("tags", {}),
                },
            }
            features.append(feature)

        geojson = {"type": "FeatureCollection", "features": features, "metadata": {
            "location": location,
            "bbox": bbox_overpass,
            "feature_types": requested,
            "count": len(features),
        }}

        # Store
        storage = StorageManager(query_id=query_id or None)
        result = storage.save_geojson(geojson, source="osm", feature_type=",".join(requested))

        readable = (
            f"OpenStreetMap data for {location}:\n"
            f"  - Features retrieved: {len(features)}\n"
            f"  - Types: {', '.join(requested)}\n"
            f"  - Saved {result['count']} features to PostGIS\n"
            f"  - File: {result['saved_to_file']}\n"
            f"  - Source: OpenStreetMap (no API key required)"
        )
        return json.dumps({"summary": readable, "count": len(features), "geojson": geojson})

    def _osm_to_geometry(self, element: dict) -> Optional[dict]:
        """Convert an OSM element to a GeoJSON geometry."""
        elem_type = element.get("type")
        if elem_type == "node":
            lat = element.get("lat")
            lon = element.get("lon")
            if lat is not None and lon is not None:
                return {"type": "Point", "coordinates": [lon, lat]}
        elif elem_type in ("way",):
            geometry = element.get("geometry", [])
            if geometry:
                coords = [[g["lon"], g["lat"]] for g in geometry if "lon" in g and "lat" in g]
                if len(coords) >= 2:
                    # Close ring if it looks like a polygon
                    if coords[0] == coords[-1] and len(coords) >= 4:
                        return {"type": "Polygon", "coordinates": [coords]}
                    return {"type": "LineString", "coordinates": coords}
        elif elem_type == "relation":
            # Simplified: return bounding box as polygon
            bounds = element.get("bounds", {})
            if bounds:
                s, n, w, e = bounds["minlat"], bounds["maxlat"], bounds["minlon"], bounds["maxlon"]
                return {"type": "Polygon", "coordinates": [[[w,s],[e,s],[e,n],[w,n],[w,s]]]}
        return None
