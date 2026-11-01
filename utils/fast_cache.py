import time
import json
import logging
import threading
from typing import Any, Optional, Dict

logger = logging.getLogger("geolens.fast_cache")

class TwoTierCache:
    """
    Ultra-high-speed 2-tier cache for satellite telemetry, imagery tiles, and geocoding.
    - Tier 1: In-Memory thread-safe dictionary (Response time < 0.1ms)
    - Tier 2: Redis distributed cache (Response time ~2ms)
    Provides automatic fallback to in-memory caching when Redis is offline or unavailable.
    """
    def __init__(self, max_memory_entries: int = 2000):
        self._memory_cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._max_entries = max_memory_entries

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        # 1. Tier 1: Memory Lookup
        with self._lock:
            entry = self._memory_cache.get(key)
            if entry:
                if now < entry["expires_at"]:
                    return entry["val"]
                else:
                    del self._memory_cache[key]

        # 2. Tier 2: Redis Lookup
        try:
            from storage.redis_client import get_redis_client
            r = get_redis_client()
            if r and r.is_connected:
                raw = r.get(key)
                if raw:
                    data = json.loads(raw)
                    # Backfill Tier 1 memory cache
                    self.set_memory(key, data, ttl=3600)
                    return data
        except Exception as e:
            logger.debug("Redis cache get error: %s", e)

        return None

    def set_memory(self, key: str, val: Any, ttl: int = 86400):
        with self._lock:
            # Enforce capacity
            if len(self._memory_cache) >= self._max_entries:
                # Evict 20% oldest entries
                sorted_keys = sorted(self._memory_cache.keys(), key=lambda k: self._memory_cache[k]["expires_at"])
                for old_k in sorted_keys[:int(self._max_entries * 0.2)]:
                    self._memory_cache.pop(old_k, None)

            self._memory_cache[key] = {
                "val": val,
                "expires_at": time.time() + ttl
            }

    def set(self, key: str, val: Any, ttl: int = 86400):
        if val is None:
            return
        # If val is an error response dict, do not cache
        if isinstance(val, dict) and val.get("error"):
            return

        # 1. Set Memory
        self.set_memory(key, val, ttl)

        # 2. Set Redis
        try:
            from storage.redis_client import get_redis_client
            r = get_redis_client()
            if r and r.is_connected:
                r.set(key, json.dumps(val), ex=ttl)
        except Exception as e:
            logger.debug("Redis cache set error: %s", e)

    def clear(self, prefix: Optional[str] = None):
        with self._lock:
            if prefix:
                keys_to_del = [k for k in self._memory_cache if k.startswith(prefix)]
                for k in keys_to_del:
                    del self._memory_cache[k]
            else:
                self._memory_cache.clear()

        try:
            from storage.redis_client import get_redis_client
            r = get_redis_client()
            if r and r.is_connected:
                if prefix:
                    for k in r.scan_iter(f"{prefix}*"):
                        r.delete(k)
                else:
                    r.flushdb()
        except Exception:
            pass

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            active_count = sum(1 for entry in self._memory_cache.values() if time.time() < entry["expires_at"])
        return {
            "tier1_memory_entries": active_count,
            "max_capacity": self._max_entries,
            "status": "active"
        }

# Global singleton instance
fast_cache = TwoTierCache()
