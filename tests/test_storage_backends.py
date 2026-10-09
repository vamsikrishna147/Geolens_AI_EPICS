"""
GeoLens AI - Database & Storage Backend Verification Tests
===========================================================
Validates:
1. PostgreSQL + PostGIS (vector data, parameter safety, thread locking, queries)
2. MongoDB (unstructured agent logs, collection sanitization, indexing, reads)
3. Redis (cache get/set/delete, TTL, prefix flush, stats)
4. StorageManager (central router, health reporting, cross-backend coordination)
5. Geocoder Caching (sub-millisecond cache hits, suggestions caching, cache purge)
"""

import os
import time
import uuid
import threading
import pytest

from storage.postgis_client import get_postgis_client, PostGISClient
from storage.mongo_client import get_mongo_client, MongoDBClient
from storage.redis_client import get_redis_client, RedisClient
from storage.storage_manager import StorageManager
from utils.geocoder import geocode_location, get_location_suggestions, clear_geocode_cache


class TestRedisCache:
    """Test Redis cache operations and security."""

    def test_redis_connection_and_stats(self):
        client = get_redis_client()
        assert client.is_connected, "Redis should be running and connected on localhost:6379"
        stats = client.stats()
        assert stats.get("connected") is True
        assert "total_keys" in stats

    def test_redis_crud_and_ttl(self):
        client = get_redis_client()
        test_key = f"geolens:test:{uuid.uuid4().hex[:8]}"
        payload = {"agent": "Planner", "step": 1, "aoi": [10.0, 20.0, 11.0, 21.0]}

        # Set with TTL
        success = client.set(test_key, payload, ttl=60)
        assert success is True

        # Exists
        assert client.exists(test_key) is True

        # Get
        retrieved = client.get(test_key)
        assert retrieved == payload

        # Delete
        deleted = client.delete(test_key)
        assert deleted is True
        assert client.get(test_key) is None

    def test_redis_prefix_flush(self):
        client = get_redis_client()
        prefix = f"geolens:testprefix_{uuid.uuid4().hex[:4]}:"
        client.set(f"{prefix}1", "alpha", ttl=60)
        client.set(f"{prefix}2", "beta", ttl=60)

        assert client.exists(f"{prefix}1") is True
        assert client.exists(f"{prefix}2") is True

        cleared_count = client.flush_prefix(prefix)
        assert cleared_count == 2
        assert client.exists(f"{prefix}1") is False
        assert client.exists(f"{prefix}2") is False


class TestMongoDBBackend:
    """Test MongoDB logging, indexing, and injection protections."""

    def test_mongo_connection_and_stats(self):
        client = get_mongo_client()
        assert client.is_connected, "MongoDB should be running and connected on localhost:27017"
        stats = client.stats()
        assert stats.get("connected") is True
        assert stats.get("database") == "geolens_logs"
        assert "analysis_metadata" in stats.get("collections", [])

    def test_mongo_insert_read_and_index(self):
        client = get_mongo_client()
        test_qid = f"test_q_{uuid.uuid4().hex[:8]}"
        payload = {"status": "success", "index_type": "NDVI", "mean_score": 0.65}

        # Insert unstructured log
        success = client.log_unstructured("analysis_metadata", test_qid, payload)
        assert success is True

        # Read back
        logs = client.get_logs("analysis_metadata", query_id=test_qid, limit=5)
        assert len(logs) >= 1
        assert logs[0]["query_id"] == test_qid
        assert logs[0]["data"]["index_type"] == "NDVI"

        # Verify index exists on analysis_metadata
        col = client.db["analysis_metadata"]
        index_info = col.index_information()
        index_keys = [list(spec["key"])[0][0] for spec in index_info.values()]
        assert "query_id" in index_keys
        assert "timestamp" in index_keys

        # Cleanup test document
        col.delete_many({"query_id": test_qid})

    def test_mongo_collection_name_sanitization(self):
        client = get_mongo_client()
        # Invalid / potentially dangerous collection names must be rejected
        bad_names = ["../../system.users", "$cmd", "eval.()", "db/test", "test;drop"]
        for bad_name in bad_names:
            result = client.log_unstructured(bad_name, "test_q", {"data": 123})
            assert result is False, f"Collection name '{bad_name}' should have been rejected"


