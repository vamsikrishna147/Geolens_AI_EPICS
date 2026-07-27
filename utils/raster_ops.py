"""
GeoLens AI - Raster Operations Utility
==========================================
Provides core raster processing functions for clipping, zonal statistics,
spectral index computation (NDVI, NDWI), metadata inspection, and resampling.

All functions operate on local GeoTIFF files using rasterio and numpy.
Results are logged with the [RasterOps] prefix for easy tracing.
"""

import os
import tempfile
from typing import Dict, List, Optional, Union

import geopandas as gpd
import numpy as np
import rasterio
import rasterio.mask
import rasterio.transform
import rasterio.warp
from rasterio.enums import Resampling


# ---------------------------------------------------------------------------
# 1. Clip Raster to Boundary
# ---------------------------------------------------------------------------

def clip_raster_to_boundary(
    raster_path: str,
    boundary_gdf: gpd.GeoDataFrame,
    output_path: Optional[str] = None,
) -> str:
    """
    Clip a GeoTIFF raster to a polygon boundary from a GeoDataFrame.

    The boundary GeoDataFrame is reprojected to match the raster CRS before
    clipping.  If no output path is given, a temporary file is created in the
    same directory as the input raster.

    Args:
        raster_path:   Path to the input GeoTIFF file.
        boundary_gdf:  GeoDataFrame containing one or more polygons to clip to.
        output_path:   Optional path for the clipped output GeoTIFF.

    Returns:
        Absolute path to the clipped raster file.

    Raises:
        FileNotFoundError: If the input raster does not exist.
        ValueError:        If the boundary GeoDataFrame is empty.
    """
    if not os.path.isfile(raster_path):
        raise FileNotFoundError(f"[RasterOps] Raster not found: {raster_path}")
    if boundary_gdf.empty:
        raise ValueError("[RasterOps] Boundary GeoDataFrame is empty.")

    if output_path is None:
        base, ext = os.path.splitext(raster_path)
        output_path = f"{base}_clipped{ext}"

    print(f"[RasterOps] Clipping raster: {os.path.basename(raster_path)}")

    try:
        with rasterio.open(raster_path) as src:
            # Reproject boundary to raster CRS
            boundary_reprojected = boundary_gdf.to_crs(src.crs)
            geometries = boundary_reprojected.geometry.values

            out_image, out_transform = rasterio.mask.mask(
                src, geometries, crop=True, nodata=src.nodata
            )
            out_meta = src.meta.copy()
            out_meta.update({
                "driver": "GTiff",
                "height": out_image.shape[1],
                "width": out_image.shape[2],
                "transform": out_transform,
            })

            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            with rasterio.open(output_path, "w", **out_meta) as dst:
                dst.write(out_image)

        print(f"[RasterOps] Clipped raster saved → {output_path}")
        return os.path.abspath(output_path)

    except Exception as e:
        print(f"[RasterOps] Error clipping raster: {e}")
        raise


# ---------------------------------------------------------------------------
# 2. Zonal Statistics
# ---------------------------------------------------------------------------

