"""
GeoLens AI - Vector Operations Utility
==========================================
Provides reusable vector-geometry helpers for the GeoLens AI platform.

Functions cover common GIS vector workflows:
  • Reprojection between coordinate reference systems
  • Metric-accurate buffering via automatic UTM projection
  • Spatial intersection and spatial join
  • GeoJSON ↔ GeoDataFrame conversion
  • Area calculation in square kilometres
  • UTM CRS lookup from a lat / lon pair
"""

import json
import math
import os
from typing import Optional, Union

import geopandas as gpd
import shapely


# ---------------------------------------------------------------------------
# Helper – UTM CRS lookup
# ---------------------------------------------------------------------------

def get_utm_crs(lat: float, lon: float) -> str:
    """
    Return the EPSG code of the UTM zone that covers a given lat/lon.

    Args:
        lat: Latitude in decimal degrees (negative = south).
        lon: Longitude in decimal degrees (negative = west).

    Returns:
        EPSG string such as ``"EPSG:32644"`` (UTM zone 44 N).

    Raises:
        ValueError: If *lat* or *lon* fall outside valid WGS-84 ranges.
    """
    if not (-90 <= lat <= 90):
        raise ValueError(f"[VectorOps] Invalid latitude: {lat}")
    if not (-180 <= lon <= 180):
        raise ValueError(f"[VectorOps] Invalid longitude: {lon}")

    zone_number = int((lon + 180) / 6) + 1

    # EPSG 326xx = north, 327xx = south
    if lat >= 0:
        epsg_code = 32600 + zone_number
    else:
        epsg_code = 32700 + zone_number

    print(f"[VectorOps] UTM zone for ({lat:.4f}, {lon:.4f}) → EPSG:{epsg_code}")
    return f"EPSG:{epsg_code}"


# ---------------------------------------------------------------------------
# Reprojection
# ---------------------------------------------------------------------------

def reproject_geodataframe(
    gdf: gpd.GeoDataFrame,
    target_crs: str = "EPSG:4326",
) -> gpd.GeoDataFrame:
    """
    Reproject a GeoDataFrame to the requested CRS.

    Args:
        gdf:        Input GeoDataFrame (must have a CRS set).
        target_crs: Target coordinate reference system (default WGS-84).

    Returns:
        A **new** GeoDataFrame in *target_crs*.

    Raises:
        ValueError: If the input GeoDataFrame has no CRS assigned.
    """
    if gdf.crs is None:
        raise ValueError(
            "[VectorOps] Cannot reproject: input GeoDataFrame has no CRS. "
            "Set one with gdf.set_crs() first."
        )

    if str(gdf.crs) == target_crs:
        print(f"[VectorOps] GeoDataFrame already in {target_crs}, skipping reprojection.")
        return gdf.copy()

    reprojected = gdf.to_crs(target_crs)
    print(
        f"[VectorOps] Reprojected {len(reprojected)} features: "
        f"{gdf.crs} → {target_crs}"
    )
    return reprojected


# ---------------------------------------------------------------------------
# Buffering
# ---------------------------------------------------------------------------

def create_buffer(
    gdf: gpd.GeoDataFrame,
    distance_km: float = 5.0,
) -> gpd.GeoDataFrame:
    """
    Buffer every geometry by *distance_km* kilometres (metric-accurate).

    Internally the function:
      1. Reprojects to UTM (derived from the centroid of the dataset).
      2. Applies ``geometry.buffer(distance_m)`` in projected metres.
      3. Reprojects the result back to EPSG:4326.

    Args:
        gdf:         Input GeoDataFrame (must have a CRS set).
        distance_km: Buffer radius in kilometres (default 5 km).

    Returns:
        A new GeoDataFrame with buffered geometries in EPSG:4326.

    Raises:
        ValueError: If *gdf* has no CRS or contains no geometries.
    """
    if gdf.crs is None:
        raise ValueError("[VectorOps] Cannot buffer: input GeoDataFrame has no CRS.")
    if gdf.empty:
        raise ValueError("[VectorOps] Cannot buffer: input GeoDataFrame is empty.")

    # Determine UTM zone from the centroid of the unioned geometry
    gdf_wgs = reproject_geodataframe(gdf, "EPSG:4326")
    centroid = gdf_wgs.geometry.unary_union.centroid
    utm_crs = get_utm_crs(centroid.y, centroid.x)

    # Project → buffer → back to WGS-84
    gdf_utm = reproject_geodataframe(gdf, utm_crs)
    distance_m = distance_km * 1000.0
    gdf_utm["geometry"] = gdf_utm.geometry.buffer(distance_m)

    buffered = reproject_geodataframe(gdf_utm, "EPSG:4326")
    print(
        f"[VectorOps] Buffered {len(buffered)} features by {distance_km} km "
        f"(via {utm_crs})"
    )
    return buffered


