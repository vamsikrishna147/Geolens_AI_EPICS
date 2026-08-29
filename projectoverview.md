# GeoLens AI — Project Context

## 1. Project Name

GeoLens AI: An AI-Based Multi-Agent Geospatial Intelligence Platform for Automated Satellite Image Analysis and Environmental Change Detection

---

## 2. Project Objective

GeoLens AI aims to make satellite and geospatial analysis accessible through natural-language interaction.

Users can ask questions about a location, area or time period without needing extensive GIS programming knowledge.

The system interprets the request, identifies suitable datasets, performs geospatial and remote-sensing analysis, detects environmental or urban changes, and presents the results as maps, visualizations, statistics and reports.

---

## 3. Problem

Traditional geospatial analysis workflows are fragmented.

Users may need:

- GIS software
- satellite-data platforms
- programming
- remote-sensing knowledge
- manual dataset discovery
- multiple external data sources

This makes satellite analysis difficult for non-experts.

GeoLens AI aims to combine these activities into a single AI-assisted workflow.

---

## 4. Proposed Solution

GeoLens AI uses a multi-agent architecture.

A user provides a natural-language query.

Example:

"Analyze flooding in an area during the last seven days and compare it with the same period last year."

The system converts the query into an execution plan and coordinates specialized agents.

The agents retrieve appropriate data, perform spatial and remote-sensing analysis, detect changes, and generate an understandable final result.

---

## 5. High-Level Workflow

User Query
→ Gemini / Ollama
→ Planner Agent
→ Data and Location Retrieval
→ GIS / Earth Observation Agents
→ Analysis and Change Detection
→ Gemini / Ollama
→ Intelligence Report

---

## 6. Main Agents

### Planner Agent

Understands the user query and creates the execution plan.

### Data Sourcing Agent

Finds and retrieves relevant satellite and geospatial datasets.

### GIS Agent

Performs spatial operations and geoprocessing.

### Earth Observation Agent

Performs remote-sensing analysis, TimeLens processing and change detection.

### Final Reporting Agent

Generates insights, visualizations and intelligent reports.

The agents are orchestrated using CrewAI.

---

## 7. Data Sources

### Google Earth Engine

Primary platform for satellite-data access and processing.

Used for:

- satellite imagery
- image collections
- AOI filtering
- temporal filtering
- remote-sensing analysis

### Sentinel-2

Important optical satellite data source for applications such as:

- vegetation analysis
- land-cover analysis
- environmental monitoring
- urban change

### NASA

Provides additional Earth-observation datasets and visualization/context layers.

### Indian Government Data

Provides authoritative India-specific datasets where applicable.

### Google Maps

Provides:

- interactive geographic maps
- location search
- geocoding
- places / POIs
- geographic context

Google Maps is not the primary scientific satellite-processing engine.

---
Indian government data(freely limit provided)

## 8. AI Layer

### Gemini

Used for cloud-based language understanding, reasoning and report generation.

### Ollama

Provides local LLM inference where a local model is configured.

The system can use Gemini and/or Ollama depending on the deployment and task.

---

## 9. GIS and Analysis

GeoLens AI can use:

- GeoPandas
- Rasterio
- Shapely
- GDAL
- PyProj

Scientific processing may include:

- NDVI
- NDWI
- EVI
- dNBR
- flood analysis
- vegetation change
- urban change
- temporal comparison
- change detection

The exact algorithm should depend on the user's query and available datasets.

---

## 10. Frontend

The frontend provides:

- natural-language interaction
- interactive maps
- satellite/analysis visualization
- TimeLens comparison
- charts
- reports
- workspace/session interaction

The project uses React-based UI components.

---

## 11. Backend

The backend provides:

- API endpoints
- agent execution
- external API integration
- GIS processing
- analysis execution
- report generation
- session management

FastAPI is used for the current backend architecture.

---

## 12. Storage

### PostgreSQL + PostGIS

Used for spatial data and geospatial database operations.

### MongoDB

Used for logging/session or flexible document-oriented storage where required.

### Redis

Used where caching or temporary task/state management is required.

---

## 13. Core Design Principle

GeoLens AI separates:

LOCATION
→ Where is the target?

SATELLITE DATA
→ What does Earth-observation data show?

CONTEXT DATA
→ What additional information is available?

GIS / EO ANALYSIS
→ What changed or what spatial relationship exists?

AI REASONING
→ How should the results be explained?

REPORTING
→ How should the result be presented to the user?

---

## 14. Current Project Architecture

The main project contains:

- `api/`
- `agents/`
- `crews/`
- `tools/`
- `utils/`
- `storage/`
- `geolens-ui/`
- `workspace/`
- `tests/`

The existing architecture includes dedicated modules for GEE, mapping, raster processing, vector processing, screenshots, change detection, geocoding and spectral analysis.

---

## 15. Development Principle

GeoLens AI should evolve incrementally.

Prefer extending existing components over replacing the architecture.

Do not introduce a new technology when an existing project component already solves the requirement adequately.