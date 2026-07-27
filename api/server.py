"""
GeoLens AI - Backend Server (FastAPI)
=======================================
Provides an API for the web dashboard to trigger the 5-agent pipeline.
"""

import os
import sys
import uuid
import asyncio
import requests
import ee
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()
try:
    ee.Initialize(project=os.getenv("GEE_PROJECT_ID"))
    print("Google Earth Engine initialized successfully.")
except Exception as e:
    print(f"Failed to initialize GEE: {e}")

from fastapi import FastAPI, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Ensure the root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from crews.geolens_crew import GeoLensCrew
from storage.redis_client import get_redis_client

app = FastAPI(title="GeoLens AI API")
redis_cache = get_redis_client()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global store for query statuses (In a real app, use Redis/DB)
tasks_db: Dict[str, Dict[str, Any]] = {}

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, task_id: str):
        await websocket.accept()
        if task_id not in self.active_connections:
            self.active_connections[task_id] = []
        self.active_connections[task_id].append(websocket)

    def disconnect(self, websocket: WebSocket, task_id: str):
        if task_id in self.active_connections:
            self.active_connections[task_id].remove(websocket)
            if not self.active_connections[task_id]:
                del self.active_connections[task_id]

    async def broadcast(self, task_id: str, message: str):
        if task_id in self.active_connections:
            for connection in self.active_connections[task_id]:
                try:
                    await connection.send_text(message)
                except Exception:
                    pass

manager = ConnectionManager()

class StreamToWebSocket:
    def __init__(self, task_id: str, manager: ConnectionManager, loop: asyncio.AbstractEventLoop):
        self.task_id = task_id
        self.manager = manager
        self.loop = loop
        self.original_stdout = sys.stdout

    def write(self, data):
        self.original_stdout.write(data)
        if data.strip():
            asyncio.run_coroutine_threadsafe(self.manager.broadcast(self.task_id, data.strip()), self.loop)

    def flush(self):
        self.original_stdout.flush()

class AnalyzeRequest(BaseModel):
    query: str


def run_crew_task(task_id: str, query: str, loop: asyncio.AbstractEventLoop):
    """Background task to run the crew."""
    tasks_db[task_id]["status"] = "running"
    
    # Intercept stdout
    interceptor = StreamToWebSocket(task_id, manager, loop)
    old_stdout = sys.stdout
    sys.stdout = interceptor
    
    try:
        crew = GeoLensCrew(verbose=True)
        result = crew.run(query)
        
        final_data = {
            "analysis_plan": result.get("analysis_plan"),
            "dataset_recommendation": result.get("dataset_recommendation"),
            "weather_climate": result.get("weather_climate"),
            "research_policy": result.get("research_policy"),
            "acquisition_result": result.get("acquisition_result"),
            "gis_processing": result.get("gis_processing"),
            "temporal_analysis": result.get("temporal_analysis"),
            "satellite_analysis": result.get("satellite_analysis"),
            "decision_recommendations": result.get("decision_recommendations"),
            "official_report": result.get("official_report"),
            "raw_output": result.get("raw_output")
        }
        
        tasks_db[task_id]["status"] = "completed"
        tasks_db[task_id]["result"] = final_data
        
        # Cache the successful result in Redis for 24 hours
        cache_key = f"analyze_query:{query.strip().lower()}"
        redis_cache.set(cache_key, final_data, ttl=86400)
        
        # Save to SQLite DB
        from api.db import save_mission
        save_mission(task_id, query, "completed", final_data, None)
        
    except Exception as e:
        tasks_db[task_id]["status"] = "failed"
        tasks_db[task_id]["error"] = str(e)
        from api.db import save_mission
        save_mission(task_id, query, "failed", None, str(e))
    finally:
        sys.stdout = old_stdout


@app.post("/api/analyze")
async def start_analysis(request: AnalyzeRequest, bg_tasks: BackgroundTasks):
    """Starts the 5-agent pipeline."""
    # Check Redis cache first for identical query
    cache_key = f"analyze_query:{request.query.strip().lower()}"
    cached_result = redis_cache.get(cache_key)
    if cached_result:
        # Also log it in history for cached runs
        task_id = str(uuid.uuid4())
        from api.db import save_mission
        save_mission(task_id, request.query, "completed", cached_result, None)
        return {"task_id": task_id, "status": "completed", "result": cached_result}

    task_id = str(uuid.uuid4())
    tasks_db[task_id] = {
        "id": task_id,
        "query": request.query,
        "status": "pending",
        "result": None,
        "error": None
    }
    
    # Save initial pending state
    from api.db import save_mission
    save_mission(task_id, request.query, "running", None, None)
    
    loop = asyncio.get_running_loop()
    bg_tasks.add_task(run_crew_task, task_id, request.query, loop)
    return {"task_id": task_id, "status": "pending"}

@app.websocket("/api/ws/logs/{task_id}")
async def websocket_logs(websocket: WebSocket, task_id: str):
    await manager.connect(websocket, task_id)
    try:
        while True:
            # Keep connection alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, task_id)


@app.get("/api/status/{task_id}")
async def get_status(task_id: str):
    """Returns the status of a specific analysis."""
    # First check memory
    if task_id in tasks_db:
        return tasks_db[task_id]
        
    # Then check DB
    from api.db import get_mission_result, get_history
    res = get_mission_result(task_id)
    if res:
        return {"id": task_id, "status": "completed", "result": res}
        
    raise HTTPException(status_code=404, detail="Task not found")

@app.get("/api/history")
async def get_mission_history():
    """Returns all past missions."""
    from api.db import get_history
    return get_history()

