"""
GeoLens AI - Gemini Dual-Key Round-Robin LLM Manager
=====================================================
Phase 6.4 — Rate-Limit Resilience

Manages two Gemini API keys in a round-robin pool with:
  - Per-key per-minute token budget tracking (FREE tier: 1M TPM, 15 RPM)
  - Automatic failover: if key A hits 429, instantly switches to key B
  - Exponential backoff ONLY when BOTH keys are exhausted
  - Thread-safe rotation for concurrent agent calls
  - Future-ready: add Ollama local-model as a 3rd slot when needed

Usage in crew:
    from utils.llm_manager import get_llm
    llm = get_llm()   # returns the least-recently-used available LLM
"""

import os
import time
import random
import threading
from dataclasses import dataclass, field
from typing import Optional, List

from crewai import LLM


# ── Free-tier Gemini limits (conservative headroom) ─────────────────────────
GEMINI_FREE_RPM       = 14    # hard limit 15, we cap at 14 for safety
GEMINI_FREE_TPM       = 900_000   # Gemini 2.0 Flash free: 1M TPM, cap at 900k
GEMINI_FREE_RPD       = 1_400     # daily request cap (free tier ~1500)
BACKOFF_BASE_SECS     = 65        # wait at least 65s to clear per-minute window
BACKOFF_MAX_SECS      = 300       # max single wait (5 min)


