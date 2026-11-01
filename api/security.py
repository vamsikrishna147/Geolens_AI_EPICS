import os
import time
import hmac
import secrets
import logging
from typing import Optional, Dict, Any, List
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import Request, HTTPException, Depends
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger("geolens.security")

# Master Admin Key from environment or secure default
DEFAULT_ADMIN_KEY = "geolens-admin-2026-secret-passkey"

def get_master_admin_key() -> str:
    key = os.getenv("GEOLENS_ADMIN_KEY") or os.getenv("ADMIN_SECRET_KEY") or DEFAULT_ADMIN_KEY
    return key.strip()

# Active In-Memory Admin Sessions: {token: {"user": str, "role": str, "created_at": float, "expires_at": float, "ip": str}}
_admin_sessions: Dict[str, Dict[str, Any]] = {}
SESSION_TTL_SECONDS = 14400  # 4 hours

# Security Audit Log (circular buffer of recent security events)
_security_audit_log: List[Dict[str, Any]] = []
MAX_AUDIT_LOG_ENTRIES = 200

def record_security_event(event_type: str, client_ip: str, path: str, details: Optional[Dict[str, Any]] = None):
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
        "client_ip": client_ip,
        "path": path,
        "details": details or {}
    }
    _security_audit_log.append(entry)
    if len(_security_audit_log) > MAX_AUDIT_LOG_ENTRIES:
        _security_audit_log.pop(0)
    logger.info("SECURITY [%s] IP: %s, Path: %s", event_type, client_ip, path)

def get_security_audit_log() -> List[Dict[str, Any]]:
    # Return copy in reverse chronological order
    return list(reversed(_security_audit_log))

# Failed login tracking for brute-force defense
_failed_login_attempts: Dict[str, List[float]] = defaultdict(list)
_locked_ips: Dict[str, float] = {}
LOCKOUT_THRESHOLD = 5
LOCKOUT_DURATION_SECONDS = 300  # 5 minutes lockout after 5 consecutive failures

def is_ip_locked(client_ip: str) -> bool:
    lock_until = _locked_ips.get(client_ip)
    if lock_until:
        if time.time() < lock_until:
            return True
        else:
            del _locked_ips[client_ip]
            _failed_login_attempts.pop(client_ip, None)
    return False

def record_failed_login(client_ip: str):
    now = time.time()
    attempts = [t for t in _failed_login_attempts[client_ip] if now - t < 300]
    attempts.append(now)
    _failed_login_attempts[client_ip] = attempts
    if len(attempts) >= LOCKOUT_THRESHOLD:
        _locked_ips[client_ip] = now + LOCKOUT_DURATION_SECONDS
        record_security_event("IP_LOCKED_OUT", client_ip, "/api/admin/login", {"locked_for_seconds": LOCKOUT_DURATION_SECONDS})

def reset_failed_login(client_ip: str):
    _failed_login_attempts.pop(client_ip, None)
    _locked_ips.pop(client_ip, None)

def create_admin_session(client_ip: str = "127.0.0.1") -> str:
    token = f"geo_adm_{secrets.token_urlsafe(32)}"
    now = time.time()
    _admin_sessions[token] = {
        "user": "admin",
        "role": "super_admin",
        "created_at": now,
        "expires_at": now + SESSION_TTL_SECONDS,
        "ip": client_ip
    }
    record_security_event("ADMIN_SESSION_CREATED", client_ip, "/api/admin/login")
    return token

def revoke_admin_session(token: str, client_ip: str = "127.0.0.1") -> bool:
    if token in _admin_sessions:
        del _admin_sessions[token]
        record_security_event("ADMIN_SESSION_REVOKED", client_ip, "/api/admin/logout")
        return True
    return False

def is_valid_admin_token(token: str) -> bool:
    session = _admin_sessions.get(token)
    if not session:
        return False
    if time.time() > session["expires_at"]:
        del _admin_sessions[token]
        return False
    return True

def verify_admin_key(provided_key: str) -> bool:
    master = get_master_admin_key()
    if not provided_key or not master:
        return False
    return hmac.compare_digest(provided_key.strip(), master)

