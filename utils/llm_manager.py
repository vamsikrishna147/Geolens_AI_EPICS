"""
GeoLens AI - Multi-Provider Round-Robin LLM Manager
===================================================
Phase 6.4 — Rate-Limit Resilience & Multi-Provider Load Balancing

Manages an intelligent round-robin pool across:
  - Groq Cloud API (Llama 3.3 70B — ultra high-speed inference)
  - Google Gemini API (Triple-key rotation for large context & multimodality)

Features:
  - Per-slot RPM/RPD tracking and token budget enforcement
  - Automatic failover: if any key hits 429, instantly rotates to the next available slot
  - Exponential backoff ONLY when ALL slots in the pool are exhausted
  - Thread-safe rotation for concurrent CrewAI agents
  - Detailed diagnostic telemetry for the /api/admin/system and /api/telemetry portals

Usage in crew:
    from utils.llm_manager import get_llm
    llm = get_llm()   # returns the next available healthy LLM
"""

import os
import time
import random
import threading
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any

# Sandbox safe paths for CrewAI credentials and telemetry
_crewai_store = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace", "crewai_storage"))
os.makedirs(_crewai_store, exist_ok=True)
os.environ.setdefault("CREWAI_STORAGE_DIR", _crewai_store)
os.environ.setdefault("CREWAI_DISABLE_TELEMETRY", "true")

try:
    import crewai_core.token_manager as _tm
    _tm.TokenManager._get_secure_storage_path = lambda self: Path(_crewai_store)
except Exception:
    pass

from crewai import LLM


# ── Free-tier limits (conservative headroom) ─────────────────────────────────
GEMINI_FREE_RPM       = 14        # Gemini 2.0/2.5/3.5 Flash free: 15 RPM cap at 14
GEMINI_FREE_TPM       = 900_000   # 1M TPM cap at 900k
GEMINI_FREE_RPD       = 1_400     # daily request cap (~1500)

GROQ_FREE_RPM         = 30        # Groq free tier: 30 RPM
GROQ_FREE_RPD         = 14_400    # Groq daily request limit
BACKOFF_BASE_SECS     = 60        # wait 60s to clear per-minute window
BACKOFF_MAX_SECS      = 300       # max single wait (5 min)


