"""
GeoLens AI - PostgreSQL + PostGIS Client
==========================================
Manages the connection to the PostGIS database and provides
helper methods for storing geospatial vector data, query logs,
and analysis results.

Falls back gracefully to local JSON/GeoJSON files if PostGIS
is not configured or unavailable.
"""

import json
import os
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv

load_dotenv()

# PostGIS is optional — import psycopg2 gracefully
try:
    import psycopg2
    import psycopg2.extras
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False


class PostGISClient:
    """
    PostgreSQL + PostGIS client for GeoLens AI.

    Handles:
    - Storing GeoJSON features as PostGIS geometries
    - Logging queries and analysis results
    - Storing vector data (fire points, boundaries, OSM features, flood polygons)
    - Falling back to local files when DB is unavailable
    """

    # SQL to create core GeoLens tables
    INIT_SQL = """
    -- Enable PostGIS
    CREATE EXTENSION IF NOT EXISTS postgis;

    -- Query log table
    CREATE TABLE IF NOT EXISTS query_log (
        id          SERIAL PRIMARY KEY,
        query_id    TEXT NOT NULL,
        user_query  TEXT,
        location    TEXT,
        time_period TEXT,
        created_at  TIMESTAMP DEFAULT NOW()
    );

    -- Geospatial features table (all vector data goes here)
    CREATE TABLE IF NOT EXISTS geo_features (
        id          SERIAL PRIMARY KEY,
        query_id    TEXT,
        source      TEXT NOT NULL,         -- e.g. "nasa_firms", "osm", "gadm"
        feature_type TEXT NOT NULL,        -- e.g. "fire_point", "boundary", "road"
        properties  JSONB,                 -- all attribute data
        geom        GEOMETRY,              -- PostGIS geometry (any type)
        collected_at TIMESTAMP DEFAULT NOW()
    );

    -- Spatial index on geometry
    CREATE INDEX IF NOT EXISTS idx_geo_features_geom
        ON geo_features USING GIST(geom);

    -- Index on source and query_id
    CREATE INDEX IF NOT EXISTS idx_geo_features_source
        ON geo_features(source, query_id);

    -- Analysis results table
    CREATE TABLE IF NOT EXISTS analysis_results (
        id          SERIAL PRIMARY KEY,
        query_id    TEXT NOT NULL,
        result_type TEXT NOT NULL,         -- e.g. "dataset_recommendation", "weather_summary"
        result_data JSONB NOT NULL,
        created_at  TIMESTAMP DEFAULT NOW()
    );

    -- Downloaded files index
    CREATE TABLE IF NOT EXISTS data_files (
        id          SERIAL PRIMARY KEY,
        query_id    TEXT,
        source      TEXT NOT NULL,
        file_type   TEXT NOT NULL,         -- "geotiff", "csv", "geojson", "screenshot"
        file_path   TEXT NOT NULL,
        metadata    JSONB,
        created_at  TIMESTAMP DEFAULT NOW()
    );
    """

    def __init__(self):
        self.conn = None
        self._connected = False
        self._fallback_dir = os.path.join(
            os.getenv("DATA_STORAGE_PATH", "./data"), "db_fallback"
        )
        os.makedirs(self._fallback_dir, exist_ok=True)
        self._connect()

    def _connect(self) -> bool:
        """Attempt to connect to PostGIS. Returns True if successful."""
        if not PSYCOPG2_AVAILABLE:
            print("[PostGIS] psycopg2 not installed — using file fallback")
            print("[PostGIS] Install: pip install psycopg2-binary")
            return False

        pg_pass = os.getenv("POSTGIS_PASSWORD", "")
        if not pg_pass or pg_pass == "your_postgres_password_here":
            print("[PostGIS] No password configured — using file fallback")
            print("[PostGIS] Set POSTGIS_PASSWORD in .env to enable DB storage")
            return False

        try:
            self.conn = psycopg2.connect(
                host=os.getenv("POSTGIS_HOST", "localhost"),
                port=int(os.getenv("POSTGIS_PORT", "5432")),
                dbname=os.getenv("POSTGIS_DB", "geolens"),
                user=os.getenv("POSTGIS_USER", "postgres"),
                password=pg_pass,
                connect_timeout=5,
            )
            self.conn.autocommit = True
            self._initialize_tables()
            self._connected = True
            print(f"[PostGIS] Connected to {os.getenv('POSTGIS_DB', 'geolens')} database")
            return True
        except Exception as e:
            print(f"[PostGIS] Connection failed: {e}")
            print("[PostGIS] Falling back to local file storage")
            self.conn = None
            return False

    def _initialize_tables(self) -> None:
        """Create GeoLens tables if they don't exist."""
        with self.conn.cursor() as cur:
            cur.execute(self.INIT_SQL)

    @property
    def is_connected(self) -> bool:
        """Check if PostGIS connection is active."""
        if self.conn is None:
            return False
        try:
            self.conn.cursor().execute("SELECT 1")
            return True
        except Exception:
            self._connect()
            return self._connected

    def log_query(self, query_id: str, user_query: str, location: str = "", time_period: str = "") -> bool:
        """Log a user query to the database."""
        if not self.is_connected:
            return self._fallback_write("queries", query_id, {
                "query_id": query_id,
                "user_query": user_query,
                "location": location,
                "time_period": time_period,
            })
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO query_log (query_id, user_query, location, time_period)
                       VALUES (%s, %s, %s, %s)""",
                    (query_id, user_query, location, time_period),
                )
            return True
        except Exception as e:
            print(f"[PostGIS] Failed to log query: {e}")
            return False

    def save_geojson(
        self,
        geojson: dict,
        source: str,
        feature_type: str,
        query_id: str = "",
    ) -> int:
        """
        Save a GeoJSON FeatureCollection to the geo_features table.

        Args:
            geojson: GeoJSON FeatureCollection or Feature dict.
            source: Data source name (e.g. "nasa_firms", "osm").
            feature_type: Type of feature (e.g. "fire_point", "boundary").
            query_id: Query ID to associate with this data.

        Returns:
            Number of features saved.
        """
        # Extract features list
        if geojson.get("type") == "FeatureCollection":
            features = geojson.get("features", [])
        elif geojson.get("type") == "Feature":
            features = [geojson]
        else:
            features = []

        if not features:
            return 0

        # File fallback
        if not self.is_connected:
            self._fallback_write(f"geojson/{source}", query_id or source, geojson)
            return len(features)

        count = 0
        try:
            with self.conn.cursor() as cur:
                for feature in features:
                    geometry = feature.get("geometry")
                    properties = feature.get("properties", {})
                    if not geometry:
                        continue
                    cur.execute(
                        """INSERT INTO geo_features
                               (query_id, source, feature_type, properties, geom)
                           VALUES (%s, %s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326))""",
                        (
                            query_id,
                            source,
                            feature_type,
                            json.dumps(properties),
                            json.dumps(geometry),
                        ),
                    )
                    count += 1
            print(f"[PostGIS] Saved {count} {feature_type} features from {source}")
        except Exception as e:
            print(f"[PostGIS] Error saving GeoJSON: {e}")
            self._fallback_write(f"geojson/{source}", query_id or source, geojson)
            count = len(features)

        return count

    def save_result(self, query_id: str, result_type: str, data: dict) -> bool:
        """Save an analysis result (JSON) to the analysis_results table."""
        if not self.is_connected:
            return self._fallback_write(f"results/{result_type}", query_id, data)
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO analysis_results (query_id, result_type, result_data)
                       VALUES (%s, %s, %s)""",
                    (query_id, result_type, json.dumps(data)),
                )
            return True
        except Exception as e:
            print(f"[PostGIS] Failed to save result: {e}")
            return self._fallback_write(f"results/{result_type}", query_id, data)

    def index_file(self, query_id: str, source: str, file_type: str, file_path: str, metadata: dict = None) -> bool:
        """Register a downloaded file in the data_files index table."""
        if not self.is_connected:
            return True  # No-op if no DB
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO data_files (query_id, source, file_type, file_path, metadata)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (query_id, source, file_type, file_path, json.dumps(metadata or {})),
                )
            return True
        except Exception as e:
            print(f"[PostGIS] Failed to index file: {e}")
            return False

    def query_features(
        self, source: str = None, feature_type: str = None, query_id: str = None, limit: int = 100
    ) -> list:
        """Query stored features from the database."""
        if not self.is_connected:
            return []
        try:
            conditions = []
            params = []
            if source:
                conditions.append("source = %s")
                params.append(source)
            if feature_type:
                conditions.append("feature_type = %s")
                params.append(feature_type)
            if query_id:
                conditions.append("query_id = %s")
                params.append(query_id)

            where = f"WHERE {' AND '.join(conditions)}" if conditions else ""
            params.append(limit)

            with self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    f"""SELECT id, query_id, source, feature_type, properties,
                               ST_AsGeoJSON(geom) as geometry, collected_at
                        FROM geo_features {where}
                        ORDER BY collected_at DESC LIMIT %s""",
                    params,
                )
                return [dict(row) for row in cur.fetchall()]
        except Exception as e:
            print(f"[PostGIS] Query error: {e}")
            return []

    def _fallback_write(self, subfolder: str, filename: str, data: dict) -> bool:
        """Write data to a local JSON file as fallback when DB is unavailable."""
        safe_filename = str(filename).replace("/", "_").replace("\\", "_")
        folder = os.path.join(self._fallback_dir, subfolder)
        os.makedirs(folder, exist_ok=True)
        filepath = os.path.join(folder, f"{safe_filename}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)
            return True
        except Exception as e:
            print(f"[PostGIS Fallback] Failed to write file: {e}")
            return False

    def close(self):
        """Close the database connection."""
        if self.conn:
            self.conn.close()
            self.conn = None
            self._connected = False


# Singleton instance
_client: Optional[PostGISClient] = None


def get_postgis_client() -> PostGISClient:
    """Get or create the singleton PostGIS client."""
    global _client
    if _client is None:
        _client = PostGISClient()
    return _client