@app.get("/api/telemetry")
async def get_system_telemetry():
    """Returns real system metrics including LLM key pool status."""
    from api.db import get_telemetry
    from utils.llm_manager import pool_status
    telemetry = get_telemetry()
    telemetry["llm_key_pool"] = pool_status()
    return telemetry

@app.get("/api/geocoder/search")
async def search_location(q: str):
    """Geocode location name to coordinates, bounding box, display name."""
    from utils.geocoder import geocode_location
    res = geocode_location(q)
    if not res:
        raise HTTPException(status_code=404, detail=f"Location '{q}' not found.")
    return res


@app.get("/api/geocoder/nearby")
async def recommend_nearby_places(location: str):
    """
    Returns recommended nearby places, macro regional zoom-out targets,
    and micro local high-detail targets for a given location.
    """
    from utils.geocoder import get_nearby_places
    targets = get_nearby_places(location)
    return {"location": location, "recommended_targets": targets}


# ── Phase 4: Change Detection Direct API Endpoints ──────────────────────────

# These allow the TimeLens / MapExplorer pages to call spectral pipelines
# directly without triggering the full 10-agent crew.

class Phase4Request(BaseModel):
    location: str
    year_t1: int = 2018
    year_t2: int = 2024

class FloodRequest(BaseModel):
    location: str
    flood_start: str
    flood_end: str
    baseline_year: int = 2022

class WildfireRequest(BaseModel):
    location: str
    fire_start: str
    fire_end: str
    pre_fire_start: str
    pre_fire_end: str


def _init_gee_aoi(location: str):
    """Geocode location string to a GEE Geometry.Rectangle."""
    from utils.geocoder import geocode_location
    geo = geocode_location(location)
    if not geo:
        return None, None
    bbox = geo["bbox_ee"]
    aoi  = ee.Geometry.Rectangle(bbox)
    return aoi, geo


@app.post("/api/timelens/change")
async def timelens_ndvi_change(req: Phase4Request):
    """
    Run NDVI Change + Urban Expansion CVA for a location between two years.
    Used by the TimeLens page CHANGE DETECTION tab.
    """
    try:
        aoi, geo = _init_gee_aoi(req.location)
        if aoi is None:
            raise HTTPException(status_code=404, detail=f"Location not found: {req.location}")

        from utils.spectral_pipeline import run_change_vector_analysis
        result = run_change_vector_analysis(req.location, aoi, req.year_t1, req.year_t2)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/timelens/flood")
async def timelens_flood(req: FloodRequest):
    """
    Run NDWI optical + SAR flood detection for an event period.
    Used by the TimeLens FLOOD ANALYSIS tab.
    """
    try:
        aoi, geo = _init_gee_aoi(req.location)
        if aoi is None:
            raise HTTPException(status_code=404, detail=f"Location not found: {req.location}")

        from utils.spectral_pipeline import run_ndwi_flood_pipeline, run_sar_flood_pipeline

        ndwi_result = run_ndwi_flood_pipeline(
            req.location, aoi, req.flood_start, req.flood_end, req.baseline_year
        )

        # SAR baseline: same month one year prior
        try:
            b_year = req.baseline_year
            b_start = f"{b_year}-{req.flood_start[5:]}"
            b_end   = f"{b_year}-{req.flood_end[5:]}"
            sar_result = run_sar_flood_pipeline(
                req.location, aoi, req.flood_start, req.flood_end, b_start, b_end
            )
        except Exception:
            sar_result = {"error": "SAR data unavailable for this region/period"}

        return {
            "location": req.location,
            "flood_period": {"start": req.flood_start, "end": req.flood_end},
            "ndwi_optical": ndwi_result,
            "sar_microwave": sar_result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/timelens/wildfire")
async def timelens_wildfire(req: WildfireRequest):
    """
    Run wildfire NBR burn severity pipeline.
    Used by the TimeLens WILDFIRE tab.
    """
    try:
        aoi, geo = _init_gee_aoi(req.location)
        if aoi is None:
            raise HTTPException(status_code=404, detail=f"Location not found: {req.location}")

        from utils.spectral_pipeline import run_wildfire_pipeline
        result = run_wildfire_pipeline(
            req.location, aoi,
            req.fire_start, req.fire_end,
            req.pre_fire_start, req.pre_fire_end
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/timelens/urban")
async def timelens_urban(req: Phase4Request):
    """
    Run Dynamic World urban expansion pipeline between two years.
    Used by the MapExplorer Urban Sprawl layer.
    """
    try:
        aoi, geo = _init_gee_aoi(req.location)
        if aoi is None:
            raise HTTPException(status_code=404, detail=f"Location not found: {req.location}")

        from utils.spectral_pipeline import run_urban_expansion_pipeline
        result = run_urban_expansion_pipeline(req.location, aoi, req.year_t1, req.year_t2)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/timelens/evi")
async def timelens_evi(location: str, start_date: str, end_date: str):
    """
    Run EVI vegetation index for a location and date range.
    Used by the MapExplorer Vegetation layer.
    """
    try:
        aoi, geo = _init_gee_aoi(location)
        if aoi is None:
            raise HTTPException(status_code=404, detail=f"Location not found: {location}")

        from utils.spectral_pipeline import run_evi_pipeline
        result = run_evi_pipeline(location, aoi, start_date, end_date)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Serve the static frontend
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
if not os.path.exists(FRONTEND_DIR):
    os.makedirs(FRONTEND_DIR)

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

# Also serve maps
MAPS_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "maps")
if not os.path.exists(MAPS_DIR):
    os.makedirs(MAPS_DIR)
app.mount("/maps", StaticFiles(directory=MAPS_DIR), name="maps")

@app.get("/")
async def root():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend not found. Please create frontend/index.html"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.server:app", host="0.0.0.0", port=8000, reload=True)