def zonal_statistics(
    raster_path: str,
    zones_gdf: gpd.GeoDataFrame,
    stats: Optional[List[str]] = None,
) -> gpd.GeoDataFrame:
    """
    Calculate raster value statistics within each polygon zone.

    Supported statistics: ``mean``, ``max``, ``min``, ``std``, ``count``,
    ``sum``, ``median``.

    Args:
        raster_path: Path to the input single-band GeoTIFF.
        zones_gdf:   GeoDataFrame of polygon zones.
        stats:       List of statistic names to compute.
                     Defaults to ``['mean', 'max', 'min', 'std', 'count']``.

    Returns:
        A copy of *zones_gdf* with new columns for each requested statistic,
        prefixed with ``raster_`` (e.g. ``raster_mean``).

    Raises:
        FileNotFoundError: If the raster file does not exist.
        ValueError:        If the zones GeoDataFrame is empty.
    """
    if stats is None:
        stats = ["mean", "max", "min", "std", "count"]

    if not os.path.isfile(raster_path):
        raise FileNotFoundError(f"[RasterOps] Raster not found: {raster_path}")
    if zones_gdf.empty:
        raise ValueError("[RasterOps] Zones GeoDataFrame is empty.")

    print(f"[RasterOps] Computing zonal statistics ({', '.join(stats)}) "
          f"for {len(zones_gdf)} zones")

    result_gdf = zones_gdf.copy()

    # Pre-fill stat columns with NaN
    for stat_name in stats:
        result_gdf[f"raster_{stat_name}"] = np.nan

    _STAT_FUNCS = {
        "mean": np.nanmean,
        "max": np.nanmax,
        "min": np.nanmin,
        "std": np.nanstd,
        "count": lambda a: int(np.count_nonzero(~np.isnan(a))),
        "sum": np.nansum,
        "median": np.nanmedian,
    }

    try:
        with rasterio.open(raster_path) as src:
            # Reproject zones to raster CRS
            zones_reprojected = result_gdf.to_crs(src.crs)

            for idx, row in zones_reprojected.iterrows():
                geom = [row.geometry]
                try:
                    out_image, _ = rasterio.mask.mask(
                        src, geom, crop=True, nodata=src.nodata
                    )
                    data = out_image[0].astype(float)

                    # Mask nodata values
                    if src.nodata is not None:
                        data[data == src.nodata] = np.nan

                    if np.all(np.isnan(data)):
                        continue

                    for stat_name in stats:
                        func = _STAT_FUNCS.get(stat_name)
                        if func is not None:
                            result_gdf.at[idx, f"raster_{stat_name}"] = func(data)

                except Exception as zone_err:
                    print(f"[RasterOps] Warning: skipping zone {idx}: {zone_err}")
                    continue

        print(f"[RasterOps] Zonal statistics complete for {len(result_gdf)} zones")
        return result_gdf

    except Exception as e:
        print(f"[RasterOps] Error computing zonal statistics: {e}")
        raise


# ---------------------------------------------------------------------------
# 3. Compute NDVI
# ---------------------------------------------------------------------------

def compute_ndvi(
    red_band_path: str,
    nir_band_path: str,
    output_path: Optional[str] = None,
) -> str:
    """
    Compute NDVI (Normalized Difference Vegetation Index).

    .. math:: NDVI = (NIR - RED) / (NIR + RED)

    Args:
        red_band_path: Path to the single-band RED GeoTIFF.
        nir_band_path: Path to the single-band NIR GeoTIFF.
        output_path:   Optional output path.  Defaults to
                       ``<red_band_dir>/ndvi_output.tif``.

    Returns:
        Absolute path to the NDVI GeoTIFF (float32, range [-1, 1]).

    Raises:
        FileNotFoundError: If either input raster is missing.
        ValueError:        If the two rasters have incompatible shapes.
    """
    return _compute_normalised_difference(
        band_a_path=nir_band_path,
        band_b_path=red_band_path,
        output_path=output_path,
        index_name="NDVI",
        default_filename="ndvi_output.tif",
    )


# ---------------------------------------------------------------------------
# 4. Compute NDWI
# ---------------------------------------------------------------------------

def compute_ndwi(
    green_band_path: str,
    nir_band_path: str,
    output_path: Optional[str] = None,
) -> str:
    """
    Compute NDWI (Normalized Difference Water Index).

    .. math:: NDWI = (GREEN - NIR) / (GREEN + NIR)

    Args:
        green_band_path: Path to the single-band GREEN GeoTIFF.
        nir_band_path:   Path to the single-band NIR GeoTIFF.
        output_path:     Optional output path.  Defaults to
                         ``<green_band_dir>/ndwi_output.tif``.

    Returns:
        Absolute path to the NDWI GeoTIFF (float32, range [-1, 1]).

    Raises:
        FileNotFoundError: If either input raster is missing.
        ValueError:        If the two rasters have incompatible shapes.
    """
    return _compute_normalised_difference(
        band_a_path=green_band_path,
        band_b_path=nir_band_path,
        output_path=output_path,
        index_name="NDWI",
        default_filename="ndwi_output.tif",
    )


# ---------------------------------------------------------------------------
# Shared helper for normalised-difference indices
# ---------------------------------------------------------------------------

