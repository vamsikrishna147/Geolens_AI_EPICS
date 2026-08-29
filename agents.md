# GeoLens AI — Agent Instructions

## 1. Project Rule

GeoLens AI is an AI-powered multi-agent geospatial intelligence platform.

The system allows users to interact with satellite and geospatial data using natural language. AI agents interpret the request, retrieve appropriate data, perform GIS and remote-sensing analysis, detect changes, and generate understandable results and reports.

Always understand the existing architecture before modifying code.

---

## 2. Core Technology Stack

### AI
- CrewAI for multi-agent orchestration
- Gemini API for cloud-based LLM reasoning
- Ollama for local/offline LLM inference when configured

### Geospatial
- Google Earth Engine (GEE)
- Sentinel-2 and other satellite datasets
- GeoPandas
- Rasterio
- Shapely
- GDAL / PyProj where required

### Maps and Location
- Google Maps APIs for map/location services
- Geocoding
- Places / POI information
- Leaflet / MapLibre where already used

### Backend
- Python
- FastAPI
- REST APIs
- WebSocket where required

### Frontend
- React.js
- Tailwind CSS
- Interactive maps
- Charts and analysis visualizations

### Storage
- PostgreSQL + PostGIS
- MongoDB
- Redis where required

---

## 3. Multi-Agent Architecture

The primary agent workflow is:

1. Planner Agent
2. Data Sourcing Agent
3. GIS Agent
4. Earth Observation Agent
5. Final Reporting Agent

CrewAI orchestrates the agents in a sequential workflow.

Do not change agent responsibilities without a clear architectural reason.

---

## 4. Agent Responsibilities

### Planner Agent
- Understand the user's natural-language query.
- Identify location/AOI.
- Identify required time period.
- Determine analysis type.
- Create an execution plan.
- Decide which agents and data sources are required.

### Data Sourcing Agent
- Discover relevant datasets.
- Retrieve satellite and geospatial data.
- Use appropriate external APIs.
- Consider AOI and time range.
- Prefer trusted and authoritative sources.

### GIS Agent
- Perform spatial operations.
- Handle vector/raster processing.
- Perform clipping, buffering, overlay, spatial joins and related operations.
- Prepare spatial data for analysis.

### Earth Observation Agent
- Perform remote-sensing analysis.
- Work with satellite imagery.
- Calculate spectral indices such as NDVI, NDWI and EVI when required.
- Perform temporal analysis and change detection.
- Support TimeLens functionality.

### Final Reporting Agent
- Combine analysis results.
- Generate understandable explanations.
- Produce maps, statistics and insights.
- Generate reports and structured outputs.

---

## 5. Important Architecture Rules

- GEE is the primary satellite-processing platform.
- Google Maps is primarily a location, mapping and geographic-context service.
- Do not use Google Maps as a replacement for GEE satellite analysis.
- NASA and government APIs provide additional data/context.
- Gemini and Ollama provide language-model reasoning.
- GIS calculations must remain deterministic and reproducible where possible.
- LLMs should interpret and explain results, not invent scientific measurements.
- Existing working modules should be reused instead of unnecessarily rewritten.

---

## 6. Coding Rules

Before changing code:

1. Inspect the relevant existing files.
2. Understand how the current module is connected.
3. Reuse existing functions and utilities.
4. Modify only the files required for the task.
5. Do not perform large refactors for small requirements.
6. Preserve existing API contracts unless explicitly asked to change them.
7. Keep secrets and API keys outside source code.

Never hardcode:

- API keys
- passwords
- database credentials
- tokens
- private URLs

Use environment variables.

---

## 7. Context and Token Efficiency

Do not scan the entire repository for every task.

Only inspect files relevant to the current task.

Prefer:

"Inspect planner_agent.py and geolens_crew.py."

Instead of:

"Analyze the entire project."

Avoid repeatedly reading the same large files.

Do not generate unnecessary explanations or large logs.

When running commands, prefer targeted output.

Example:

pytest tests/test_planner.py -q

instead of running the complete test suite unless required.

---

## 8. Testing

After modifications:

1. Run the smallest relevant test.
2. Verify the changed functionality.
3. Check integration points.
4. Avoid unrelated tests unless required.

For API changes, verify both backend behavior and frontend integration when applicable.

For GIS changes, verify coordinate systems, AOI boundaries and spatial validity.

---

## 9. Git Rules

Do not:

- delete branches
- reset the repository
- force-push
- remove files
- overwrite unrelated changes

unless explicitly requested.

Do not commit changes unless requested.

---

## 10. Change Management

Before major changes:

- briefly identify the affected modules
- explain the intended change
- preserve existing architecture where possible

After completing a major task, update `CURRENT_STATUS.md`.

Keep the status file concise.

---

## 11. Priority

When making decisions, prioritize:

1. Correctness
2. Existing architecture
3. Scientific validity
4. Security
5. Maintainability
6. Performance
7. Token/context efficiency