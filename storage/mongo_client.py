"""
GeoLens AI - MongoDB Client
===========================
Stores unstructured logs and raw JSON output from AI agents.
"""
import os
from datetime import datetime
from typing import Optional, Any
from dotenv import load_dotenv

load_dotenv()

try:
    from pymongo import MongoClient
    MONGO_AVAILABLE = True
except ImportError:
    MONGO_AVAILABLE = False


import re

class MongoDBClient:
    def __init__(self):
        self.client = None
        self.db = None
        self._connected = False
        self._connect()

    def _connect(self):
        if not MONGO_AVAILABLE:
            print("[MongoDB] pymongo package not installed.")
            return

        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        db_name = os.getenv("MONGO_DB_NAME", "geolens_logs")
        
        try:
            self.client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
            self.client.admin.command('ping')
            self.db = self.client[db_name]
            self._connected = True
            self._ensure_indexes()
            print(f"[MongoDB] Connected to database: {db_name}")
        except Exception as e:
            print(f"[MongoDB] Connection failed: {e}")
            self.client = None
            self.db = None
            self._connected = False

    def _ensure_indexes(self):
        """Create standard indexes for rapid query lookup and time-series ordering."""
        if not self._connected or self.db is None:
            return
        try:
            col = self.db["analysis_metadata"]
            col.create_index([("query_id", 1)])
            col.create_index([("timestamp", -1)])
        except Exception as e:
            print(f"[MongoDB] Index creation warning: {e}")

    @property
    def is_connected(self) -> bool:
        if not self._connected or self.client is None:
            return False
        try:
            self.client.admin.command('ping')
            return True
        except Exception:
            self._connected = False
            return False

    def log_unstructured(self, collection_name: str, query_id: str, data: dict) -> bool:
        """Log unstructured JSON data to a MongoDB collection with name sanitization."""
        if not self.is_connected:
            return False
        # Sanitize collection name to prevent unauthorized namespace access
        if not re.match(r"^[a-zA-Z0-9_\-]+$", collection_name):
            print(f"[MongoDB] Invalid collection name rejected: '{collection_name}'")
            return False
        try:
            collection = self.db[collection_name]
            document = {
                "query_id": query_id,
                "timestamp": datetime.now(),
                "data": data
            }
            collection.insert_one(document)
            return True
        except Exception as e:
            print(f"[MongoDB] Insert error: {e}")
            return False

    def get_logs(self, collection_name: str = "analysis_metadata", query_id: Optional[str] = None, limit: int = 50) -> list:
        """Query unstructured logs from a collection, sanitized and formatted."""
        if not self.is_connected:
            return []
        if not re.match(r"^[a-zA-Z0-9_\-]+$", collection_name):
            return []
        try:
            query_filter = {}
            if query_id:
                query_filter["query_id"] = query_id
            cursor = self.db[collection_name].find(query_filter, {"_id": 0}).sort("timestamp", -1).limit(limit)
            return list(cursor)
        except Exception as e:
            print(f"[MongoDB] Read error: {e}")
            return []

    def stats(self) -> dict:
        """Return database operational metrics."""
        if not self.is_connected or self.db is None:
            return {"connected": False}
        try:
            collections = self.db.list_collection_names()
            counts = {c: self.db[c].count_documents({}) for c in collections}
            return {
                "connected": True,
                "database": self.db.name,
                "collections": collections,
                "document_counts": counts,
            }
        except Exception:
            return {"connected": False}

_client = None

def get_mongo_client() -> MongoDBClient:
    global _client
    if _client is None:
        _client = MongoDBClient()
    return _client