@dataclass
class KeySlot:
    """Tracks usage for a single LLM API key slot."""
    key:        str
    model:      str
    name:       str             # human label for telemetry & logs
    provider:   str = "gemini"  # "gemini", "groq"
    base_url:   Optional[str] = None
    rpm_limit:  int = GEMINI_FREE_RPM
    rpd_limit:  int = GEMINI_FREE_RPD
    requests_this_minute: int = 0
    minute_window_start:  float = field(default_factory=time.time)
    requests_today:       int = 0
    day_window_start:     float = field(default_factory=time.time)
    last_429_at:          float = 0.0   # epoch when 429 was last seen
    cooldown_secs:        int = 0       # current cooldown duration
    _llm: Optional[LLM] = field(default=None, repr=False)

    def get_llm(self) -> LLM:
        if self._llm is None:
            if self.provider == "groq" or self.model.startswith("groq/") or (self.base_url and "groq.com" in self.base_url):
                # Groq provides an OpenAI-compatible API endpoint
                clean_model = self.model.replace("groq/", "").strip()
                endpoint = self.base_url or os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
                self._llm = LLM(
                    model=clean_model,
                    provider="openai",
                    base_url=endpoint,
                    api_key=self.key,
                    temperature=0.2,
                    timeout=120,
                )
            else:
                # Gemini
                self._llm = LLM(
                    model=self.model,
                    api_key=self.key,
                    temperature=0.3,
                    timeout=120,
                )
        return self._llm

    def _refresh_windows(self):
        now = time.time()
        if now - self.minute_window_start >= 60:
            self.requests_this_minute = 0
            self.minute_window_start  = now
        if now - self.day_window_start >= 86400:
            self.requests_today   = 0
            self.day_window_start = now

    def is_available(self) -> bool:
        """Return True if this slot is currently available to handle a request."""
        if not self.key or self.key.strip() in ("", "YOUR_GEMINI_KEY_HERE", "YOUR_SECOND_GEMINI_KEY_HERE", "YOUR_THIRD_GEMINI_KEY_HERE", "YOUR_GROQ_KEY_HERE"):
            return False

        now = time.time()
        # In cooldown from a recent 429 or connection failure?
        if self.last_429_at > 0 and (now - self.last_429_at) < self.cooldown_secs:
            remaining = int(self.cooldown_secs - (now - self.last_429_at))
            print(f"[LLMManager] Slot '{self.name}' in cooldown for {remaining}s more.")
            return False

        self._refresh_windows()
        if self.requests_this_minute >= self.rpm_limit:
            return False
        if self.requests_today >= self.rpd_limit:
            return False
        return True

    def record_request(self):
        self._refresh_windows()
        self.requests_this_minute += 1
        self.requests_today       += 1

    def record_429(self):
        """Called when a 429 is received — triggers progressive backoff."""
        self.cooldown_secs = min(
            BACKOFF_BASE_SECS * (2 ** min(self.cooldown_secs // BACKOFF_BASE_SECS, 3)),
            BACKOFF_MAX_SECS
        )
        self.last_429_at = time.time()
        print(f"[LLMManager] Key '{self.name}' ({self.provider.upper()}) hit 429. Cooldown: {self.cooldown_secs}s.")

    def reset_cooldown(self):
        self.cooldown_secs = 0
        self.last_429_at   = 0.0


class GeminiKeyPool:
    """
    Thread-safe multi-provider round-robin pool across Groq and Gemini Triple-Key rotation.
    Automatically rotates to the next available healthy key on each get_llm() call.
    On 429, marks the slot as cooling-down and seamlessly fails over to another key.
    """

    def __init__(self):
        self._lock  = threading.Lock()
        self._slots: List[KeySlot] = []
        self._index = 0  # round-robin pointer
        self._init_slots()

    def _init_slots(self):
        self._slots = []

        # Model definitions
        raw_gemini = os.getenv("GEMINI_MODEL", "gemini/gemini-3.5-flash-lite").strip('"\' ')
        gemini_model = "gemini/gemini-3.5-flash-lite" if raw_gemini in ("gemini/gemini-2.5-flash", "gemini/gemini-3.6-flash", "gemini/gemini-2.0-flash", "gemini-2.5-flash", "gemini-3.6-flash") else raw_gemini
        
        gemini_key1  = os.getenv("GEMINI_API_KEY_1", os.getenv("GEMINI_API_KEY", "")).strip()
        gemini_key2  = os.getenv("GEMINI_API_KEY_2", "").strip()
        gemini_key3  = os.getenv("GEMINI_API_KEY_3", "").strip()

        # ── Slot 1: Google Gemini API (Primary Key) ─────────────────────────
        self._slots.append(KeySlot(
            key=gemini_key1 if gemini_key1 not in ("YOUR_GEMINI_KEY_HERE", "") else "",
            model=gemini_model,
            name="GEMINI_KEY_1",
            provider="gemini",
            rpm_limit=GEMINI_FREE_RPM,
            rpd_limit=GEMINI_FREE_RPD,
        ))

        # ── Slot 2: Groq Cloud API (High-Speed Llama 3.3 70B) ────────────────
        groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip('"\' ')
        groq_key1  = os.getenv("GROQ_API_KEY_1", os.getenv("GROQ_API_KEY", "")).strip()
        groq_url   = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").strip()

        self._slots.append(KeySlot(
            key=groq_key1 if groq_key1 not in ("YOUR_GROQ_KEY_HERE", "") else "",
            model=groq_model,
            name="GROQ_KEY_1",
            provider="groq",
            base_url=groq_url,
            rpm_limit=GROQ_FREE_RPM,
            rpd_limit=GROQ_FREE_RPD,
        ))

        # ── Slot 3: Google Gemini API (Secondary Key) ───────────────────────
        self._slots.append(KeySlot(
            key=gemini_key2 if gemini_key2 not in ("YOUR_SECOND_GEMINI_KEY_HERE", "") else "",
            model=gemini_model,
            name="GEMINI_KEY_2",
            provider="gemini",
            rpm_limit=GEMINI_FREE_RPM,
            rpd_limit=GEMINI_FREE_RPD,
        ))

        # ── Slot 4: Google Gemini API (Tertiary Key) ────────────────────────
        self._slots.append(KeySlot(
            key=gemini_key3 if gemini_key3 not in ("YOUR_THIRD_GEMINI_KEY_HERE", "") else "",
            model=gemini_model,
            name="GEMINI_KEY_3",
            provider="gemini",
            rpm_limit=GEMINI_FREE_RPM,
            rpd_limit=GEMINI_FREE_RPD,
        ))

        providers = sorted(list(set(s.provider.capitalize() for s in self._slots)))
        print(f"[LLMManager] Initialized 4-slot round-robin pool across {', '.join(providers)}: {[s.name for s in self._slots]}")

    def update_key(self, slot_name: str, key: str, model: Optional[str] = None) -> bool:
        """Dynamically update an API key for a slot and re-arm it in the pool."""
        with self._lock:
            target = slot_name.upper().strip()
            for slot in self._slots:
                if slot.name == target or slot.provider == target.lower():
                    slot.key = key.strip()
                    if model:
                        slot.model = model.strip()
                    slot._llm = None
                    slot.reset_cooldown()
                    print(f"[LLMManager] Re-armed slot '{slot.name}' with updated key (provider={slot.provider.upper()}).")
                    return True
        return False

    def get_llm(self, require_gemini: bool = False, require_cloud: bool = False) -> LLM:
        """
        Return the next available healthy LLM from the round-robin pool.
        """
        with self._lock:
            max_wait = BACKOFF_MAX_SECS
            waited   = 0
            sleep_step = 5

            while waited <= max_wait:
                # Iterate all slots, advancing the round-robin pointer
                for _ in range(len(self._slots)):
                    slot = self._slots[self._index]
                    self._index = (self._index + 1) % len(self._slots)

                    if require_gemini and slot.provider != "gemini":
                        continue

                    if slot.is_available():
                        slot.record_request()
                        print(f"[LLMManager] Selected slot: {slot.name} ({slot.provider.upper()} - {slot.model})")
                        return slot.get_llm()

                # All eligible slots unavailable — wait briefly and retry
                print(f"[LLMManager] All eligible LLM slots cooling down. Waiting {sleep_step}s... "
                      f"(waited {waited}s / {max_wait}s)")
                time.sleep(sleep_step)
                waited += sleep_step

            raise RuntimeError(
                f"All LLM slots exhausted after {max_wait}s. "
                "Check Groq/Gemini quota or arm additional keys."
            )

    def notify_429(self, llm: LLM):
        """
        Notify the pool that a 429 rate limit was encountered for an LLM instance.
        Marks that specific slot for progressive backoff so traffic shifts to other keys.
        """
        with self._lock:
            for slot in self._slots:
                if slot._llm is llm:
                    slot.record_429()
                    break

    def status(self) -> Dict[str, Any]:
        """Return current pool diagnostics for telemetry & admin dashboards."""
        with self._lock:
            result = {}
            for slot in self._slots:
                is_configured = bool(slot.key and slot.key not in ("YOUR_GEMINI_KEY_HERE", "YOUR_SECOND_GEMINI_KEY_HERE", "YOUR_THIRD_GEMINI_KEY_HERE", "YOUR_GROQ_KEY_HERE", ""))
                result[slot.name] = {
                    "provider": slot.provider,
                    "model": slot.model,
                    "configured": is_configured,
                    "rpm_used": slot.requests_this_minute,
                    "rpm_limit": slot.rpm_limit,
                    "requests_today": slot.requests_today,
                    "available": slot.is_available(),
                    "cooldown_remaining_s": max(
                        0,
                        int(slot.cooldown_secs - (time.time() - slot.last_429_at))
                    ) if slot.last_429_at > 0 else 0,
                }
            return result


# Backwards compatibility alias
LLMKeyPool = GeminiKeyPool

# ── Global singleton pool ─────────────────────────────────────────────────────
_pool: Optional[GeminiKeyPool] = None
_pool_lock = threading.Lock()


def get_pool() -> GeminiKeyPool:
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = GeminiKeyPool()
    return _pool


def get_llm(require_gemini: bool = False, require_cloud: bool = False) -> LLM:
    """
    Public API: get the next available healthy LLM from the multi-provider pool.
    Call this across all agents, tasks, and API chat endpoints.
    """
    return get_pool().get_llm(require_gemini=require_gemini, require_cloud=require_cloud)


def notify_quota_error(llm: LLM):
    """
    Public API: notify the pool that an LLM instance received a 429 quota exhaustion.
    """
    get_pool().notify_429(llm)


def pool_status() -> Dict[str, Any]:
    """Return pool health and telemetry for the /api/telemetry and /api/admin endpoints."""
    return get_pool().status()


# ── Enhanced retry wrapper using the multi-provider pool ──────────────────────

def run_with_key_rotation(func, max_attempts: int = 6):
    """
    Execute `func()` with automatic multi-provider key rotation on 429 or rate limits.

    If a 429 is encountered:
      1. Marks the exhausted key/slot as cooling down in the pool
      2. Immediately retries with the next healthy provider (Groq / Gemini)
      3. Backs off progressively only if all keys across all providers are on cooldown
    """
    last_exception = None

    for attempt in range(1, max_attempts + 1):
        try:
            return func()

        except Exception as e:
            err_str = str(e).lower()
            is_quota = any(x in err_str for x in ("429", "resource_exhausted", "quota", "rate limit"))
            is_connection = any(x in err_str for x in ("connection error", "failed to connect", "connection refused"))

            if not (is_quota or is_connection):
                raise  # Other non-transient errors surface immediately

            last_exception = e
            if is_connection:
                print(f"\n[LLMManager] Connection error on attempt {attempt}/{max_attempts}. "
                      "Checking alternative pool slots...")
            else:
                print(f"\n[LLMManager] Attempt {attempt}/{max_attempts} hit rate limit. Rotating slot...")

            wait = min(BACKOFF_BASE_SECS * (2 ** (attempt - 1)), BACKOFF_MAX_SECS)
            if is_connection:
                wait = 10  # Short wait for network reconnection

            jitter = random.randint(2, 8)
            total_wait = wait + jitter

            print(f"[LLMManager] Pausing {total_wait}s before retry across pool (attempt {attempt}/{max_attempts})...")
            time.sleep(total_wait)

    raise RuntimeError(
        f"All {max_attempts} attempts failed across the LLM pool. "
        f"Last error: {last_exception}"
    )


# Backwards compatibility alias
LLMKeyPool = GeminiKeyPool

# ── Global singleton pool ─────────────────────────────────────────────────────
_pool: Optional[GeminiKeyPool] = None
_pool_lock = threading.Lock()


def get_pool() -> GeminiKeyPool:
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = GeminiKeyPool()
    return _pool


def get_llm(require_gemini: bool = False, require_cloud: bool = False) -> LLM:
    """
    Public API: get the next available healthy LLM from the multi-provider pool.
    Call this across all agents, tasks, and API chat endpoints.
    """
    return get_pool().get_llm(require_gemini=require_gemini, require_cloud=require_cloud)


def notify_quota_error(llm: LLM):
    """
    Public API: notify the pool that an LLM instance received a 429 quota exhaustion.
    """
    get_pool().notify_429(llm)


def pool_status() -> Dict[str, Any]:
    """Return pool health and telemetry for the /api/telemetry and /api/admin endpoints."""
    return get_pool().status()


# ── Enhanced retry wrapper using the multi-provider pool ──────────────────────

def run_with_key_rotation(func, max_attempts: int = 6):
    """
    Execute `func()` with automatic multi-provider key rotation on 429 or rate limits.

    If a 429 is encountered:
      1. Marks the exhausted key/slot as cooling down in the pool
      2. Immediately retries with the next healthy provider (Groq/Gemini/Ollama)
      3. Backs off progressively only if all keys across all providers are on cooldown
    """
    last_exception = None

    for attempt in range(1, max_attempts + 1):
        try:
            return func()

        except Exception as e:
            err_str = str(e).lower()
            is_quota = any(x in err_str for x in ("429", "resource_exhausted", "quota", "rate limit"))
            is_connection = any(x in err_str for x in ("connection error", "failed to connect", "connection refused"))

            if not (is_quota or is_connection):
                raise  # Other non-transient errors surface immediately

            last_exception = e
            if is_connection:
                print(f"\n[LLMManager] Connection error on attempt {attempt}/{max_attempts}. "
                      "Checking alternative pool slots...")
            else:
                print(f"\n[LLMManager] Attempt {attempt}/{max_attempts} hit rate limit. Rotating slot...")

            wait = min(BACKOFF_BASE_SECS * (2 ** (attempt - 1)), BACKOFF_MAX_SECS)
            if is_connection:
                wait = 10  # Short wait for network reconnection

            jitter = random.randint(2, 8)
            total_wait = wait + jitter

            print(f"[LLMManager] Pausing {total_wait}s before retry across pool (attempt {attempt}/{max_attempts})...")
            time.sleep(total_wait)

    raise RuntimeError(
        f"All {max_attempts} attempts failed across the LLM pool. "
        f"Last error: {last_exception}"
    )
