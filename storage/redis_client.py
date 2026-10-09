"""
GeoLens AI - Redis Cache Client
===============================
Provides caching mechanisms for API responses and tool results.
"""
import os
import json
from typing import Any, Optional
from dotenv import load_dotenv

load_dotenv()

try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


class RedisClient:
    def __init__(self):
        self.client = None
        self._connected = False
        self._connect()

    def _connect(self):
        if not REDIS_AVAILABLE:
            print("[Redis] redis package not installed.")
            return

        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        try:
            self.client = redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            self.client.ping()
            self._connected = True
            print("[Redis] Connected to cache server.")
        except Exception as e:
            print(f"[Redis] Connection failed: {e}")
            self.client = None
            self._connected = False

    @property
    def is_connected(self) -> bool:
        if not self._connected or self.client is None:
            return False
        try:
            self.client.ping()
            return True
        except Exception:
            self._connected = False
            return False

    def get(self, key: str) -> Optional[Any]:
        if not self.is_connected:
            return None
        try:
            data = self.client.get(key)
            return json.loads(data) if data else None
        except Exception:
            return None

    def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        if not self.is_connected:
            return False
        try:
            self.client.set(key, json.dumps(value, default=str), ex=ttl)
            return True
        except Exception as e:
            print(f"[Redis] Set error: {e}")
            return False

    def delete(self, key: str) -> bool:
        if not self.is_connected:
            return False
        try:
            self.client.delete(key)
            return True
        except Exception:
            return False

    def exists(self, key: str) -> bool:
        if not self.is_connected:
            return False
        try:
            return bool(self.client.exists(key))
        except Exception:
            return False

    def flush_prefix(self, prefix: str = "geolens:") -> int:
        """Delete all keys matching prefix."""
        if not self.is_connected:
            return 0
        try:
            keys = self.client.keys(f"{prefix}*")
            if keys:
                return self.client.delete(*keys)
            return 0
        except Exception:
            return 0

    def stats(self) -> dict:
        if not self.is_connected:
            return {"connected": False}
        try:
            info = self.client.info()
            return {
                "connected": True,
                "used_memory_human": info.get("used_memory_human", "N/A"),
                "connected_clients": info.get("connected_clients", 0),
                "total_keys": self.client.dbsize(),
            }
        except Exception:
            return {"connected": False}

_client = None

def get_redis_client() -> RedisClient:
    global _client
    if _client is None:
        _client = RedisClient()
    return _client