def verify_admin_access(request: Request) -> Dict[str, Any]:
    """
    FastAPI dependency for admin routes.
    Checks for:
    1. Valid session token in Authorization header (`Bearer <token>`)
    2. Valid session token in `X-Admin-Key` header
    3. Direct Master Admin Key in `X-Admin-Key` or `admin_key` query param
    """
    client_ip = request.client.host if request.client else "unknown"
    
    # 1. Check X-Admin-Key header
    admin_header = request.headers.get("X-Admin-Key") or request.headers.get("x-admin-key")
    if admin_header:
        admin_header = admin_header.strip()
        if is_valid_admin_token(admin_header):
            return _admin_sessions[admin_header]
        if verify_admin_key(admin_header):
            return {"user": "admin", "role": "super_admin", "auth_method": "master_key"}

    # 2. Check Authorization Bearer header
    auth_header = request.headers.get("Authorization") or request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        bearer_token = auth_header[7:].strip()
        if is_valid_admin_token(bearer_token):
            return _admin_sessions[bearer_token]
        if verify_admin_key(bearer_token):
            return {"user": "admin", "role": "super_admin", "auth_method": "master_key"}

    # 3. Check query param fallback
    query_key = request.query_params.get("admin_key")
    if query_key and verify_admin_key(query_key):
        return {"user": "admin", "role": "super_admin", "auth_method": "master_key"}

    record_security_event("UNAUTHORIZED_ADMIN_ACCESS_ATTEMPT", client_ip, str(request.url.path))
    raise HTTPException(
        status_code=401,
        detail="Unauthorized: Admin access privileges required. Invalid or missing admin credential."
    )


_rate_limit_requests: Dict[str, List[float]] = defaultdict(list)

async def apply_security_headers_and_rate_limit(request: Request, call_next):
    """
    Unified security middleware: enforces IP rate limiting and injects
    essential HTTP security headers on all responses.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    path = request.url.path
    now = time.time()

    # Rate limiting rules
    if path.startswith("/api/admin/login"):
        limit = 10
        window = 60
    elif path.startswith("/api/timelens/download"):
        limit = 60
        window = 60
    else:
        limit = 180
        window = 60

    parts = path.split('/')
    key = f"{client_ip}:{parts[2] if len(parts) > 2 else 'root'}"
    timestamps = [t for t in _rate_limit_requests[key] if now - t < window]

    if len(timestamps) >= limit:
        record_security_event("RATE_LIMIT_EXCEEDED", client_ip, path, {"limit": limit, "window": window})
        return JSONResponse(
            status_code=429,
            content={"error": "Rate limit exceeded. Please wait before retrying.", "retry_after": 60},
            headers={"Retry-After": "60", "X-RateLimit-Limit": str(limit), "X-RateLimit-Remaining": "0"}
        )

    timestamps.append(now)
    _rate_limit_requests[key] = timestamps

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), camera=(), microphone=()"
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(max(0, limit - len(timestamps)))
    return response


def parse_safe_bbox(bbox_str: Optional[str]) -> Optional[List[float]]:
    """
    Safely parses and validates bounding box string 'min_lon,min_lat,max_lon,max_lat'.
    Returns validated [min_lon, min_lat, max_lon, max_lat] floats or None.
    Rejects malformed strings, invalid coordinate counts, and out-of-range bounds.
    """
    if not bbox_str or not isinstance(bbox_str, str):
        return None
    try:
        parts = [p.strip() for p in bbox_str.split(',') if p.strip()]
        if len(parts) != 4:
            return None
        coords = [float(p) for p in parts]
        min_lon, min_lat, max_lon, max_lat = coords
        # Validate spatial coordinates range
        if not (-180.0 <= min_lon <= 180.0 and -180.0 <= max_lon <= 180.0):
            return None
        if not (-90.0 <= min_lat <= 90.0 and -90.0 <= max_lat <= 90.0):
            return None
        if min_lon >= max_lon or min_lat >= max_lat:
            # Swap if user accidentally flipped coords
            min_lon, max_lon = min(min_lon, max_lon), max(min_lon, max_lon)
            min_lat, max_lat = min(min_lat, max_lat), max(min_lat, max_lat)
            if min_lon == max_lon or min_lat == max_lat:
                return None
        return [round(min_lon, 5), round(min_lat, 5), round(max_lon, 5), round(max_lat, 5)]
    except Exception:
        return None


def safe_join_path(base_dir: str, filename: str) -> str:
    """
    Guarantees target file path cannot escape base_dir via directory traversal.
    """
    import os
    clean_name = os.path.basename(filename).strip()
    # Reject dangerous characters
    clean_name = "".join(c for c in clean_name if c.isalnum() or c in "._-")
    if not clean_name or clean_name in (".", ".."):
        raise ValueError("Invalid filename")
    full_path = os.path.abspath(os.path.join(base_dir, clean_name))
    abs_base = os.path.abspath(base_dir)
    if os.path.commonpath([abs_base, full_path]) != abs_base:
        raise ValueError("Directory traversal detected")
    return full_path
