import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Sandbox safe path for CrewAI storage
_workspace_crewai = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace", "crewai_storage"))
os.makedirs(_workspace_crewai, exist_ok=True)
os.environ["CREWAI_STORAGE_DIR"] = _workspace_crewai
os.environ["CREWAI_DISABLE_TELEMETRY"] = "true"

try:
    from pathlib import Path as _Path
    import crewai_core.token_manager as _tm
    _tm.TokenManager._get_secure_storage_path = lambda self: _Path(_workspace_crewai)
except Exception:
    pass

import pytest
from fastapi.testclient import TestClient
from api.server import app
from api.security import (
    DEFAULT_ADMIN_KEY,
    parse_safe_bbox,
    safe_join_path,
    verify_admin_key,
    reset_failed_login,
)
from utils.fast_cache import fast_cache

client = TestClient(app)

@pytest.fixture(autouse=True)
def cleanup_security_state():
    reset_failed_login("testclient")
    reset_failed_login("127.0.0.1")
    yield

class TestAdminAuthenticationAndIsolation:
    def test_unauthenticated_admin_system_status_rejected(self):
        """Standard user requests to /api/admin/system must be rejected with 401."""
        resp = client.get("/api/admin/system")
        assert resp.status_code == 401
        assert "Unauthorized" in resp.json().get("detail", "")

    def test_unauthenticated_clear_cache_rejected(self):
        """Unauthenticated user cannot clear system cache."""
        resp = client.post("/api/admin/clear-cache")
        assert resp.status_code == 401

    def test_unauthenticated_llm_keys_rejected(self):
        """Unauthenticated user cannot modify LLM API keys."""
        resp = client.post("/api/admin/llm_keys", json={"groq_api_key": "hacker_key"})
        assert resp.status_code == 401

    def test_login_with_invalid_key_fails(self):
        """Brute-force/wrong key attempt fails with 401."""
        resp = client.post("/api/admin/login", json={"admin_key": "wrong_password_123"})
        assert resp.status_code == 401
        assert "Invalid admin passkey" in resp.json().get("detail", "")

    def test_login_with_valid_key_succeeds(self):
        """Valid admin key returns session token and super_admin privileges."""
        resp = client.post("/api/admin/login", json={"admin_key": DEFAULT_ADMIN_KEY})
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("status") == "success"
        assert "token" in data
        assert data.get("role") == "super_admin"

    def test_authenticated_admin_access_with_session_token(self):
        """Admin can access protected system diagnostics using X-Admin-Key token."""
        # 1. Login
        login_resp = client.post("/api/admin/login", json={"admin_key": DEFAULT_ADMIN_KEY})
        token = login_resp.json()["token"]

        # 2. Verify
        verify_resp = client.get("/api/admin/verify", headers={"X-Admin-Key": token})
        assert verify_resp.status_code == 200
        assert verify_resp.json()["authenticated"] is True
        assert verify_resp.json()["role"] == "super_admin"

        # 3. Access system status
        sys_resp = client.get("/api/admin/system", headers={"X-Admin-Key": token})
        assert sys_resp.status_code == 200
        assert sys_resp.json().get("server_status") == "Operational"

    def test_authenticated_admin_access_with_bearer_token(self):
        """Admin can access protected endpoints via Authorization: Bearer <token>."""
        login_resp = client.post("/api/admin/login", json={"admin_key": DEFAULT_ADMIN_KEY})
        token = login_resp.json()["token"]

        resp = client.get("/api/admin/verify", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.json()["authenticated"] is True

    def test_admin_logout_revokes_token(self):
        """Logging out revokes session; subsequent requests with revoked token return 401."""
        login_resp = client.post("/api/admin/login", json={"admin_key": DEFAULT_ADMIN_KEY})
        token = login_resp.json()["token"]

        logout_resp = client.post("/api/admin/logout", headers={"X-Admin-Key": token})
        assert logout_resp.status_code == 200

        # Attempt access with revoked token
        resp = client.get("/api/admin/system", headers={"X-Admin-Key": token})
        assert resp.status_code == 401

    def test_admin_security_audit_log(self):
        """Security events are tracked and visible only to authenticated admins."""
        login_resp = client.post("/api/admin/login", json={"admin_key": DEFAULT_ADMIN_KEY})
        token = login_resp.json()["token"]

        audit_resp = client.get("/api/admin/security/audit", headers={"X-Admin-Key": token})
        assert audit_resp.status_code == 200
        data = audit_resp.json()
        assert "audit_events" in data
        assert isinstance(data["audit_events"], list)


class TestSecurityHeadersAndPathSanitization:
    def test_security_headers_present_on_responses(self):
        """Verify essential HTTP security headers are injected."""
        resp = client.get("/api/telemetry")
        assert resp.headers.get("X-Content-Type-Options") == "nosniff"
        assert resp.headers.get("X-Frame-Options") == "SAMEORIGIN"
        assert resp.headers.get("X-XSS-Protection") == "1; mode=block"

    def test_path_traversal_prevention(self):
        """Attempting to escape base directory raises ValueError."""
        with pytest.raises(ValueError):
            safe_join_path("data/downloads", "../../etc/passwd")

        with pytest.raises(ValueError):
            safe_join_path("data/downloads", "..\\..\\windows\\system32")

    def test_safe_bbox_parsing(self):
        """Valid coordinates are parsed and bounded correctly; invalid are rejected."""
        valid = parse_safe_bbox("80.12,16.45,80.65,16.95")
        assert valid == [80.12, 16.45, 80.65, 16.95]

        # Truncated
        assert parse_safe_bbox("80.12,16.45") is None

        # Out of bounds
        assert parse_safe_bbox("200,10,210,20") is None

        # Flipped bounds are safely normalized
        flipped = parse_safe_bbox("80.65,16.95,80.12,16.45")
        assert flipped == [80.12, 16.45, 80.65, 16.95]


class TestFastTwoTierCache:
    def test_fast_cache_in_memory_set_and_get(self):
        """Tier 1 memory cache returns stored objects with zero network delay."""
        test_key = "test:geolens:satellite_sample"
        payload = {"tiles": "https://example.com/tile.png", "ndvi": 0.42}
        fast_cache.set(test_key, payload, ttl=10)

        retrieved = fast_cache.get(test_key)
        assert retrieved == payload

    def test_fast_cache_expiration(self):
        """Expired items in memory cache return None."""
        test_key = "test:geolens:expired"
        fast_cache.set_memory(test_key, {"stale": True}, ttl=-1)
        assert fast_cache.get(test_key) is None
