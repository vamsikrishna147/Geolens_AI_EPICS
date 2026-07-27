"""
GeoLens AI - Storage Manager
==============================
Central router for all data storage operations.
Agents call StorageManager instead of directly accessing databases.
Routes data to the correct storage backend based on data type.

Storage routing:
  GeoJSON / Vector    → PostGIS geo_features table
  JSON metadata/logs  → PostGIS analysis_results table (+ local fallback)
  Raw files (raster)  → Local ./data/ directory + indexed in PostGIS
  Query logs          → PostGIS query_log table
"""

import json
import os
import uuid
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from storage.postgis_client import get_postgis_client
from storage.mongo_client import get_mongo_client

load_dotenv()


class StorageManager:
    """
    Central storage router for GeoLens AI.

    Usage:
        storage = StorageManager(query_id="abc123")
        storage.save_geojson(data, source="osm", feature_type="boundary")
        storage.save_metadata(data, result_type="weather_summary")
        path = storage.get_file_path("rasters", "sentinel2_ndvi.tif")
        storage.index_file(path, source="sentinel2", file_type="geotiff")
    """

    def __init__(self, query_id: Optional[str] = None):
        """
        Initialize the StorageManager.

        Args:
            query_id: Unique ID for the current analysis query.
                      Auto-generated if not provided.
        """
        self.query_id = query_id or f"q_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
        self.db = get_postgis_client()
        self.mongo = get_mongo_client()
        self.data_root = os.path.abspath(os.getenv("DATA_STORAGE_PATH", "./data"))
        self._ensure_data_dirs()

    def _ensure_data_dirs(self) -> None:
        """Create all necessary data subdirectories."""
        subdirs = [
            "boundaries", "rasters", "weather", "fire",
            "screenshots", "research", "soil", "population",
            "osm", "india_gov", "gee", "db_fallback",
        ]
        for subdir in subdirs:
            os.makedirs(os.path.join(self.data_root, subdir), exist_ok=True)

    def log_query(self, user_query: str, location: str = "", time_period: str = "") -> str:
        """
        Log a new user query and return the query_id.

        Args:
            user_query: Original user query text.
            location: Resolved location string.
            time_period: Time period for the analysis.

        Returns:
            The query_id for this session.
        """
        self.db.log_query(self.query_id, user_query, location, time_period)
        return self.query_id

    def save_geojson(
        self,
        geojson: dict,
        source: str,
        feature_type: str,
        also_save_file: bool = True,
    ) -> dict:
        """
        Save GeoJSON data to PostGIS and optionally to a local file.

        Args:
            geojson: GeoJSON FeatureCollection or Feature.
            source: Data source name (e.g. "nasa_firms", "osm", "gadm").
            feature_type: Type of feature (e.g. "fire_point", "boundary").
            also_save_file: Also write to a local .geojson file.

        Returns:
            Dict with saved_to_db (bool), saved_to_file (str|None), count (int).
        """
        # Save to PostGIS
        count = self.db.save_geojson(geojson, source, feature_type, self.query_id)

        # Also save locally
        file_path = None
        if also_save_file:
            folder = self._folder_for_source(source)
            filename = f"{source}_{feature_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.geojson"
            file_path = os.path.join(self.data_root, folder, filename)
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(geojson, f, indent=2)
            self.db.index_file(self.query_id, source, "geojson", file_path, {"feature_type": feature_type, "count": count})

        return {"saved_to_db": self.db.is_connected, "saved_to_file": file_path, "count": count}

    def save_metadata(self, data: dict, result_type: str, also_save_file: bool = True) -> dict:
        """
        Save JSON metadata/results to PostGIS and optionally to a local file.

        Args:
            data: Dictionary of metadata/results to save.
            result_type: Category of result (e.g. "weather_summary", "fire_report").
            also_save_file: Also write to a local JSON file.

        Returns:
            Dict with saved_to_db (bool) and saved_to_file (str|None).
        """
        # Add standard metadata
        data["_query_id"] = self.query_id
        data["_saved_at"] = datetime.now().isoformat()
        data["_result_type"] = result_type

        self.db.save_result(self.query_id, result_type, data)
        self.mongo.log_unstructured("analysis_metadata", self.query_id, data)

        file_path = None
        if also_save_file:
            folder = self._folder_for_result_type(result_type)
            filename = f"{result_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            file_path = os.path.join(self.data_root, folder, filename)
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)

        return {"saved_to_db": self.db.is_connected, "saved_to_file": file_path}

    def get_file_path(self, subfolder: str, filename: str) -> str:
        """
        Get the full path for a file in the data directory.

        Args:
            subfolder: Subfolder under data root (e.g. "rasters", "fire").
            filename: Filename (e.g. "sentinel2_ndvi.tif").

        Returns:
            Absolute file path.
        """
        folder = os.path.join(self.data_root, subfolder)
        os.makedirs(folder, exist_ok=True)
        return os.path.join(folder, filename)

    def index_file(self, file_path: str, source: str, file_type: str, metadata: dict = None) -> bool:
        """
        Register a downloaded file in the PostGIS data_files index.

        Args:
            file_path: Absolute path to the file.
            source: Data source name.
            file_type: File type (e.g. "geotiff", "csv", "screenshot").
            metadata: Optional metadata dict.

        Returns:
            True if indexed successfully.
        """
        return self.db.index_file(self.query_id, source, file_type, file_path, metadata or {})

    def _folder_for_source(self, source: str) -> str:
        """Map a source name to a local data subfolder."""
        mapping = {
            "nasa_firms": "fire",
            "open_meteo": "weather",
            "nasa_power": "weather",
            "osm": "osm",
            "overpass": "osm",
            "gadm": "boundaries",
            "natural_earth": "boundaries",
            "soilgrids": "soil",
            "worldpop": "population",
            "india_gov": "india_gov",
            "gee": "gee",
            "screenshot": "screenshots",
            "openalex": "research",
        }
        return mapping.get(source.lower(), "db_fallback")

    def _folder_for_result_type(self, result_type: str) -> str:
        """Map a result type to a local data subfolder."""
        mapping = {
            "weather_summary": "weather",
            "fire_report": "fire",
            "boundary_info": "boundaries",
            "soil_report": "soil",
            "population_report": "population",
            "research_results": "research",
            "india_gov_data": "india_gov",
        }
        return mapping.get(result_type.lower(), "db_fallback")

    @property
    def status_summary(self) -> str:
        """Return a short status string about storage configuration."""
        status = []
        status.append("PostGIS connected" if self.db.is_connected else "File-only mode (PostGIS not connected)")
        status.append("MongoDB connected" if self.mongo.is_connected else "MongoDB not connected")
        status.append(f"Local data: {self.data_root}")
        return " | ".join(status)