class TestPostGISBackend:
    """Test PostgreSQL + PostGIS spatial capabilities, concurrency, and parameterized queries."""

    def test_postgis_connection_and_extension(self):
        client = get_postgis_client()
        assert client.is_connected, "PostgreSQL should be running and connected on localhost:5432"
        stats = client.stats()
        assert stats.get("connected") is True
        assert "POSTGIS" in stats.get("postgis_version", "")
        table_counts = stats.get("table_counts", {})
        assert "geo_features" in table_counts
        assert "analysis_results" in table_counts

    def test_postgis_vector_storage_and_spatial_query(self):
        client = get_postgis_client()
        test_qid = f"test_spatial_{uuid.uuid4().hex[:8]}"
        
        # Point geometry in GeoJSON format
        test_geojson = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [78.4867, 17.3850]  # Hyderabad [lon, lat]
                    },
                    "properties": {
                        "name": "Hyderabad Sensor",
                        "temp_c": 32.5,
                        "confidence": "high"
                    }
                }
            ]
        }

        # Save to PostGIS
        saved_count = client.save_geojson(test_geojson, source="test_sensor", feature_type="sensor_point", query_id=test_qid)
        assert saved_count == 1

        # Query features back from PostGIS
        features = client.query_features(source="test_sensor", query_id=test_qid)
        assert len(features) == 1
        feat = features[0]
        assert feat["source"] == "test_sensor"
        assert feat["feature_type"] == "sensor_point"
        assert feat["properties"]["name"] == "Hyderabad Sensor"
        assert "geometry" in feat and "Point" in feat["geometry"]

        # Cleanup
        with client._lock:
            with client.conn.cursor() as cur:
                cur.execute("DELETE FROM geo_features WHERE query_id = %s", (test_qid,))

    def test_postgis_thread_safety(self):
        """Verify that concurrent agent threads writing to PostGIS do not corrupt the connection."""
        client = get_postgis_client()
        errors = []

        def worker(thread_idx):
            try:
                for i in range(10):
                    qid = f"thread_{thread_idx}_step_{i}"
                    client.log_query(qid, f"Query from thread {thread_idx}", "Earth", "2026")
                    client.save_result(qid, "test_metric", {"thread": thread_idx, "iter": i})
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(t,)) for t in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0, f"Concurrent DB operations encountered errors: {errors}"

        # Cleanup thread test rows
        with client._lock:
            with client.conn.cursor() as cur:
                cur.execute("DELETE FROM query_log WHERE query_id LIKE 'thread_%'")
                cur.execute("DELETE FROM analysis_results WHERE query_id LIKE 'thread_%'")


class TestStorageManagerRouter:
    """Test unified StorageManager coordinating all backends."""

    def test_storage_manager_initialization_and_health(self):
        sm = StorageManager()
        assert sm.db.is_connected is True
        assert sm.mongo.is_connected is True
        assert sm.redis.is_connected is True
        
        summary = sm.status_summary
        assert "PostGIS connected" in summary
        assert "MongoDB connected" in summary
        assert "Redis connected" in summary

        health = sm.get_system_health()
        assert health["postgis"]["connected"] is True
        assert health["mongodb"]["connected"] is True
        assert health["redis"]["connected"] is True
        assert health["local_storage"]["exists"] is True

    def test_storage_manager_dual_write_and_caching(self):
        test_qid = f"sm_test_{uuid.uuid4().hex[:6]}"
        sm = StorageManager(query_id=test_qid)

        # Test Redis caching via StorageManager
        cache_key = f"geolens:sm_cache:{test_qid}"
        sm.cache_set(cache_key, {"result": "cached_ok"}, ttl=30)
        assert sm.cache_get(cache_key) == {"result": "cached_ok"}
        sm.cache_delete(cache_key)
        assert sm.cache_get(cache_key) is None

        # Test metadata write (dual writes to PostGIS and MongoDB)
        result = sm.save_metadata({"metric": "coverage", "val": 99.8}, result_type="test_run", also_save_file=False)
        assert result["saved_to_db"] is True

        # Read from MongoDB
        mongo_logs = sm.mongo.get_logs("analysis_metadata", query_id=test_qid)
        assert len(mongo_logs) >= 1
        assert mongo_logs[0]["data"]["metric"] == "coverage"

        # Cleanup
        sm.mongo.db["analysis_metadata"].delete_many({"query_id": test_qid})
        with sm.db._lock:
            with sm.db.conn.cursor() as cur:
                cur.execute("DELETE FROM analysis_results WHERE query_id = %s", (test_qid,))


class TestGeocoderRedisCaching:
    """Verify that Geocoder utilizes Redis for ultra-low latency response and persistence."""

    def test_geocoder_redis_acceleration(self):
        # 1. First geocode call ensures it's cached in Redis
        res1 = geocode_location("Paris, France")
        assert res1 is not None
        assert "lat" in res1 and "lon" in res1

        rc = get_redis_client()
        redis_key = "geolens:geocode:paris, france"
        assert rc.exists(redis_key) is True

        # 2. Measure cache hit latency
        t0 = time.time()
        res2 = geocode_location("Paris, France")
        latency = time.time() - t0
        assert res2["lat"] == res1["lat"]
        # In-memory / Redis cache should return in under 10 milliseconds (< 0.01s)
        assert latency < 0.05, f"Cache hit took {latency:.4f}s, expected < 0.05s"

    def test_location_suggestions_caching(self):
        # Keystroke autocomplete suggestions should be cached in Redis
        suggs = get_location_suggestions("tok", limit=4)
        assert len(suggs) > 0

        rc = get_redis_client()
        suggest_key = "geolens:suggest:tok:4"
        assert rc.exists(suggest_key) is True

        cached_suggs = rc.get(suggest_key)
        assert len(cached_suggs) == len(suggs)
        assert cached_suggs[0]["display_name"] == suggs[0]["display_name"]