def _compute_normalised_difference(
    band_a_path: str,
    band_b_path: str,
    output_path: Optional[str],
    index_name: str,
    default_filename: str,
) -> str:
    """
    Internal helper: compute (A - B) / (A + B) from two single-band rasters.

    Args:
        band_a_path:      Numerator-positive band path.
        band_b_path:      Numerator-negative band path.
        output_path:      Optional output GeoTIFF path.
        index_name:       Human-readable index name for logging.
        default_filename: Filename used when output_path is None.

    Returns:
        Absolute path to the output GeoTIFF.
    """
    for label, path in [("Band A", band_a_path), ("Band B", band_b_path)]:
        if not os.path.isfile(path):
            raise FileNotFoundError(
                f"[RasterOps] {index_name} — {label} raster not found: {path}"
            )

    if output_path is None:
        output_path = os.path.join(os.path.dirname(band_a_path), default_filename)

    print(f"[RasterOps] Computing {index_name} …")

    try:
        with rasterio.open(band_a_path) as src_a, rasterio.open(band_b_path) as src_b:
            if src_a.shape != src_b.shape:
                raise ValueError(
                    f"[RasterOps] {index_name} — shape mismatch: "
                    f"{src_a.shape} vs {src_b.shape}"
                )

            band_a = src_a.read(1).astype(np.float32)
            band_b = src_b.read(1).astype(np.float32)

            # Mask nodata
            if src_a.nodata is not None:
                band_a[band_a == src_a.nodata] = np.nan
            if src_b.nodata is not None:
                band_b[band_b == src_b.nodata] = np.nan

            denominator = band_a + band_b
            # Avoid division by zero — set those pixels to NaN
            with np.errstate(divide="ignore", invalid="ignore"):
                index = np.where(
                    denominator != 0,
                    (band_a - band_b) / denominator,
                    np.nan,
                )
            index = index.astype(np.float32)

            out_meta = src_a.meta.copy()
            out_meta.update({
                "driver": "GTiff",
                "dtype": "float32",
                "count": 1,
                "nodata": np.nan,
            })

            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            with rasterio.open(output_path, "w", **out_meta) as dst:
                dst.write(index, 1)

        print(f"[RasterOps] {index_name} saved -> {output_path}")
        return os.path.abspath(output_path)

    except Exception as e:
        print(f"[RasterOps] Error computing {index_name}: {e}")
        raise


# ---------------------------------------------------------------------------
# 5. Raster Info
# ---------------------------------------------------------------------------

def raster_info(raster_path: str) -> Dict[str, object]:
    """
    Return a dictionary of raster metadata.

    Keys returned:
        - ``crs``        – Coordinate Reference System (string)
        - ``bounds``     – Bounding box as (left, bottom, right, top)
        - ``resolution`` – (x_res, y_res) in CRS units
        - ``band_count`` – Number of bands
        - ``dtype``      – Data type of band 1
        - ``shape``      – (height, width) in pixels
        - ``nodata``     – Nodata value (may be None)
        - ``driver``     – Raster driver name
        - ``transform``  – Affine transform as a tuple

    Args:
        raster_path: Path to the GeoTIFF file.

    Returns:
        Metadata dictionary.

    Raises:
        FileNotFoundError: If the raster does not exist.
    """
    if not os.path.isfile(raster_path):
        raise FileNotFoundError(f"[RasterOps] Raster not found: {raster_path}")

    print(f"[RasterOps] Reading info for: {os.path.basename(raster_path)}")

    try:
        with rasterio.open(raster_path) as src:
            info: Dict[str, object] = {
                "crs": str(src.crs) if src.crs else None,
                "bounds": tuple(src.bounds),
                "resolution": (src.res[0], src.res[1]),
                "band_count": src.count,
                "dtype": str(src.dtypes[0]),
                "shape": (src.height, src.width),
                "nodata": src.nodata,
                "driver": src.driver,
                "transform": tuple(src.transform)[:6],
            }

        print(
            f"[RasterOps] {os.path.basename(raster_path)}: "
            f"{info['shape'][1]}×{info['shape'][0]} px, "
            f"{info['band_count']} band(s), CRS={info['crs']}"
        )
        return info

    except Exception as e:
        print(f"[RasterOps] Error reading raster info: {e}")
        raise


# ---------------------------------------------------------------------------
# 6. Resample Raster
# ---------------------------------------------------------------------------

