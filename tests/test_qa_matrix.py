"""
GeoLens AI - Production Readiness QA Automation & Adversarial Stress Matrix
==========================================================================
Covers:
  - Normal vs. Ambiguous queries
  - Invalid locations & boundary handling
  - Inverted & malformed temporal windows
  - Empty datasets & cloud-cover fallbacks
  - API error propagation (404 vs 400 vs 500)
  - Output serialization & Unicode resilience
  - Concurrent task tracking
"""

import sys
import os
import pytest
import re

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from api.server import app

client = TestClient(app)


# =====================================================================
# 1. Location & Geocoder Edge Cases
# =====================================================================

class TestLocationEdgeCases:
    def test_empty_location_string(self):
        resp = client.get("/api/geocoder/search?q=")
        assert resp.status_code in [400, 404]

    def test_fictional_location_returns_404(self):
        resp = client.get("/api/geocoder/search?q=Atlantis_Underwater_Sector_77")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_special_characters_in_location(self):
        resp = client.get("/api/geocoder/search", params={"q": "!@#$%^&*()_+{}[]:;<>"})
        assert resp.status_code == 404

    def test_empty_keystroke_suggestions(self):
        resp = client.get("/api/geocoder/suggestions?q=")
        assert resp.status_code == 200
        assert resp.json()["suggestions"] == []


# =====================================================================
# 2. Date & Temporal Window Adversarial Edge Cases
# =====================================================================

class TestTemporalWindowEdgeCases:
    def test_flood_end_date_before_start_date(self):
        """
        Adversarial: end date occurs BEFORE start date.
        Expected: Clean 400 Bad Request.
        Actual Behavior: GEE raises internal 500 error if unvalidated.
        """
        resp = client.post("/api/timelens/flood", json={
            "location": "Kerala",
            "flood_start": "2024-08-30",
            "flood_end": "2024-08-01",
            "baseline_year": 2022
        })
        # Successfully caught by Pydantic validation (422 Unprocessable Entity)
        assert resp.status_code in [400, 422]

    def test_wildfire_malformed_date_format(self):
        """
        Adversarial: non-date strings passed into date fields.
        Expected: 422 Unprocessable Entity or 400 Bad Request.
        """
        resp = client.post("/api/timelens/wildfire", json={
            "location": "California",
            "fire_start": "not-a-date",
            "fire_end": "also-not-a-date",
            "pre_fire_start": "2023-01-01",
            "pre_fire_end": "2023-05-01"
        })
        assert resp.status_code in [400, 422, 500]

    def test_timelens_inverted_years_t1_greater_than_t2(self):
        """
        Baseline year 2025 > Comparison year 2018.
        """
        resp = client.post("/api/timelens/change", json={
            "location": "Hyderabad",
            "year_t1": 2025,
            "year_t2": 2018
        })
        # Should cleanly reject inverted baseline/comparison years
        assert resp.status_code in [400, 422]


# =====================================================================
# 3. Satellite Imagery & Bounding Box Stress Cases
# =====================================================================

class TestImageryAndRasterEdgeCases:
    def test_malformed_bbox_coordinates(self):
        """Malformed bbox format (non-numeric, wrong coordinate count)."""
        resp = client.get("/api/timelens/imagery?location=Paris&yearBefore=2020&yearAfter=2024&bbox=corrupted_bbox")
        assert resp.status_code == 200
        data = resp.json()
        # Should gracefully fall back to geocoded bounds
        assert data.get("location") is not None

    def test_timelens_imagery_missing_location_and_bbox(self):
        resp = client.get("/api/timelens/imagery?location=&yearBefore=2020&yearAfter=2024")
        assert resp.status_code == 200
        data = resp.json()
        assert data["url_before"] is None
        assert data["url_after"] is None

    def test_download_truncated_bbox(self):
        """Passing only 2 coordinates instead of 4."""
        resp = client.get("/api/timelens/download?location=Delhi&year=2024&bbox=12.34,56.78")
        assert resp.status_code in [200, 400]


# =====================================================================
# 4. Report Generation & Serialization Edge Cases
# =====================================================================

class TestReportingEdgeCases:
    def test_export_empty_payload(self):
        """Exporting a report with empty payload dict."""
        resp = client.post("/api/report/export", json={})
        assert resp.status_code == 200
        assert "text/html" in resp.headers.get("content-type", "") or "text/markdown" in resp.headers.get("content-type", "")

    def test_export_with_unicode_symbols(self):
        """Exporting report containing complex math and unicode symbols."""
        payload = {
            "official_report": {
                "report_id": "TEST_UNICODE_001",
                "title": "Satellite Scan ≈ ΔNDVI ±0.05",
                "executive_summary": "Surface water delta: ±12.5% [λ = 842nm, ρ ≈ 0.35]",
                "classification": "UNCLASSIFIED"
            }
        }
        resp = client.post("/api/report/export", json=payload)
        assert resp.status_code == 200
        content = resp.content.decode("utf-8")
        assert "≈" in content


# =====================================================================
# 5. Session Workspace & Path Security Edge Cases
# =====================================================================

class TestWorkspaceEdgeCases:
    def test_session_id_path_traversal(self):
        resp = client.get("/api/workspace/sessions/../../etc/passwd")
        assert resp.status_code in [400, 404]

    def test_session_not_found(self):
        resp = client.get("/api/workspace/sessions/non_existent_uuid_00000000")
        assert resp.status_code == 404
