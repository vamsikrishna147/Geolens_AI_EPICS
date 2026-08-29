import os
import sys
import uuid
import asyncio
from typing import Dict, Any, List

from dotenv import load_dotenv

load_dotenv()

import ee
try:
    ee.Initialize(project=os.getenv("GEE_PROJECT_ID"))
    print("Google Earth Engine initialised.")
except Exception as e:
    print(f"GEE init skipped: {e}")

from fastapi import FastAPI, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from crews.geolens_crew import GeoLensCrew

app = FastAPI(title="GeoLens AI API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

tasks_db: Dict[str, Dict[str, Any]] = {}

class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, list[WebSocket]] = {}

    async def connect(self, ws: WebSocket, task_id: str):
        await ws.accept()
        self._connections.setdefault(task_id, []).append(ws)

    def disconnect(self, ws: WebSocket, task_id: str):
        conns = self._connections.get(task_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(task_id, None)

    async def broadcast(self, task_id: str, message: str):
        for ws in self._connections.get(task_id, []):
            try:
                await ws.send_text(message)
            except Exception:
                pass

manager = ConnectionManager()

class StreamToWebSocket:
    def __init__(self, task_id: str, mgr: ConnectionManager, loop: asyncio.AbstractEventLoop):
        self.task_id = task_id
        self.mgr = mgr
        self.loop = loop
        self._original = sys.stdout

    def write(self, data: str):
        self._original.write(data)
        if data.strip():
            asyncio.run_coroutine_threadsafe(
                self.mgr.broadcast(self.task_id, data.strip()), self.loop
            )

    def flush(self):
        self._original.flush()


def _run_crew(task_id: str, query: str, loop: asyncio.AbstractEventLoop):
    tasks_db[task_id]["status"] = "running"

    interceptor = StreamToWebSocket(task_id, manager, loop)
    old_stdout = sys.stdout
    sys.stdout = interceptor

    try:
        crew = GeoLensCrew(verbose=True)
        result = crew.run(query)

        # 1. Pydantic Serialization
        serialized_result = {}
        for key, val in result.items():
            if hasattr(val, 'model_dump'):
                serialized_result[key] = val.model_dump()
            else:
                serialized_result[key] = val

        tasks_db[task_id]["status"] = "completed"
        tasks_db[task_id]["result"] = serialized_result

        # 2. Save Session to Workspace
        workspace_dir = os.path.abspath("./workspace")
        sessions_dir = os.path.join(workspace_dir, "sessions")
        reports_dir = os.path.join(workspace_dir, "reports")
        os.makedirs(sessions_dir, exist_ok=True)
        os.makedirs(reports_dir, exist_ok=True)

        session_file = os.path.join(sessions_dir, f"Session_{task_id}.json")
        with open(session_file, "w", encoding="utf-8") as f:
            import json
            json.dump(serialized_result, f, indent=2, default=str)

        # 3. Generate Professional Markdown Report with Embedded Imagery
        report_data = serialized_result.get("official_report")
        if report_data:
            md_content = f"# Intelligence Report: {report_data.get('title', 'GeoLens Mission')}\n\n"
            md_content += f"**Classification:** {report_data.get('classification', 'UNCLASSIFIED')}\n"
            md_content += f"**Report ID:** {report_data.get('report_id', task_id)}\n\n"
            md_content += f"## Executive Summary\n{report_data.get('executive_summary', '')}\n\n"
            
            md_content += "## Visual Evidence & Satellite Imagery\n"
            # Scan ./data for recent images to embed
            data_dir = os.path.abspath("./data")
            if os.path.exists(data_dir):
                import glob
                images = glob.glob(os.path.join(data_dir, "**", "*.png"), recursive=True)
                images += glob.glob(os.path.join(data_dir, "**", "*.jpg"), recursive=True)
                # Sort by modified time to get the newest
                images.sort(key=os.path.getmtime, reverse=True)
                if images:
                    for img in images[:3]: # Embed top 3 recent images
                        md_content += f"![Satellite Imagery](file:///{img.replace(chr(92), '/')})\n\n"
                else:
                    md_content += "_No local satellite imagery captured during this mission._\n\n"
            
            report_file = os.path.join(reports_dir, f"Mission_Report_{task_id}.md")
            with open(report_file, "w", encoding="utf-8") as f:
                f.write(md_content)

    except Exception as exc:
        tasks_db[task_id]["status"] = "failed"
        error_msg = str(exc)
        
        # 4. Fallback Image Preservation Message
        data_dir = os.path.abspath("./data")
        if os.path.exists(data_dir):
            import glob
            images = glob.glob(os.path.join(data_dir, "**", "*.png"), recursive=True)
            images.sort(key=os.path.getmtime, reverse=True)
            if images:
                recent_imgs = "\\n".join([img for img in images[:5]])
                error_msg += f"\n\n[FAIL-SAFE TRIGGERED]: The LLM engine timed out or failed, but successfully retrieved satellite imagery is preserved locally in your workspace! You can find them here:\n{recent_imgs}"
                
        tasks_db[task_id]["error"] = error_msg
    finally:
        sys.stdout = old_stdout


class AnalyzeRequest(BaseModel):
    query: str

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

class ChatMessage(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

@app.get("/api/workspace/sessions")
async def list_workspace_sessions():
    """Return all saved mission sessions from workspace/sessions/ directory."""
    import json as _json
    sessions_dir = os.path.abspath("./workspace/sessions")
    os.makedirs(sessions_dir, exist_ok=True)
    sessions = []
    for fname in sorted(os.listdir(sessions_dir), reverse=True):
        if not fname.endswith(".json"):
            continue
        fpath = os.path.join(sessions_dir, fname)
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = _json.load(f)
            task_id = fname.replace("Session_", "").replace(".json", "")
            title = "Untitled Analysis"
            if isinstance(data, dict):
                rpt = data.get("official_report") or data.get("analysis_plan") or {}
                title = rpt.get("title") or rpt.get("query_summary") or title
            sessions.append({
                "id": task_id,
                "title": title,
                "status": "completed",
                "date": os.path.getmtime(fpath),
                "filename": fname,
            })
        except Exception:
            continue
    return {"sessions": sessions}

@app.get("/api/workspace/sessions/{session_id}")
async def get_workspace_session(session_id: str):
    """Return a single saved session's full data."""
    import json as _json
    fpath = os.path.abspath(f"./workspace/sessions/Session_{session_id}.json")
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="Session not found")
    with open(fpath, "r", encoding="utf-8") as f:
        data = _json.load(f)
    return data

@app.post("/api/analyze")
async def start_analysis(request: AnalyzeRequest, bg_tasks: BackgroundTasks):
    task_id = str(uuid.uuid4())
    tasks_db[task_id] = {
        "id": task_id,
        "query": request.query,
        "status": "pending",
        "result": None,
        "error": None,
    }
    loop = asyncio.get_running_loop()
    bg_tasks.add_task(_run_crew, task_id, request.query, loop)
    return {"task_id": task_id, "status": "pending"}


@app.get("/api/status/{task_id}")
async def get_status(task_id: str):
    task = tasks_db.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.websocket("/api/ws/logs/{task_id}")
async def websocket_logs(websocket: WebSocket, task_id: str):
    await manager.connect(websocket, task_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, task_id)


@app.get("/api/geocoder/search")
async def search_location(q: str):
    from utils.geocoder import geocode_location
    result = geocode_location(q)
    if not result:
        raise HTTPException(status_code=404, detail=f"Location '{q}' not found.")
    return result


@app.get("/api/geocoder/nearby")
async def nearby_places(location: str):
    from utils.geocoder import get_nearby_places
    targets = get_nearby_places(location)
    return {"location": location, "recommended_targets": targets}


def _geocode_to_aoi(location: str):
    from utils.geocoder import geocode_location
    geo = geocode_location(location)
    if not geo:
        return None, None
    return ee.Geometry.Rectangle(geo["bbox_ee"]), geo


@app.post("/api/timelens/change")
async def timelens_change(req: Phase4Request):
    try:
        aoi, _ = _geocode_to_aoi(req.location)
        if aoi is None:
            raise HTTPException(status_code=404, detail=f"Location not found: {req.location}")
        from utils.spectral_pipeline import run_change_vector_analysis
        return run_change_vector_analysis(req.location, aoi, req.year_t1, req.year_t2)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/timelens/flood")
async def timelens_flood(req: FloodRequest):
    try:
        aoi, geo = _geocode_to_aoi(req.location)
        if aoi is None:
            raise HTTPException(status_code=404, detail=f"Location not found: {req.location}")
        from utils.spectral_pipeline import run_ndwi_flood_pipeline, run_sar_flood_pipeline
        ndwi_res = run_ndwi_flood_pipeline(req.location, aoi, req.flood_start, req.flood_end, req.baseline_year)
        if "error" in ndwi_res:
            return run_sar_flood_pipeline(req.location, geo["bbox_ee"], req.flood_start, req.flood_end)
        return ndwi_res
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/timelens/wildfire")
async def timelens_wildfire(req: WildfireRequest):
    try:
        aoi, _ = _geocode_to_aoi(req.location)
        if aoi is None:
            raise HTTPException(status_code=404, detail=f"Location not found: {req.location}")
        from utils.spectral_pipeline import run_wildfire_pipeline
        return run_wildfire_pipeline(req.location, aoi, req.fire_start, req.fire_end, req.pre_fire_start, req.pre_fire_end)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/timelens/urban")
async def timelens_urban(req: Phase4Request):
    try:
        aoi, _ = _geocode_to_aoi(req.location)
        if aoi is None:
            raise HTTPException(status_code=404, detail=f"Location not found: {req.location}")
        from utils.spectral_pipeline import run_urban_expansion_pipeline
        return run_urban_expansion_pipeline(req.location, aoi, req.year_t1, req.year_t2)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/timelens/evi")
async def timelens_evi(location: str):
    try:
        aoi, _ = _geocode_to_aoi(location)
        if aoi is None:
            raise HTTPException(status_code=404, detail=f"Location not found: {location}")
        from utils.spectral_pipeline import run_evi_pipeline
        return run_evi_pipeline(location, aoi)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/api/timelens/imagery")
async def timelens_imagery(location: str, yearBefore: str, yearAfter: str):
    """
    Returns actual satellite imagery URLs from Google Earth Engine for the TimeLensCompare UI.
    """
    from utils.geocoder import geocode_location
    geo = geocode_location(location)
    loc_name = geo["display_name"] if geo else location
    
    try:
        import ee
        try:
            ee.Initialize()
        except Exception:
            pass
            
        bbox = geo["bbox_ee"]
        aoi = ee.Geometry.Rectangle(bbox)
        
        def get_tile_url(year):
            col = (ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                   .filterBounds(aoi)
                   .filterDate(f"{year}-01-01", f"{year}-12-31")
                   .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 10)))
            if col.size().getInfo() == 0:
                # Fallback to Landsat if Sentinel-2 missing (e.g. before 2015)
                col = (ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
                       .filterBounds(aoi)
                       .filterDate(f"{year}-01-01", f"{year}-12-31")
                       .filter(ee.Filter.lt("CLOUD_COVER", 10)))
                img = col.median().clip(aoi).multiply(0.0000275).add(-0.2)
                vis = {'bands': ['SR_B4', 'SR_B3', 'SR_B2'], 'min': 0.0, 'max': 0.3}
            else:
                img = col.median().clip(aoi).multiply(0.0001)
                vis = {'bands': ['B4', 'B3', 'B2'], 'min': 0.0, 'max': 0.3}
                
            try:
                map_id = img.getMapId(vis)
                return map_id['tile_fetcher'].url_format
            except Exception as e:
                # Fallback to static thumb if MapId fails
                return img.getThumbURL(dict(**vis, dimensions=800, format='jpg'))

        url_before = get_tile_url(yearBefore)
        url_after = get_tile_url(yearAfter)
        
        return {
            "location": loc_name,
            "url_before": url_before,
            "url_after": url_after,
            "bounds": geo["bbox_ee"]
        }
        print(f"EE Imagery Notice: {e}")
        # Fallback to static URLs if EE fails
        url_before = "https://images.unsplash.com/photo-1594247545366-02e0c273ecb8?auto=format&fit=crop&q=80&w=1200"
        url_after = "https://images.unsplash.com/photo-1463116666993-9c8df6e08216?auto=format&fit=crop&q=80&w=1200"
        
    return {
        "location": loc_name,
        "url_before": url_before,
        "url_after": url_after
    }