def resample_raster(
    raster_path: str,
    target_resolution_m: float,
    output_path: Optional[str] = None,
) -> str:
    """
    Resample a raster to a new spatial resolution.

    Uses bilinear interpolation by default.  The output raster retains the
    same CRS and extent as the input; only pixel size changes.

    Args:
        raster_path:        Path to the input GeoTIFF.
        target_resolution_m: Desired pixel size in CRS units (usually metres
                             for projected CRS, or degrees for geographic CRS).
        output_path:        Optional output path.  Defaults to
                            ``<input>_resampled.tif``.

    Returns:
        Absolute path to the resampled GeoTIFF.

    Raises:
        FileNotFoundError: If the input raster does not exist.
        ValueError:        If the target resolution is non-positive.
    """
    if not os.path.isfile(raster_path):
        raise FileNotFoundError(f"[RasterOps] Raster not found: {raster_path}")
    if target_resolution_m <= 0:
        raise ValueError(
            f"[RasterOps] Target resolution must be positive, got {target_resolution_m}"
        )

    if output_path is None:
        base, ext = os.path.splitext(raster_path)
        output_path = f"{base}_resampled{ext}"

    print(
        f"[RasterOps] Resampling {os.path.basename(raster_path)} "
        f"→ {target_resolution_m} CRS-units/pixel"
    )

    try:
        with rasterio.open(raster_path) as src:
            bounds = src.bounds
            new_transform = rasterio.transform.from_bounds(
                bounds.left, bounds.bottom, bounds.right, bounds.top,
                width=max(1, int((bounds.right - bounds.left) / target_resolution_m)),
                height=max(1, int((bounds.top - bounds.bottom) / target_resolution_m)),
            )
            new_width = max(1, int((bounds.right - bounds.left) / target_resolution_m))
            new_height = max(1, int((bounds.top - bounds.bottom) / target_resolution_m))

            out_meta = src.meta.copy()
            out_meta.update({
                "driver": "GTiff",
                "height": new_height,
                "width": new_width,
                "transform": new_transform,
            })

            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            with rasterio.open(output_path, "w", **out_meta) as dst:
                for band_idx in range(1, src.count + 1):
                    rasterio.warp.reproject(
                        source=rasterio.band(src, band_idx),
                        destination=rasterio.band(dst, band_idx),
                        src_transform=src.transform,
                        src_crs=src.crs,
                        dst_transform=new_transform,
                        dst_crs=src.crs,
                        resampling=Resampling.bilinear,
                    )

        print(
            f"[RasterOps] Resampled raster saved → {output_path} "
            f"({new_width}×{new_height} px)"
        )
        return os.path.abspath(output_path)

    except Exception as e:
        print(f"[RasterOps] Error resampling raster: {e}")
        raise


# ---------------------------------------------------------------------------
# 7. Compute Raster Difference (T2 - T1 Change Matrix)
# ---------------------------------------------------------------------------

def compute_raster_difference(
    raster_t1_path: str,
    raster_t2_path: str,
    output_path: Optional[str] = None,
) -> Dict[str, object]:
    """
    Compute raster pixel difference Delta = T2 - T1 to measure index changes
    (e.g., NDVI drop for deforestation, NDWI increase for flood extent).

    Args:
        raster_t1_path: Baseline period (T1) GeoTIFF raster.
        raster_t2_path: Comparison period (T2) GeoTIFF raster.
        output_path: Optional output path for the delta GeoTIFF.

    Returns:
        Dictionary containing output path, mean delta, max increase, max decrease,
        and percentage area altered.
    """
    if not os.path.isfile(raster_t1_path) or not os.path.isfile(raster_t2_path):
        raise FileNotFoundError("[RasterOps] Input raster T1 or T2 not found.")

    if output_path is None:
        base, ext = os.path.splitext(raster_t2_path)
        output_path = f"{base}_delta{ext}"

    print(f"[RasterOps] Computing multi-temporal difference (T2 - T1)…")

    with rasterio.open(raster_t1_path) as src1, rasterio.open(raster_t2_path) as src2:
        if src1.shape != src2.shape:
            raise ValueError(f"[RasterOps] Shape mismatch between T1 {src1.shape} and T2 {src2.shape}")

        t1 = src1.read(1).astype(np.float32)
        t2 = src2.read(1).astype(np.float32)

        if src1.nodata is not None:
            t1[t1 == src1.nodata] = np.nan
        if src2.nodata is not None:
            t2[t2 == src2.nodata] = np.nan

        delta = t2 - t1

        out_meta = src1.meta.copy()
        out_meta.update({"driver": "GTiff", "dtype": "float32", "count": 1, "nodata": np.nan})

        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        with rasterio.open(output_path, "w", **out_meta) as dst:
            dst.write(delta, 1)

        valid_mask = ~np.isnan(delta)
        mean_delta = float(np.nanmean(delta)) if np.any(valid_mask) else 0.0
        max_increase = float(np.nanmax(delta)) if np.any(valid_mask) else 0.0
        max_decrease = float(np.nanmin(delta)) if np.any(valid_mask) else 0.0

        # Significant changes (> 0.2 absolute delta)
        significant_change_px = int(np.sum(np.abs(delta[valid_mask]) > 0.2))
        total_valid_px = int(np.sum(valid_mask))
        pct_changed = round((significant_change_px / total_valid_px * 100), 2) if total_valid_px > 0 else 0.0

    print(f"[RasterOps] Delta saved -> {output_path} | Mean Delta: {mean_delta:.4f} | Changed Area: {pct_changed}%")

    return {
        "output_path": os.path.abspath(output_path),
        "mean_delta": round(mean_delta, 4),
        "max_increase": round(max_increase, 4),
        "max_decrease": round(max_decrease, 4),
        "significant_change_pct": pct_changed,
    }