# ---------------------------------------------------------------------------
# Spatial overlay / intersection
# ---------------------------------------------------------------------------

def spatial_intersection(
    gdf1: gpd.GeoDataFrame,
    gdf2: gpd.GeoDataFrame,
) -> gpd.GeoDataFrame:
    """
    Compute the geometric intersection (overlay) of two GeoDataFrames.

    Both inputs are aligned to EPSG:4326 before the overlay to ensure
    CRS compatibility.

    Args:
        gdf1: First GeoDataFrame.
        gdf2: Second GeoDataFrame.

    Returns:
        GeoDataFrame containing only the intersecting portions.

    Raises:
        ValueError: If either input is missing a CRS.
    """
    if gdf1.crs is None or gdf2.crs is None:
        raise ValueError(
            "[VectorOps] Both GeoDataFrames must have a CRS set for intersection."
        )

    gdf1_aligned = reproject_geodataframe(gdf1, "EPSG:4326")
    gdf2_aligned = reproject_geodataframe(gdf2, "EPSG:4326")

    try:
        result = gpd.overlay(gdf1_aligned, gdf2_aligned, how="intersection")
        print(
            f"[VectorOps] Spatial intersection: "
            f"{len(gdf1_aligned)} × {len(gdf2_aligned)} → {len(result)} features"
        )
        return result
    except Exception as e:
        print(f"[VectorOps] Spatial intersection failed: {e}")
        raise


# ---------------------------------------------------------------------------
# Spatial join
# ---------------------------------------------------------------------------

def spatial_join(
    gdf1: gpd.GeoDataFrame,
    gdf2: gpd.GeoDataFrame,
    how: str = "inner",
    predicate: str = "intersects",
) -> gpd.GeoDataFrame:
    """
    Perform a spatial join between two GeoDataFrames.

    Args:
        gdf1:      Left GeoDataFrame (geometry is preserved).
        gdf2:      Right GeoDataFrame.
        how:       Join type — ``"inner"``, ``"left"``, or ``"right"``.
        predicate: Spatial predicate — ``"intersects"``, ``"contains"``,
                   ``"within"``, etc.

    Returns:
        Joined GeoDataFrame.

    Raises:
        ValueError: If either input is missing a CRS or *how* is invalid.
    """
    if gdf1.crs is None or gdf2.crs is None:
        raise ValueError(
            "[VectorOps] Both GeoDataFrames must have a CRS set for spatial join."
        )

    valid_how = {"inner", "left", "right"}
    if how not in valid_how:
        raise ValueError(
            f"[VectorOps] Invalid join type '{how}'. Choose from {valid_how}."
        )

    gdf1_aligned = reproject_geodataframe(gdf1, "EPSG:4326")
    gdf2_aligned = reproject_geodataframe(gdf2, "EPSG:4326")

    try:
        result = gpd.sjoin(gdf1_aligned, gdf2_aligned, how=how, predicate=predicate)
        print(
            f"[VectorOps] Spatial join ({how}/{predicate}): "
            f"{len(gdf1_aligned)} + {len(gdf2_aligned)} → {len(result)} features"
        )
        return result
    except Exception as e:
        print(f"[VectorOps] Spatial join failed: {e}")
        raise