@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Chat endpoint for the Assistant panel. Routes through LLM Manager (supporting Ollama & Gemini).
    """
    try:
        from utils.llm_manager import get_llm
        llm = get_llm(require_gemini=False)
        
        prompt = "You are GeoLens AI, an expert geospatial intelligence assistant. Be concise, highly professional, and helpful. Translate findings into clear language.\n\n"
        for msg in request.messages:
            role = "Commander" if msg.role == "user" else "GeoLens AI"
            prompt += f"{role}: {msg.text}\n"
        prompt += "GeoLens AI:"
        
        response = llm.call([{"role": "user", "content": prompt}])
        return {"response": str(response)}
    except Exception as e:
        print(f"Chat Pool Error: {e}, attempting direct Gemini fallback...")
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            import os
            api_key = os.getenv("GEMINI_API_KEY")
            llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                temperature=0.3,
                google_api_key=api_key
            )
            messages = [
                ("system", "You are GeoLens AI, an expert geospatial intelligence assistant. Be concise, highly professional, and helpful.")
            ]
            for msg in request.messages:
                if msg.role == "user":
                    messages.append(("human", msg.text))
                elif msg.role == "assistant" and "How can I assist" not in msg.text:
                    messages.append(("ai", msg.text))
            response = llm.invoke(messages)
            return {"response": response.content}
        except Exception as fallback_err:
            print(f"Chat Fallback Error: {fallback_err}")
            raise HTTPException(status_code=500, detail=str(fallback_err))


@app.get("/api/telemetry")
async def get_telemetry_status():
    from utils.llm_manager import pool_status
    return {
        "status": "online",
        "llm_pool": pool_status(),
        "active_tasks": len([t for t in tasks_db.values() if t["status"] == "running"]),
        "completed_tasks": len([t for t in tasks_db.values() if t["status"] == "completed"])
    }
