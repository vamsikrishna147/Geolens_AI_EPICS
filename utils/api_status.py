"""
GeoLens AI - API Status Checker
=================================
Checks which APIs and services are configured and ready, then prints
a clear status table on startup. Helps users know which tools are active
and what keys/registration they still need.
"""

import os
from dotenv import load_dotenv

load_dotenv()


def get_api_status() -> dict:
    """
    Check the status of all configured APIs and services.

    Returns:
        Dict mapping service name → {status, note, required_action}
        Status values: "ready", "limited", "needs_key", "needs_setup"
    """
    status = {}

    # ── Free APIs (no key needed) ─────────────────────────────────
    status["Open-Meteo (Weather)"] = {
        "status": "ready",
        "note": "Current + historical weather, no key needed",
        "emoji": "✅",
    }
    status["OpenStreetMap / Overpass"] = {
        "status": "ready",
        "note": "Maps, roads, boundaries — no key needed",
        "emoji": "✅",
    }
    status["OpenAlex (Research Papers)"] = {
        "status": "ready",
        "note": "250M+ papers, no key needed",
        "emoji": "✅",
    }
    status["SoilGrids"] = {
        "status": "ready",
        "note": "Global soil properties, no key needed",
        "emoji": "✅",
    }
    status["NASA POWER (Climate)"] = {
        "status": "ready",
        "note": "Solar & meteo data 1981-present, no key needed",
        "emoji": "✅",
    }
    status["WorldPop (Population)"] = {
        "status": "ready",
        "note": "Population density rasters, no key needed",
        "emoji": "✅",
    }
    status["GADM (Boundaries)"] = {
        "status": "ready",
        "note": "Admin boundaries for all countries, no key needed",
        "emoji": "✅",
    }
    status["Nominatim (Geocoding)"] = {
        "status": "ready",
        "note": "Location → coordinates, no key needed",
        "emoji": "✅",
    }

    # ── NASA FIRMS ────────────────────────────────────────────────
    firms_key = os.getenv("NASA_FIRMS_API_KEY", "")
    if firms_key and firms_key != "your_firms_api_key_here":
        status["NASA FIRMS (Fire)"] = {
            "status": "ready",
            "note": "Full archive access (VIIRS + MODIS)",
            "emoji": "✅",
        }
    else:
        status["NASA FIRMS (Fire)"] = {
            "status": "limited",
            "note": "Last 7 days only (register free at firms.modaps.eosdis.nasa.gov for full access)",
            "emoji": "⚠️ ",
        }

    # ── Google Earth Engine ────────────────────────────────────────
    gee_project = os.getenv("GEE_PROJECT_ID", "")
    if gee_project and gee_project != "your_gee_project_id_here":
        status["Google Earth Engine"] = {
            "status": "ready",
            "note": f"Project: {gee_project} — Sentinel, Landsat, MODIS, ERA5, CHIRPS",
            "emoji": "✅",
        }
    else:
        status["Google Earth Engine"] = {
            "status": "needs_key",
            "note": "Set GEE_PROJECT_ID in .env + run: earthengine authenticate",
            "emoji": "🔑",
        }

    # ── India Government Data ──────────────────────────────────────
    india_key = os.getenv("INDIA_GOV_API_KEY", "")
    if india_key and india_key != "your_india_gov_api_key_here":
        status["data.gov.in (India Gov)"] = {
            "status": "ready",
            "note": "400K+ Indian government datasets",
            "emoji": "✅",
        }
    else:
        status["data.gov.in (India Gov)"] = {
            "status": "needs_key",
            "note": "Register free at data.gov.in — set INDIA_GOV_API_KEY in .env",
            "emoji": "🔑",
        }

    # ── Gemini LLM ────────────────────────────────────────────────
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if gemini_key and gemini_key != "your_gemini_api_key_here":
        model = os.getenv("GEMINI_MODEL", "gemini/gemini-2.0-flash")
        status["Gemini LLM"] = {
            "status": "ready",
            "note": f"Model: {model}",
            "emoji": "✅",
        }
    else:
        status["Gemini LLM"] = {
            "status": "needs_key",
            "note": "CRITICAL: Set GEMINI_API_KEY in .env (get free key at aistudio.google.com)",
            "emoji": "❌",
        }

    # ── PostgreSQL + PostGIS ───────────────────────────────────────
    pg_host = os.getenv("POSTGIS_HOST", "localhost")
    pg_db = os.getenv("POSTGIS_DB", "geolens")
    pg_pass = os.getenv("POSTGIS_PASSWORD", "")
    if pg_pass and pg_pass != "your_postgres_password_here":
        status["PostgreSQL + PostGIS"] = {
            "status": "configured",
            "note": f"Host: {pg_host}, DB: {pg_db} — will test connection on first use",
            "emoji": "🗄️ ",
        }
    else:
        status["PostgreSQL + PostGIS"] = {
            "status": "needs_setup",
            "note": "Set POSTGIS_PASSWORD in .env — data saved to ./data/ files until configured",
            "emoji": "⚠️ ",
        }

    return status


def print_api_status() -> None:
    """Print a formatted API status table to the console."""
    status = get_api_status()

    print()
    print("  " + "=" * 60)
    print("  🌍  GeoLens AI — Data Source Status")
    print("  " + "=" * 60)
    print()

    # Group by status
    ready = {k: v for k, v in status.items() if v["status"] in ("ready", "configured")}
    limited = {k: v for k, v in status.items() if v["status"] == "limited"}
    needs = {k: v for k, v in status.items() if v["status"] in ("needs_key", "needs_setup")}

    if ready:
        print("  READY TO USE:")
        for name, info in ready.items():
            print(f"    {info['emoji']}  {name}")
            print(f"         {info['note']}")
        print()

    if limited:
        print("  LIMITED ACCESS (register for full access):")
        for name, info in limited.items():
            print(f"    {info['emoji']}  {name}")
            print(f"         {info['note']}")
        print()

    if needs:
        print("  NEEDS CONFIGURATION:")
        for name, info in needs.items():
            print(f"    {info['emoji']}  {name}")
            print(f"         {info['note']}")
        print()

    total = len(status)
    ready_count = len(ready) + len(limited)
    print(f"  {ready_count}/{total} data sources operational")
    print("  📖 See config/api_guide.md for setup instructions")
    print("  " + "=" * 60)
    print()
