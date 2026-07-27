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
            print(f"[MongoDB] Connected to database: {db_name}")
        except Exception as e:
            print(f"[MongoDB] Connection failed: {e}")
            self.client = None
            self.db = None

    @property
    def is_connected(self) -> bool:
        return self._connected

    def log_unstructured(self, collection_name: str, query_id: str, data: dict) -> bool:
        """Log unstructured JSON data to a MongoDB collection."""
        if not self.is_connected:
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

_client = None

def get_mongo_client() -> MongoDBClient:
    global _client
    if _client is None:
        _client = MongoDBClient()
    return _client