# ---------------------------------------------------------------------------
# GeoJSON ↔ GeoDataFrame conversion
# ---------------------------------------------------------------------------

def geojson_to_geodataframe(
    geojson_data: Union[dict, str],
) -> gpd.GeoDataFrame:
    """
    Convert GeoJSON (dict or JSON string) to a GeoDataFrame.

    Args:
        geojson_data: A GeoJSON dictionary **or** a JSON-encoded string.

    Returns:
        GeoDataFrame with CRS set to EPSG:4326 (the GeoJSON standard).

    Raises:
        ValueError: If the input cannot be parsed as valid GeoJSON.
    """
    try:
        if isinstance(geojson_data, str):
            geojson_data = json.loads(geojson_data)

        if not isinstance(geojson_data, dict):
            raise TypeError("Expected a dict or JSON string.")

        gdf = gpd.GeoDataFrame.from_features(
            geojson_data.get("features", [geojson_data]),
            crs="EPSG:4326",
        )
        print(f"[VectorOps] GeoJSON → GeoDataFrame: {len(gdf)} features loaded.")
        return gdf

    except Exception as e:
        print(f"[VectorOps] Failed to convert GeoJSON to GeoDataFrame: {e}")
        raise ValueError(f"[VectorOps] Invalid GeoJSON input: {e}") from e


def geodataframe_to_geojson(
    gdf: gpd.GeoDataFrame,
    output_path: Optional[str] = None,
) -> dict:
    """
    Convert a GeoDataFrame to a GeoJSON dictionary.

    Args:
        gdf:         Input GeoDataFrame.
        output_path: If provided, the GeoJSON is also written to this file.

    Returns:
        GeoJSON dictionary (``FeatureCollection``).

    Raises:
        ValueError: If the GeoDataFrame is empty or has no geometry column.
    """
    if gdf.empty:
        raise ValueError("[VectorOps] Cannot convert empty GeoDataFrame to GeoJSON.")

    # Ensure WGS-84 (GeoJSON spec mandates EPSG:4326)
    if gdf.crs is not None and str(gdf.crs) != "EPSG:4326":
        gdf = reproject_geodataframe(gdf, "EPSG:4326")

    geojson_dict = json.loads(gdf.to_json())

    if output_path is not None:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(geojson_dict, f, indent=2)
        print(f"[VectorOps] GeoJSON saved to {output_path}")

    print(
        f"[VectorOps] GeoDataFrame → GeoJSON: "
        f"{len(geojson_dict.get('features', []))} features."
    )
    return geojson_dict


# ---------------------------------------------------------------------------
# Area calculation
# ---------------------------------------------------------------------------

def calculate_area_km2(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    Add an ``area_km2`` column with each geometry's area in square kilometres.

    The function reprojects to the appropriate UTM zone for metric accuracy
    before computing areas.

    Args:
        gdf: Input GeoDataFrame (must have a CRS set).

    Returns:
        A **copy** of *gdf* with an extra ``area_km2`` column.

    Raises:
        ValueError: If *gdf* has no CRS or is empty.
    """
    if gdf.crs is None:
        raise ValueError("[VectorOps] Cannot calculate area: GeoDataFrame has no CRS.")
    if gdf.empty:
        raise ValueError("[VectorOps] Cannot calculate area: GeoDataFrame is empty.")

    gdf_wgs = reproject_geodataframe(gdf, "EPSG:4326")
    centroid = gdf_wgs.geometry.unary_union.centroid
    utm_crs = get_utm_crs(centroid.y, centroid.x)

    gdf_utm = reproject_geodataframe(gdf, utm_crs)
    result = gdf.copy()
    result["area_km2"] = gdf_utm.geometry.area / 1e6  # m² → km²

    print(
        f"[VectorOps] Calculated area for {len(result)} features "
        f"(total {result['area_km2'].sum():.2f} km²)"
    )
    return result
