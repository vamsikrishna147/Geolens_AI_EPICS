# GeoLens AI — API Guide
# ======================
# Complete guide to all data sources, registration steps, and access methods.

## 🟢 No Registration Required (Works Immediately)

### Open-Meteo — Weather & Climate
- **URL:** https://open-meteo.com
- **What:** Free weather API. Current, forecast, and historical weather (1940–present).
- **Access:** Direct REST API. No key needed.
- **Rate limit:** 10,000 calls/day free tier.
- **Example:** `GET https://api.open-meteo.com/v1/forecast?latitude=16.5&longitude=81.8&daily=temperature_2m_max`

### OpenStreetMap / Overpass API — Maps & Boundaries
- **URL:** https://overpass-api.de
- **What:** Query any OSM feature — roads, buildings, water, land use by bounding box.
- **Access:** REST POST/GET. No key needed.
- **Rate limit:** Fair use (don't hammer — we batch requests).
- **Example:** `POST https://overpass-api.de/api/interpreter` with Overpass QL query

### OpenAlex — Research Papers
- **URL:** https://api.openalex.org
- **What:** 250M+ scholarly works. Free full API.
- **Access:** REST API. No key needed (add email for higher limits).
- **Rate limit:** 100,000 calls/day without key; higher with email polite pool.
- **Example:** `GET https://api.openalex.org/works?search=flood+detection+india`

### SoilGrids — Soil Data
- **URL:** https://rest.isric.org/soilgrids/v2.0
- **What:** Global soil properties (pH, carbon, texture) at 250m resolution.
- **Access:** REST API. No key needed.
- **Example:** `GET https://rest.isric.org/soilgrids/v2.0/properties/query?lon=81.8&lat=16.5`

### NASA POWER — Solar & Meteorological Data
- **URL:** https://power.larc.nasa.gov/api
- **What:** Solar radiation, temperature, wind, humidity globally (1981–present).
- **Access:** REST API. No key needed.
- **Example:** `GET https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOTCORR&start=20230101&end=20230107&latitude=16.5&longitude=81.8&community=RE&format=JSON`

### WorldPop — Population Data
- **URL:** https://www.worldpop.org/rest/data
- **What:** Population density rasters by country and year.
- **Access:** REST API. No key needed.
- **Example:** `GET https://www.worldpop.org/rest/data/pop/wpgp?iso3=IND`

### GADM — Administrative Boundaries
- **URL:** https://geodata.ucdavis.edu/gadm
- **What:** Country/state/district boundaries for every country.
- **Access:** Direct download (GeoJSON/GeoPackage). No key needed.
- **Example:** `GET https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_IND_2.json` (India district level)

### Nominatim — Geocoding
- **URL:** https://nominatim.openstreetmap.org
- **What:** Convert place names → coordinates/bounding boxes.
- **Access:** REST API. No key needed. Must set a descriptive User-Agent.
- **Rate limit:** 1 request/second. We cache all results.

---

## 🟡 Free Registration Required

### NASA FIRMS — Active Fire Data
- **URL:** https://firms.modaps.eosdis.nasa.gov/api/area/
- **Registration:** https://firms.modaps.eosdis.nasa.gov/api/area/ → click "Get MAP_KEY"
- **What:** Near real-time active fire/thermal anomaly data. VIIRS 375m & MODIS 1km.
- **Without key:** Last 7 days only (still very useful!)
- **With key:** Full archive from 2000 (MODIS) / 2012 (VIIRS)
- **Set in .env:** `NASA_FIRMS_API_KEY=your_map_key`

### Google Earth Engine — Satellite Imagery
- **URL:** https://earthengine.google.com/signup
- **Registration:** Google account required. Apply for non-commercial access (approved in hours).
- **What:** Sentinel-1, Sentinel-2, Landsat 8/9, MODIS, CHIRPS, ERA5, DEM and 900+ datasets.
- **Cost:** FREE for research and non-commercial use (petabyte-scale cloud processing).
- **After registration:**
  ```bash
  pip install earthengine-api
  earthengine authenticate   # Opens browser, follow instructions
  earthengine set_project your_project_id
  ```
- **Set in .env:** `GEE_PROJECT_ID=your_project_id`

### data.gov.in — India Government Data
- **URL:** https://data.gov.in/user/register
- **Registration:** Government of India Open Data portal (instant approval).
- **What:** 400,000+ datasets on Indian agriculture, demographics, infrastructure, water.
- **Set in .env:** `INDIA_GOV_API_KEY=your_api_key`

---

## 🔴 PostgreSQL + PostGIS Setup

### Install PostgreSQL with PostGIS Extension
1. Download: https://www.postgresql.org/download/windows/
2. During install, select "Stack Builder" and install PostGIS extension.
3. Or install PostGIS separately: https://postgis.net/install/

### Create the GeoLens Database
```sql
-- Run in psql or pgAdmin:
CREATE DATABASE geolens;
\c geolens
CREATE EXTENSION postgis;
CREATE EXTENSION postgis_topology;

-- Verify PostGIS is active:
SELECT PostGIS_Version();
```

### Set in .env:
```
POSTGIS_HOST=localhost
POSTGIS_PORT=5432
POSTGIS_DB=geolens
POSTGIS_USER=postgres
POSTGIS_PASSWORD=your_password
```

---

## 📋 Quick Status Check
Run this in your terminal to see which APIs are ready:
```bash
python -c "from utils.api_status import print_api_status; print_api_status()"
```
