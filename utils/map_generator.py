"""
GeoLens AI - Interactive Map Generator
=========================================
Creates interactive HTML maps from GeoJSON, point markers, heatmaps,
and raster overlays using Folium. Maps are saved to data/maps/ by default.

Usage:
    from utils.map_generator import MapGenerator, quick_map

    # Full control
    mg = MapGenerator(center_lat=17.4, center_lon=78.5, zoom=10)
    mg.add_geojson_layer(geojson_data, layer_name="Districts")
    mg.add_markers([{"lat": 17.4, "lon": 78.5, "name": "Hyderabad"}])
    mg.add_layer_control()
    mg.save()

    # One-liner
    quick_map("data/boundary.geojson")
"""

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import folium
import folium.plugins

# Default output directory relative to project root
_PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))
_DEFAULT_MAP_DIR = os.path.join(_PROJECT_ROOT, "data", "maps")

# Default GeoJSON styling
_DEFAULT_STYLE = {
    "fillColor": "#3388ff",
    "color": "#2255aa",
    "weight": 2,
    "fillOpacity": 0.35,
}


class MapGenerator:
    """
    Interactive map builder backed by Folium.

    Supports GeoJSON layers, marker clusters, heatmaps, raster overlays,
    and layer toggle controls. Produces self-contained HTML files.
    """

    def __init__(
        self,
        center_lat: float = 20.5,
        center_lon: float = 78.9,
        zoom: int = 6,
        title: str = "GeoLens Map",
    ) -> None:
        """
        Initialize a new MapGenerator.

        Args:
            center_lat: Latitude of the map centre (default: India ~20.5).
            center_lon: Longitude of the map centre (default: India ~78.9).
            zoom: Initial zoom level (1–18, default 6).
            title: Title embedded in the HTML page <title> tag.
        """
        self.title = title
        self.map = folium.Map(
            location=[center_lat, center_lon],
            zoom_start=zoom,
            tiles=None,
            control_scale=True,
        )
        
        # Primary Basemap: High-Resolution Satellite (Keyless & Authentic)
        folium.TileLayer(
            tiles='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attr='Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
            name='Esri Satellite',
            overlay=False,
            control=True
        ).add_to(self.map)
        
        # Tactical Dark Gray Canvas (Clean, zero watermark, keyless)
        folium.TileLayer(
            tiles='https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            attr='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
            name='Dark Matter Canvas',
            overlay=False,
            control=True
        ).add_to(self.map)

        # Standard OpenStreetMap
        folium.TileLayer(
            tiles='OpenStreetMap',
            name='OpenStreetMap',
            overlay=False,
            control=True
        ).add_to(self.map)

        # Clean Light Canvas (Keyless)
        folium.TileLayer(
            tiles='https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
            attr='Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
            name='Light Canvas',
            overlay=False,
            control=True
        ).add_to(self.map)

        # Topographic Terrain
        folium.TileLayer(
            tiles='https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            attr='Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
            name='Topographic Terrain',
            overlay=False,
            control=True
        ).add_to(self.map)

        # Inject a custom page title and some custom CSS for the map
        self.map.get_root().html.add_child(
            folium.Element(f"<title>{title}</title>")
        )
        self.map.get_root().html.add_child(
            folium.Element("<style>body { background-color: #0f0f14; }</style>")
        )
        print(f"[MapGenerator] Initialised map '{title}' at ({center_lat}, {center_lon}), zoom={zoom}")

    # ------------------------------------------------------------------
    # GeoJSON layer
    # ------------------------------------------------------------------
    def add_geojson_layer(
        self,
        geojson_data: Union[str, dict],
        layer_name: str = "Layer",
        style: Optional[Dict[str, Any]] = None,
        tooltip_fields: Optional[List[str]] = None,
    ) -> "MapGenerator":
        """
        Add a GeoJSON layer to the map.

        Args:
            geojson_data: GeoJSON as a dict **or** a file path string
                          ending in ``.geojson`` / ``.json``.
            layer_name:   Display name shown in the layer control.
            style:        Dict of Leaflet path options
                          (fillColor, color, weight, fillOpacity …).
                          Falls back to a default blue style.
            tooltip_fields: List of feature-property keys to show on hover.

        Returns:
            self – allows method chaining.
        """
        # Resolve file path → dict
        if isinstance(geojson_data, str):
            path = geojson_data
            if path.endswith((".geojson", ".json")):
                if not os.path.isfile(path):
                    print(f"[MapGenerator] GeoJSON file not found: {path}")
                    return self
                with open(path, "r", encoding="utf-8") as f:
                    geojson_data = json.load(f)
                print(f"[MapGenerator] Loaded GeoJSON from {path}")
            else:
                # Try to parse as a JSON string
                try:
                    geojson_data = json.loads(geojson_data)
                except json.JSONDecodeError:
                    print("[MapGenerator] Could not parse geojson_data string")
                    return self

        resolved_style = style or _DEFAULT_STYLE

        # Build optional tooltip
        tooltip = None
        if tooltip_fields:
            tooltip = folium.GeoJsonTooltip(fields=tooltip_fields)

        folium.GeoJson(
            geojson_data,
            name=layer_name,
            style_function=lambda feature, s=resolved_style: s,
            tooltip=tooltip,
        ).add_to(self.map)

        feature_count = len(geojson_data.get("features", []))
        print(f"[MapGenerator] Added GeoJSON layer '{layer_name}' ({feature_count} features)")
        return self

    # ------------------------------------------------------------------
    # Marker cluster
    # ------------------------------------------------------------------
    def add_markers(
        self,
        points: List[Dict[str, Any]],
        popup_field: Optional[str] = None,
        icon_color: str = "red",
    ) -> "MapGenerator":
        """
        Add clustered point markers to the map.

        Args:
            points:      List of dicts, each containing at least
                         ``lat`` and ``lon`` keys. Extra keys are available
                         for popup display.
            popup_field: Key in each dict whose value becomes the marker popup.
            icon_color:  Colour for the marker icon (any Leaflet-valid name).

        Returns:
            self – allows method chaining.
        """
        if not points:
            print("[MapGenerator] No points supplied – skipping markers")
            return self

        cluster = folium.plugins.MarkerCluster(name="Markers")

        for pt in points:
            lat = pt.get("lat")
            lon = pt.get("lon")
            if lat is None or lon is None:
                continue

            popup_text = str(pt.get(popup_field, "")) if popup_field else None

            folium.Marker(
                location=[lat, lon],
                popup=popup_text,
                icon=folium.Icon(color=icon_color),
            ).add_to(cluster)

        cluster.add_to(self.map)
        print(f"[MapGenerator] Added {len(points)} markers (icon_color={icon_color})")
        return self

    # ------------------------------------------------------------------
    # Heatmap
    # ------------------------------------------------------------------
    def add_heatmap(
        self,
        points: List[list],
        radius: int = 15,
        blur: int = 10,
    ) -> "MapGenerator":
        """
        Add a heatmap layer.

        Args:
            points: List of ``[lat, lon]`` or ``[lat, lon, weight]``.
            radius: Radius of each point on the heatmap.
            blur:   Blur radius for smoothing.

        Returns:
            self – allows method chaining.
        """
        if not points:
            print("[MapGenerator] No points supplied – skipping heatmap")
            return self

        folium.plugins.HeatMap(
            points,
            name="Heatmap",
            radius=radius,
            blur=blur,
        ).add_to(self.map)

        print(f"[MapGenerator] Added heatmap layer ({len(points)} points, radius={radius}, blur={blur})")
        return self

    # ------------------------------------------------------------------
    # Raster overlay
    # ------------------------------------------------------------------
    def add_raster_overlay(
        self,
        image_path: str,
        bounds: List[List[float]],
        name: str = "Raster",
    ) -> "MapGenerator":
        """
        Overlay a raster image (PNG / JPEG) on the map.

        Args:
            image_path: Absolute or relative path to the image file.
            bounds:     ``[[south, west], [north, east]]`` geographic bounds.
            name:       Display name shown in the layer control.

        Returns:
            self – allows method chaining.
        """
        if not os.path.isfile(image_path):
            print(f"[MapGenerator] Raster file not found: {image_path}")
            return self

        folium.raster_layers.ImageOverlay(
            image=image_path,
            bounds=bounds,
            name=name,
            opacity=0.7,
            interactive=True,
        ).add_to(self.map)

        print(f"[MapGenerator] Added raster overlay '{name}' from {image_path}")
        return self

    # ------------------------------------------------------------------
    # Layer control
    # ------------------------------------------------------------------
    def add_layer_control(self) -> "MapGenerator":
        """
        Add a layer toggle control (top-right corner) to the map.

        Returns:
            self – allows method chaining.
        """
        folium.LayerControl(collapsed=False).add_to(self.map)
        print("[MapGenerator] Added layer control")
        return self

    # ------------------------------------------------------------------
    # Save / export
    # ------------------------------------------------------------------
    def save(self, output_path: Optional[str] = None) -> str:
        """
        Save the map as a self-contained HTML file.

        Args:
            output_path: Destination file path. When ``None`` the map is
                         saved to ``data/maps/map_<timestamp>.html``.

        Returns:
            Absolute path of the saved HTML file.
        """
        if output_path is None:
            os.makedirs(_DEFAULT_MAP_DIR, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = os.path.join(_DEFAULT_MAP_DIR, f"map_{timestamp}.html")
        else:
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

        self.map.save(output_path)
        abs_path = os.path.abspath(output_path)
        print(f"[MapGenerator] Map saved -> {abs_path}")
        return abs_path

    # ------------------------------------------------------------------
    # Raw access
    # ------------------------------------------------------------------
    def get_map(self) -> folium.Map:
        """
        Return the underlying ``folium.Map`` object for advanced customisation.

        Returns:
            The Folium Map instance.
        """
        return self.map


# ======================================================================
# Convenience function
# ======================================================================

def quick_map(
    geojson_data: Union[str, dict],
    center: Optional[List[float]] = None,
    zoom: int = 10,
    title: str = "GeoLens Quick Map",
) -> str:
    """
    One-liner: create a map from GeoJSON data and save it.

    Args:
        geojson_data: GeoJSON dict **or** file path (``*.geojson`` / ``*.json``).
        center:       ``[lat, lon]`` centre. If ``None`` the centre is auto-
                      detected from the first feature's coordinates.
        zoom:         Initial zoom level.
        title:        HTML page title.

    Returns:
        Absolute path of the saved HTML file.
    """
    # Resolve file → dict so we can inspect coordinates
    raw = geojson_data
    if isinstance(raw, str) and raw.endswith((".geojson", ".json")):
        if not os.path.isfile(raw):
            print(f"[MapGenerator] GeoJSON file not found: {raw}")
            return ""
        with open(raw, "r", encoding="utf-8") as f:
            raw = json.load(f)
    elif isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            print("[MapGenerator] Could not parse geojson_data string")
            return ""

    # Auto-detect centre from the first feature if not supplied
    if center is None:
        center = _detect_center(raw)

    mg = MapGenerator(
        center_lat=center[0],
        center_lon=center[1],
        zoom=zoom,
        title=title,
    )
    mg.add_geojson_layer(raw, layer_name="Data")
    mg.add_layer_control()
    return mg.save()


def _detect_center(geojson: dict) -> List[float]:
    """
    Best-effort centre detection from GeoJSON coordinates.

    Returns:
        [lat, lon] – defaults to (20.5, 78.9) when detection fails.
    """
    try:
        coords = _extract_coords(geojson)
        if coords:
            avg_lon = sum(c[0] for c in coords) / len(coords)
            avg_lat = sum(c[1] for c in coords) / len(coords)
            return [avg_lat, avg_lon]
    except Exception:
        pass
    return [20.5, 78.9]


def _extract_coords(obj: Any) -> List[list]:
    """Recursively pull [lon, lat] pairs from any GeoJSON structure."""
    coords: List[list] = []
    if isinstance(obj, dict):
        if "coordinates" in obj:
            coords.extend(_flatten_coords(obj["coordinates"]))
        for value in obj.values():
            coords.extend(_extract_coords(value))
    elif isinstance(obj, list):
        for item in obj:
            coords.extend(_extract_coords(item))
    return coords


def _flatten_coords(c: Any) -> List[list]:
    """Flatten nested coordinate arrays into a list of [lon, lat] pairs."""
    if not c:
        return []
    if isinstance(c[0], (int, float)):
        return [c]
    result: List[list] = []
    for item in c:
        result.extend(_flatten_coords(item))
    return result