@dataclass
class KeySlot:
    """Tracks usage for a single Gemini API key."""
    key:        str
    model:      str
    name:       str             # human label for logs
    requests_this_minute: int = 0
    minute_window_start:  float = field(default_factory=time.time)
    requests_today:       int = 0
    day_window_start:     float = field(default_factory=time.time)
    last_429_at:          float = 0.0   # epoch when 429 was last seen
    cooldown_secs:        int = 0       # current cooldown duration
    _llm: Optional[LLM] = field(default=None, repr=False)

    def get_llm(self) -> LLM:
        if self._llm is None:
            self._llm = LLM(
                model=self.model,
                api_key=self.key,
                temperature=0.3,
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
        """Return True if this key is currently under rate limits."""
        now = time.time()
        # In cooldown from a recent 429?
        if self.last_429_at > 0 and (now - self.last_429_at) < self.cooldown_secs:
            remaining = int(self.cooldown_secs - (now - self.last_429_at))
            print(f"[LLMManager] Key '{self.name}' in cooldown for {remaining}s more.")
            return False
        self._refresh_windows()
        if self.requests_this_minute >= GEMINI_FREE_RPM:
            return False
        if self.requests_today >= GEMINI_FREE_RPD:
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
        print(f"[LLMManager] Key '{self.name}' hit 429. Cooldown: {self.cooldown_secs}s.")

    def reset_cooldown(self):
        self.cooldown_secs = 0
        self.last_429_at   = 0.0


class GeminiKeyPool:
    """
    Thread-safe round-robin pool of Gemini API keys.
    Automatically rotates to a healthy key on each get_llm() call.
    On 429, marks the key as cooling-down and switches to the next.
    """

    def __init__(self):
        self._lock  = threading.Lock()
        self._slots: List[KeySlot] = []
        self._index = 0  # round-robin pointer
        self._init_slots()

    def _init_slots(self):
        model  = os.getenv("GEMINI_MODEL", "gemini/gemini-2.0-flash")
        key1   = os.getenv("GEMINI_API_KEY_1", os.getenv("GEMINI_API_KEY", ""))
        key2   = os.getenv("GEMINI_API_KEY_2", "")

        if key1:
            self._slots.append(KeySlot(key=key1, model=model, name="KEY_1"))
        if key2 and key2 not in ("YOUR_SECOND_GEMINI_KEY_HERE", key1, ""):
            self._slots.append(KeySlot(key=key2, model=model, name="KEY_2"))

        if not self._slots:
            raise RuntimeError("No Gemini API keys configured. Set GEMINI_API_KEY_1 in .env")

        print(f"[LLMManager] Initialized with {len(self._slots)} key(s): "
              f"{[s.name for s in self._slots]}")

    def get_llm(self) -> LLM:
        """
        Return an LLM instance from the next available key (round-robin).
        Blocks and waits if all keys are temporarily exhausted.
        """
        with self._lock:
            max_wait = BACKOFF_MAX_SECS
            waited   = 0
            sleep_step = 5

            while waited <= max_wait:
                # Try each slot starting from current round-robin index
                for _ in range(len(self._slots)):
                    slot = self._slots[self._index % len(self._slots)]
                    self._index += 1
                    if slot.is_available():
                        slot.record_request()
                        print(f"[LLMManager] Using {slot.name} "
                              f"(RPM: {slot.requests_this_minute}/{GEMINI_FREE_RPM})")
                        return slot.get_llm()

                # All keys unavailable — wait briefly and retry
                print(f"[LLMManager] All keys rate-limited. Waiting {sleep_step}s... "
                      f"(total waited: {waited}s)")
                time.sleep(sleep_step)
                waited += sleep_step

            raise RuntimeError(
                f"All Gemini keys exhausted after {max_wait}s. "
                "Consider upgrading to a paid tier or adding more keys."
            )

    def notify_429(self, llm: LLM):
        """
        Call this when a 429 is received so the pool can mark that key
        as cooling-down and switch to a different key on the next call.
        """
        with self._lock:
            for slot in self._slots:
                if slot._llm is llm:
                    slot.record_429()
                    break

    def status(self) -> dict:
        """Return current pool status for diagnostics."""
        with self._lock:
            return {
                slot.name: {
                    "rpm_used": slot.requests_this_minute,
                    "rpm_limit": GEMINI_FREE_RPM,
                    "requests_today": slot.requests_today,
                    "available": slot.is_available(),
                    "cooldown_remaining_s": max(
                        0,
                        int(slot.cooldown_secs - (time.time() - slot.last_429_at))
                    ) if slot.last_429_at > 0 else 0,
                }
                for slot in self._slots
            }


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


def get_llm() -> LLM:
    """
    Public API: get the next available Gemini LLM from the round-robin pool.
    Call this instead of constructing LLM() directly in agents/crew.
    """
    return get_pool().get_llm()


def notify_quota_error(llm: LLM):
    """
    Public API: notify the pool that this LLM instance received a 429.
    Call this in your except block when catching RESOURCE_EXHAUSTED.
    """
    get_pool().notify_429(llm)


def pool_status() -> dict:
    """Return pool health for the /api/telemetry endpoint."""
    return get_pool().status()


# ── Enhanced retry wrapper using the pool ────────────────────────────────────

def run_with_key_rotation(func, max_attempts: int = 6):
    """
    Execute `func()` with automatic Gemini key rotation on 429.

    If a 429 is detected:
      1. Marks the current key as cooling-down in the pool
      2. Retries immediately with the next available key
      3. Falls back to exponential wait only when all keys are exhausted

    Args:
        func:         Callable to execute (should return a CrewAI kickoff result).
        max_attempts: Max total attempts across all key rotations.
    """
    last_exception = None

    for attempt in range(1, max_attempts + 1):
        try:
            return func()

        except Exception as e:
            err_str = str(e)
            is_quota = any(x in err_str for x in ("429", "RESOURCE_EXHAUSTED", "quota", "rate limit"))

            if not is_quota:
                raise  # Non-quota errors surface immediately

            last_exception = e
            print(f"\n[LLMManager] Attempt {attempt}/{max_attempts} hit quota limit.")

            # Progressive wait: 65s → 130s → 260s → 300s max
            wait = min(BACKOFF_BASE_SECS * (2 ** (attempt - 1)), BACKOFF_MAX_SECS)
            jitter = random.randint(2, 10)
            total_wait = wait + jitter

            print(f"[LLMManager] Waiting {total_wait}s before retry "
                  f"(attempt {attempt}/{max_attempts})...")
            print("[LLMManager] Both Gemini keys may be on cooldown. "
                  "Tip: Add GEMINI_API_KEY_3 to .env for more quota.")
            time.sleep(total_wait)

    raise RuntimeError(
        f"All {max_attempts} attempts failed due to Gemini quota limits. "
        f"Last error: {last_exception}"
    )
