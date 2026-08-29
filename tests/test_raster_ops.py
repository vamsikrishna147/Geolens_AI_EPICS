"""
Test Suite: Phase 4 Advanced Raster GIS Algorithms
=====================================================
Validates compute_raster_difference, compute_nbr, and compute_land_cover_transition.
"""

import sys
import os
import numpy as np
import rasterio
from rasterio.transform import from_origin

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from utils.raster_ops import (
    compute_raster_difference,
    compute_nbr,
    compute_land_cover_transition,
)


def _create_synthetic_raster(path: str, data: np.ndarray):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    transform = from_origin(80.0, 16.0, 0.0001, 0.0001)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=data.shape[0],
        width=data.shape[1],
        count=1,
        dtype=data.dtype,
        crs="EPSG:4326",
        transform=transform,
        nodata=-9999,
    ) as dst:
        dst.write(data, 1)


def test_raster_difference():
    print("Testing compute_raster_difference...")
    t1_path = "storage/test_scratch/t1.tif"
    t2_path = "storage/test_scratch/t2.tif"

    d1 = np.ones((50, 50), dtype=np.float32) * 0.7  # Healthy NDVI
    d2 = np.ones((50, 50), dtype=np.float32) * 0.2  # Deforested NDVI

    _create_synthetic_raster(t1_path, d1)
    _create_synthetic_raster(t2_path, d2)

    diff_res = compute_raster_difference(t1_path, t2_path)
    assert abs(diff_res["mean_delta"] - (-0.5)) < 0.01
    assert diff_res["significant_change_pct"] == 100.0
    print("  [OK] compute_raster_difference verified successfully.")


def test_nbr():
    print("Testing compute_nbr...")
    nir_path = "storage/test_scratch/nir.tif"
    swir_path = "storage/test_scratch/swir.tif"
    out_path = "storage/test_scratch/nbr.tif"

    nir = np.ones((50, 50), dtype=np.float32) * 0.8
    swir = np.ones((50, 50), dtype=np.float32) * 0.2

    _create_synthetic_raster(nir_path, nir)
    _create_synthetic_raster(swir_path, swir)

    res_path = compute_nbr(nir_path, swir_path, output_path=out_path)
    assert os.path.exists(res_path)
    with rasterio.open(res_path) as src:
        data = src.read(1)
        # NBR = (0.8 - 0.2) / (0.8 + 0.2) = 0.6
        assert abs(np.nanmean(data) - 0.6) < 0.01
    print("  [OK] compute_nbr verified successfully.")


def test_land_cover_transition():
    print("Testing compute_land_cover_transition...")
    lc1_path = "storage/test_scratch/lc1.tif"
    lc2_path = "storage/test_scratch/lc2.tif"

    lc1 = np.ones((50, 50), dtype=np.int16) * 10  # Tree cover
    lc2 = np.ones((50, 50), dtype=np.int16) * 50  # Converted to Built-up

    _create_synthetic_raster(lc1_path, lc1)
    _create_synthetic_raster(lc2_path, lc2)

    res = compute_land_cover_transition(lc1_path, lc2_path)
    assert res["total_transitions"] == 1
    assert res["transitions"][0]["from_class"] == "Tree Cover"
    assert res["transitions"][0]["to_class"] == "Built-up"
    assert res["transitions"][0]["is_conversion"] == True
    print("  [OK] compute_land_cover_transition verified successfully.")


if __name__ == "__main__":
    test_raster_difference()
    test_nbr()
    test_land_cover_transition()
    print("\n[SUCCESS] All Phase 4 Raster GIS Algorithms tested successfully!")