# ---------------------------------------------------------------------------
# 8. Compute NBR (Normalized Burn Ratio)
# ---------------------------------------------------------------------------

def compute_nbr(
    nir_band_path: str,
    swir_band_path: str,
    output_path: Optional[str] = None,
) -> str:
    """
    Compute Normalized Burn Ratio (NBR = (NIR - SWIR) / (NIR + SWIR)) for wildfire
    burn severity assessment.
    """
    return _compute_normalised_difference(
        band_a_path=nir_band_path,
        band_b_path=swir_band_path,
        output_path=output_path,
        index_name="NBR",
        default_filename="nbr_output.tif",
    )


# ---------------------------------------------------------------------------
# 9. Compute Land Cover Transition Matrix
# ---------------------------------------------------------------------------

def compute_land_cover_transition(
    lc_t1_path: str,
    lc_t2_path: str,
    pixel_size_m: float = 10.0,
) -> Dict[str, object]:
    """
    Compute transition area matrix (sq km) between categorical land cover rasters T1 & T2.
    Class mappings (ESA WorldCover standard):
      10: Tree cover, 20: Shrubland, 30: Grassland, 40: Cropland,
      50: Built-up, 60: Bare/sparse, 80: Permanent water bodies, 90: Wetlands.
    """
    if not os.path.isfile(lc_t1_path) or not os.path.isfile(lc_t2_path):
        raise FileNotFoundError("[RasterOps] Land cover rasters T1 or T2 not found.")

    LC_NAMES = {
        10: "Tree Cover",
        20: "Shrubland",
        30: "Grassland",
        40: "Cropland",
        50: "Built-up",
        60: "Bare/Sparse",
        80: "Water",
        90: "Wetland",
    }

    with rasterio.open(lc_t1_path) as s1, rasterio.open(lc_t2_path) as s2:
        r1 = s1.read(1)
        r2 = s2.read(1)

        valid = (r1 != s1.nodata) & (r2 != s2.nodata) if s1.nodata is not None else np.ones(r1.shape, dtype=bool)

        pixel_area_km2 = (pixel_size_m * pixel_size_m) / 1e6

        transitions = []
        unique_t1 = np.unique(r1[valid])
        unique_t2 = np.unique(r2[valid])

        for c1 in unique_t1:
            for c2 in unique_t2:
                count = int(np.sum((r1 == c1) & (r2 == c2) & valid))
                if count > 0:
                    area_km2 = round(count * pixel_area_km2, 3)
                    c1_name = LC_NAMES.get(int(c1), f"Class_{c1}")
                    c2_name = LC_NAMES.get(int(c2), f"Class_{c2}")
                    transitions.append({
                        "from_class": c1_name,
                        "to_class": c2_name,
                        "pixel_count": count,
                        "area_km2": area_km2,
                        "is_conversion": c1 != c2,
                    })

    return {
        "transitions": transitions,
        "total_transitions": len(transitions),
    }

