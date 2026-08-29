# GeoLens AI — System Architecture

## 1. Architecture Overview

GeoLens AI follows a multi-agent geospatial intelligence architecture.

The system combines:

- Natural Language Processing
- Large Language Models
- Multi-Agent orchestration
- Satellite data
- GIS processing
- Remote sensing
- Change detection
- Geographic context
- Spatial databases
- Interactive visualization
- Automated reporting

---

## 2. High-Level Architecture

User
↓
Natural Language Query
↓
Gemini / Ollama
↓
Planner Agent
↓
┌─────────────────────────────────────────────┐
│                                             │
│ Location Layer   Satellite Data   Context   │
│                                             │
│ Google Maps      GEE / NASA       Govt APIs │
│ Geocoding        Sentinel-2       Datasets  │
│ Places                                      │
│                                             │
└─────────────────────────────────────────────┘
↓
GIS / EO Agents
↓
Analysis + Change Detection
↓
Gemini / Ollama
↓
Intelligence Report

---

## 3. Frontend Layer

The frontend provides the user interface.

Main responsibilities:

- Natural-language query input
- Interactive map
- Location selection
- Analysis visualization
- TimeLens comparison
- Charts
- Reports
- Workspace interaction

Primary technology:

- React.js
- Tailwind CSS
- Leaflet / MapLibre where applicable
- Charting libraries where required

---

## 4. API / Backend Layer

The backend coordinates the application.

Responsibilities:

- Receive user requests
- Validate input
- Communicate with agents
- Manage external API calls
- Execute analysis
- Stream status/log information where required
- Return structured results
- Manage sessions and outputs

Primary technology:

- Python
- FastAPI
- REST
- WebSocket where required

---

## 5. AI and Agent Layer

CrewAI manages the multi-agent workflow.

### Planner Agent

Input:

- Natural-language query

Output:

- location/AOI requirements
- time range
- analysis objective
- required datasets
- execution plan

---

### Data Sourcing Agent

Input:

- planner output

Responsibilities:

- dataset discovery
- satellite-data retrieval
- external data retrieval
- filtering by location and time

Output:

- relevant datasets/data references

---

### GIS Agent

Input:

- AOI
- spatial datasets
- retrieved data

Responsibilities:

- spatial joins
- overlays
- clipping
- buffering
- raster/vector operations
- spatial preprocessing

Output:

- processed spatial data

---

### Earth Observation Agent

Input:

- satellite imagery
- processed AOI
- temporal information

Responsibilities:

- remote-sensing analysis
- spectral-index calculation
- TimeLens analysis
- temporal comparison
- change detection

Output:

- scientific measurements
- change layers
- statistics
- analysis results

---

### Final Reporting Agent

Input:

- GIS results
- EO results
- statistics
- maps
- change metrics

Responsibilities:

- summarize findings
- explain results
- generate insights
- produce structured reports
- prepare user-facing output

Output:

- intelligence report
- maps
- charts
- statistics
- recommendations where supported by analysis

---

## 6. Data Layer

### Location Layer

Google Maps services can provide:

- map visualization
- geocoding
- reverse geocoding
- places / POIs
- geographic context

Nominatim may be retained as a fallback geocoder where applicable.

---

### Satellite Data Layer

Google Earth Engine provides access to satellite collections and processing capabilities.

Datasets may include:

- Sentinel-2
- Sentinel-1
- Landsat
- other GEE-supported datasets

NASA services can provide additional Earth-observation visualization/data.

---

### Context Data Layer

Context information can come from:

- Indian Government APIs
- government datasets
- environmental datasets
- weather datasets
- other trusted sources

Only use a context source when it is relevant to the query.

---

## 7. GIS Processing Layer

The GIS processing layer uses Python geospatial libraries.

Main components:

- GeoPandas
- Rasterio
- Shapely
- GDAL
- PyProj

Responsibilities include:

- AOI processing
- coordinate transformation
- raster operations
- vector operations
- spatial overlays
- spatial statistics

---

## 8. Remote-Sensing Layer

The remote-sensing pipeline handles scientific calculations.

Possible analysis:

- NDVI
- NDWI
- EVI
- dNBR
- SAR-based flood analysis
- temporal change
- vegetation change
- urban change

Algorithms must be selected according to the query and available data.

---

## 9. Change Detection

TimeLens compares observations across different dates or periods.

Example:

Image/Index at T1
↓
Image/Index at T2
↓
Difference / Change Detection
↓
Change Map
↓
Statistics
↓
AI Explanation

Change detection may use appropriate methods such as spectral change analysis or other project-supported algorithms.

---

## 10. Storage Architecture

### PostGIS

Used for:

- spatial data
- geometries
- spatial queries
- geographic relationships

### MongoDB

Used for:

- logs
- flexible documents
- session-related information where applicable

### Redis

Used where temporary state, caching or task coordination is required.

---

## 11. Output Layer

GeoLens AI can generate:

- interactive maps
- satellite comparisons
- TimeLens visualizations
- charts
- statistics
- AI-generated explanations
- reports
- JSON/Markdown outputs
- downloadable artifacts

---

## 12. Main Data Flow

1. User submits a natural-language query.
2. LLM interprets the request.
3. Planner Agent creates an execution plan.
4. Location services resolve the geographic target.
5. Data Sourcing Agent identifies required datasets.
6. Satellite and contextual data are retrieved.
7. GIS Agent performs spatial preprocessing.
8. Earth Observation Agent performs remote-sensing analysis.
9. Change detection/temporal analysis is performed when required.
10. Results are passed to the Reporting Agent.
11. Gemini/Ollama converts results into understandable insights.
12. Frontend displays maps, charts and reports.

---

## 13. Architectural Principle

Each component should have a clear responsibility.

Google Maps:
LOCATION + MAP + POI CONTEXT

GEE:
SATELLITE DATA + REMOTE-SENSING PROCESSING

NASA:
EARTH-OBSERVATION DATA/CONTEXT

Government APIs:
AUTHORITATIVE CONTEXT DATA

GIS ENGINE:
SPATIAL PROCESSING

CrewAI:
AGENT ORCHESTRATION

Gemini/Ollama:
LANGUAGE UNDERSTANDING + REASONING + EXPLANATION

PostGIS:
SPATIAL STORAGE

React:
USER INTERFACE