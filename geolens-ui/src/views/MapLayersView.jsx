/**
 * MapLayersView — "Map & Analyzer"
 *
 * Full-screen interactive map with:
 *  - Base layer switcher (Satellite / Topo / Street)
 *  - Real satellite overlays — all WMS tile layers from NASA GIBS (no backend needed)
 *  - Location geocoder search
 *  - Bounding-box drawing tool → triggers an AI mission
 *  - Nearby exploration targets panel
 *
 * All satellite overlays use live WMS tiles from:
 *   https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Layers, Map as MapIcon, Eye, EyeOff,
  Target, Play, Loader2, Search, Compass,
  ZoomIn, ZoomOut, Navigation, Ruler, X,
  Download, CheckCircle, FileImage, FileText, Globe,
} from 'lucide-react';
import {
  MapContainer, TileLayer, WMSTileLayer,
  useMap, useMapEvents, Rectangle, Polyline, CircleMarker,
} from 'react-leaflet';
import L from 'leaflet';
import { useMission } from '../context/MissionContext';
import { useLanguage } from '../context/LanguageContext';
import { API_BASE_URL } from '../config/api';

const API             = API_BASE_URL;
const GIBS_WMS        = 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi';
// NASA GIBS has a 1-3 day processing lag. Using today causes empty tiles (black stripes).
// Always request 3 days ago to ensure complete global coverage exists.
const _threeDaysAgo = new Date();
_threeDaysAgo.setDate(_threeDaysAgo.getDate() - 3);
const GIBS_DATE = _threeDaysAgo.toISOString().slice(0, 10);

// ── Real WMS overlay definitions ──────────────────────────────────────
// All come directly from NASA GIBS — they render globally on any map zoom.
const OVERLAYS = [
  {
    id:     'fire',
    label:  'Fire Anomalies',
    sub:    'NASA FIRMS · MODIS Terra · Live',
    color:  '#ff4444',
    layer:  'MODIS_Terra_Thermal_Anomalies_All',
    format: 'image/png',
    opacity: 0.85,
  },
  {
    id:     'truecolor',
    label:  'True Colour',
    sub:    'NASA MODIS Terra · corrected reflectance',
    color:  '#60a5fa',
    layer:  'MODIS_Terra_CorrectedReflectance_TrueColor',
    format: 'image/jpeg',
    opacity: 1.0,
  },
  {
    id:     'aod',
    label:  'Aerosol / Air Quality',
    sub:    'NASA MODIS Terra · Aerosol Optical Depth',
    color:  '#f97316',
    layer:  'MODIS_Terra_Aerosol',
    format: 'image/png',
    opacity: 0.8,
  },
];

// ── Leaflet icon fix ──────────────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ── Map sub-components ────────────────────────────────────────────────

function MapFlyController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && Array.isArray(center) && typeof center[0] === 'number' && typeof center[1] === 'number' && !isNaN(center[0]) && !isNaN(center[1])) {
      try {
        map.flyTo(center, zoom || 5, { duration: 1.5 });
      } catch (_) {}
    }
  }, [center, zoom, map]);
  return null;
}

function DrawingManager({ isDrawing, bounds, setBounds, setIsDrawing }) {
  const map        = useMap();
  const [anchor, setAnchor]   = useState(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (isDrawing) { map.dragging.disable(); map._container.style.cursor = 'crosshair'; }
    else           { map.dragging.enable();  map._container.style.cursor = ''; }
  }, [isDrawing, map]);

  useMapEvents({
    mousedown(e) { if (!isDrawing) return; setAnchor(e.latlng); setDragging(true); setBounds(null); },
    mousemove(e) { if (!isDrawing || !dragging || !anchor) return; setBounds(L.latLngBounds(anchor, e.latlng)); },
    mouseup()    { if (!isDrawing || !dragging) return; setDragging(false); setIsDrawing(false); },
  });

  return bounds
    ? <Rectangle bounds={bounds} pathOptions={{ color: '#00f6ff', weight: 2, fillOpacity: 0.12, dashArray: '6 3' }} />
    : null;
}

// ── Viewport Tracker — tracks current map bounding box for direct download ────
function ViewportTracker({ onViewportChange }) {
  const map = useMap();
  useEffect(() => {
    const handleUpdate = () => {
      try {
        if (onViewportChange) onViewportChange(map.getBounds());
      } catch (_) {}
    };
    map.on('moveend', handleUpdate);
    map.on('zoomend', handleUpdate);
    handleUpdate();
    return () => {
      map.off('moveend', handleUpdate);
      map.off('zoomend', handleUpdate);
    };
  }, [map, onViewportChange]);
  return null;
}

// ── Ruler Manager — handles clicks, live preview line, dot markers ────
function RulerManager({ rulerActive, rulerPoints, setRulerPoints, setRulerDistance, setMouseLatLng }) {
  const map = useMap();

  useEffect(() => {
    if (rulerActive) {
      map._container.style.cursor = 'crosshair';
    } else {
      map._container.style.cursor = '';
    }
  }, [rulerActive, map]);

  useMapEvents({
    click(e) {
      if (!rulerActive) return;
      setRulerPoints(prev => {
        // On 3rd+ click, reset and start fresh from this point
        if (prev.length >= 2) {
          setRulerDistance(null);
          return [[e.latlng.lat, e.latlng.lng]];
        }
        const next = [...prev, [e.latlng.lat, e.latlng.lng]];
        if (next.length === 2) {
          const dist = L.latLng(next[0]).distanceTo(L.latLng(next[1]));
          setRulerDistance(dist >= 1000
            ? `${(dist / 1000).toFixed(2)} km`
            : `${Math.round(dist)} m`
          );
        }
        return next;
      });
    },
    mousemove(e) {
      if (rulerActive) setMouseLatLng([e.latlng.lat, e.latlng.lng]);
    },
    mouseout() {
      setMouseLatLng(null);
    }
  });

  return null;
}

// ── Overlay toggle button ─────────────────────────────────────────────

function OverlayRow({ overlay, active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md border transition-colors group ${
        active
          ? 'bg-mc-panel border-mc-border shadow-sm'
          : 'bg-transparent border-mc-border/40 hover:border-mc-border/70'
      }`}
    >
      <div className="flex items-center gap-2.5 text-left min-w-0">
        <div
          className="w-2 h-2 rounded-full shrink-0 transition-opacity"
          style={{ backgroundColor: overlay.color, opacity: active ? 1 : 0.4 }}
        />
        <div className="min-w-0">
          <p className={`font-mono text-xs font-medium truncate transition-colors ${
            active ? 'text-mc-text' : 'text-mc-muted group-hover:text-mc-text'
          }`}>
            {overlay.label}
          </p>
          <p className="text-[9px] text-mc-muted/70 font-mono truncate">{overlay.sub}</p>
        </div>
      </div>
      <div className={`shrink-0 transition-colors ${active ? 'text-mc-primary' : 'text-mc-border group-hover:text-mc-muted'}`}>
        {active ? <Eye size={15} /> : <EyeOff size={15} />}
      </div>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────

export default function MapLayersView({ onBack, initialParams }) {
  const { executeDirective } = useMission();
  const { language } = useLanguage();

  // Map state
  const [activeBase, setActiveBase]     = useState('Esri Satellite');
  const [activeLayers, setActiveLayers] = useState(new Set(['fire']));
  const [mapCenter, setMapCenter]       = useState([20.5937, 78.9629]);
  const [mapZoom, setMapZoom]           = useState(5);
  const [placeName, setPlaceName]       = useState('India');
  const [analysisYear, setAnalysisYear] = useState(new Date().getFullYear());

  // Drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [bounds, setBounds]       = useState(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Nearby targets
  const [nearbyTargets, setNearbyTargets] = useState([]);

  // ── Ruler Tool State ────────────────────────────────────────────────
  const [rulerActive, setRulerActive]     = useState(false);
  const [rulerPoints, setRulerPoints]     = useState([]);   // confirmed points [[lat,lng],...]
  const [rulerDistance, setRulerDistance] = useState(null);
  const [mouseLatLng, setMouseLatLng]     = useState(null); // live mouse pos for preview line

  const handleResetRuler = useCallback(() => {
    setRulerPoints([]);
    setRulerDistance(null);
    setMouseLatLng(null);
  }, []);

  const handleToggleRuler = useCallback(() => {
    setRulerActive(r => {
      if (r) handleResetRuler();
      return !r;
    });
  }, [handleResetRuler]);

  // Handle Initial Params mapping navigation
  useEffect(() => {
    if (initialParams?.location) {
      handleSearch(null, initialParams.location);
      if (initialParams.year) {
         setAnalysisYear(parseInt(initialParams.year, 10));
      }
    }
  }, [initialParams]);

  useEffect(() => {
    if (!placeName) return;
    fetch(`${API}/api/geocoder/nearby?location=${encodeURIComponent(placeName)}&lang=${encodeURIComponent(language || 'en')}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.recommended_targets) setNearbyTargets(data.recommended_targets); })
      .catch(() => {});
  }, [placeName, language]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleSearch = async (e, explicitQuery = null) => {
    e?.preventDefault();
    const queryToUse = explicitQuery || searchQuery;
    if (!queryToUse.trim()) return;
    setIsSearching(true);
    try {
      const res  = await fetch(`${API}/api/geocoder/search?q=${encodeURIComponent(queryToUse)}&lang=${encodeURIComponent(language || 'en')}`);
      const data = await res.json();
      if (res.ok && data.lat && data.lon) {
        setMapCenter([data.lat, data.lon]);
        setMapZoom(10);
        setPlaceName(data.display_name?.split(',')[0] || queryToUse);
        setNearbyTargets([]);
      } else {
        alert('Location not found — try a city or country name.');
      }
    } catch {
      alert('Geocoder unavailable — Python server may not be running.');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleLayer = (id) =>
    setActiveLayers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const [viewportBounds, setViewportBounds]   = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat]       = useState('png'); // 'png' | 'tif' | 'geojson'
  const [exportYear, setExportYear]           = useState('2024');
  const [isDownloading, setIsDownloading]     = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(null);

  const getAreaKm2 = (targetBounds = null) => {
    const b = targetBounds || bounds || viewportBounds;
    if (!b) return '0.00';
    try {
      const sw = b.getSouthWest(), ne = b.getNorthEast();
      const w  = sw.distanceTo(L.latLng(sw.lat, ne.lng));
      const h  = sw.distanceTo(L.latLng(ne.lat, sw.lng));
      return ((w * h) / 1_000_000).toFixed(2);
    } catch (_) {
      return '0.00';
    }
  };

  const handleDownloadSatellite = async (format = exportFormat, year = exportYear) => {
    const targetBounds = bounds || viewportBounds;
    if (!targetBounds) {
      alert('Please select an area on the map or zoom into a region.');
      return;
    }

    setIsDownloading(true);
    setDownloadSuccess(null);
    try {
      const sw = targetBounds.getSouthWest();
      const ne = targetBounds.getNorthEast();
      const bboxStr = `${sw.lng.toFixed(5)},${sw.lat.toFixed(5)},${ne.lng.toFixed(5)},${ne.lat.toFixed(5)}`;
      const effectiveLoc = placeName?.trim() || 'Selected_AOI';

      const url = `${API}/api/timelens/download/file?location=${encodeURIComponent(effectiveLoc)}&year=${year}&format=${format}&bbox=${bboxStr}`;

      const res = await fetch(url);
      if (!res.ok) {
        let msg = 'Failed to generate satellite image';
        try {
          const err = await res.json();
          if (err.detail) msg = err.detail;
        } catch (_) {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const safeLoc = effectiveLoc.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const ext = format === 'geotiff' || format === 'tif' ? 'tif' : (format === 'geojson' ? 'geojson' : 'png');
      const filename = `satellite_${safeLoc}_${year}.${ext}`;

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);

      setDownloadSuccess(`Downloaded ${filename} successfully!`);
      setShowExportModal(false);
      setTimeout(() => setDownloadSuccess(null), 4500);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAnalyze = () => {
    if (!bounds) return;
    const c = bounds.getCenter();
    executeDirective(
      `Analyze the satellite imagery around ${placeName} ` +
      `(lat ${c.lat.toFixed(4)}, lon ${c.lng.toFixed(4)}). ` +
      `Detect land use changes, vegetation anomalies, and any recent disturbances.`
    );
    onBack?.();
  };

  // ── WMS params ───────────────────────────────────────────────────────
  // NASA GIBS requires TIME parameter for dated products
  const wmsParams = (layer) => ({
    layers:      layer,
    format:      OVERLAYS.find(o => o.layer === layer)?.format ?? 'image/png',
    transparent: true,
    version:     '1.3.0',
    time:        GIBS_DATE,
    attribution: 'NASA EOSDIS GIBS',
  });

  return (
    <div className="absolute inset-0 z-40 bg-mc-bg flex animate-in fade-in duration-300">

      {/* ── Leaflet Map ── */}
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ width: '100%', height: '100%' }}
        zoomControl={false}
        className="z-0 flex-1"
      >
        <MapFlyController center={mapCenter} zoom={mapZoom} />
        <DrawingManager
          isDrawing={isDrawing}
          bounds={bounds}
          setBounds={setBounds}
          setIsDrawing={setIsDrawing}
        />
        <ViewportTracker onViewportChange={setViewportBounds} />

        {/* ── Ruler event manager ── */}
        <RulerManager
          rulerActive={rulerActive}
          rulerPoints={rulerPoints}
          setRulerPoints={setRulerPoints}
          setRulerDistance={setRulerDistance}
          setMouseLatLng={setMouseLatLng}
        />

        {/* ── Base layers ── */}
        {activeBase === 'Esri Satellite' && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles © Esri"
            maxNativeZoom={19} maxZoom={19}
          />
        )}
        {activeBase === 'OpenStreetMap' && (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />
        )}
        {activeBase === 'OpenTopoMap' && (
          <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            attribution="© OpenTopoMap"
          />
        )}

        {/* ── Real NASA GIBS WMS overlays ── */}
        {OVERLAYS.map(overlay =>
          activeLayers.has(overlay.id) ? (
            <WMSTileLayer
              key={overlay.id}
              url={GIBS_WMS}
              params={wmsParams(overlay.layer)}
              opacity={overlay.opacity}
              tileSize={256}
            />
          ) : null
        )}

        {/* ── Ruler: Confirmed measurement line ── */}
        {rulerPoints.length >= 2 && (
          <Polyline
            positions={rulerPoints}
            pathOptions={{ color: '#f59e0b', weight: 2.5, dashArray: '8 5' }}
          />
        )}

        {/* ── Ruler: Live translucent preview line from point 1 → mouse ── */}
        {rulerActive && rulerPoints.length === 1 && mouseLatLng && (
          <Polyline
            positions={[rulerPoints[0], mouseLatLng]}
            pathOptions={{ color: '#f59e0b', weight: 1.8, dashArray: '6 6', opacity: 0.45 }}
          />
        )}

        {/* ── Ruler: Visual dot markers for each confirmed point ── */}
        {rulerPoints.map((pt, i) => (
          <CircleMarker
            key={i}
            center={pt}
            radius={i === 0 ? 7 : 6}
            pathOptions={{
              color: i === 0 ? '#f59e0b' : '#ffffff',
              fillColor: i === 0 ? '#f59e0b' : '#f59e0b',
              fillOpacity: 1,
              weight: i === 0 ? 3 : 2,
            }}
          />
        ))}

        {/* ── Ruler: Live cursor dot at mouse position ── */}
        {rulerActive && mouseLatLng && rulerPoints.length < 2 && (
          <CircleMarker
            center={mouseLatLng}
            radius={4}
            pathOptions={{
              color: '#f59e0b',
              fillColor: '#fbbf24',
              fillOpacity: 0.6,
              weight: 1.5,
              opacity: 0.7,
            }}
          />
        )}
      </MapContainer>

      {/* ── Top-left: Back + Search ── */}
      <div className="absolute top-5 left-5 z-50 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-mc-panel border border-mc-border text-mc-text font-mono text-xs rounded-md shadow-sm hover:border-mc-primary transition-colors"
        >
          <ArrowLeft size={15} /> MISSION CONTROL
        </button>

        <form onSubmit={handleSearch} className="relative w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mc-primary" size={15} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search any location…"
            className="w-full pl-9 pr-10 py-2 bg-mc-panel text-mc-text border border-mc-border outline-none focus:border-mc-primary text-xs font-mono rounded-md shadow-sm"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mc-muted hover:text-mc-primary transition-colors"
          >
            {isSearching
              ? <Loader2 size={14} className="animate-spin text-mc-primary" />
              : <Navigation size={14} />
            }
          </button>
        </form>

        {/* Ruler Tool Button */}
        <button
          onClick={handleToggleRuler}
          className={`flex items-center gap-2 px-4 py-2 font-mono text-xs rounded-md shadow-sm border transition-colors ${
            rulerActive
              ? 'bg-amber-500/20 border-amber-500/50 text-mc-text'
              : 'bg-mc-panel border-mc-border text-mc-text hover:border-mc-primary'
          }`}
          title="Distance Ruler — Click Point 1 then Point 2"
        >
          <Ruler size={15} className="text-amber-500" />
          {rulerActive
            ? rulerPoints.length === 0 ? 'CLICK POINT 1'
              : rulerPoints.length === 1 ? 'CLICK POINT 2'
              : (rulerDistance || 'RULER')
            : 'RULER'}
        </button>

        {/* Export Satellite Imagery Button */}
        <button
          onClick={() => setShowExportModal(true)}
          className={`flex items-center gap-2 px-3.5 py-2 font-mono text-xs rounded-md shadow-sm border transition-colors cursor-pointer ${
            showExportModal
              ? 'bg-mc-primary text-white border-mc-primary'
              : 'bg-mc-panel border-mc-border text-mc-text hover:border-mc-primary'
          }`}
          title="Download high-resolution satellite imagery for active region (PNG / GeoTIFF / GeoJSON)"
        >
          <Download size={14} className={showExportModal ? 'text-white' : 'text-mc-primary'} />
          <span>EXPORT SATELLITE</span>
        </button>
      </div>

      {/* ── Ruler: Distance Result HUD (bottom-center) ── */}
      {rulerActive && rulerDistance && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in- duration-200">
          <div className="flex items-center gap-3 px-5 py-3 bg-mc-panel border border-mc-border rounded-md font-mono shadow-md">
            <Ruler size={18} className="text-amber-500 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] text-amber-500/80 uppercase tracking-widest">Measured Distance</span>
              <span className="text-mc-text font-bold text-xl tracking-wide">{rulerDistance}</span>
            </div>
            <button
              onClick={handleResetRuler}
              className="ml-3 text-mc-muted hover:text-mc-text transition-colors p-1"
              title="Clear measurement"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Ruler: Instruction HUD when active but no distance yet ── */}
      {rulerActive && !rulerDistance && (
        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 bg-mc-panel border border-amber-500/30 rounded-md font-mono text-xs text-mc-text/80 shadow-md">
            <Ruler size={13} className="text-amber-500" />
            {rulerPoints.length === 0 ? 'Click to set Point 1' : 'Click to set Point 2 — line preview is live'}
          </div>
        </div>
      )}

      {/* ── Right panel: Layer controls ── */}
      <div className="absolute top-5 right-5 z-50 w-72 bg-mc-panel border border-mc-border rounded-md p-5 shadow-sm flex flex-col gap-5">

        {/* Base Maps */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <MapIcon size={13} className="text-mc-muted" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mc-muted">Base Map</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {['Esri Satellite', 'OpenTopoMap', 'OpenStreetMap'].map(base => (
              <button
                key={base}
                onClick={() => setActiveBase(base)}
                className={`flex items-center justify-between px-3 py-2 rounded-md border text-xs font-mono transition-colors ${
                  activeBase === base
                    ? 'bg-mc-primary/10 border-mc-primary text-mc-text'
                    : 'bg-transparent border-mc-border/50 text-mc-muted hover:border-mc-border hover:text-mc-text'
                }`}
              >
                {base}
                {activeBase === base && <div className="w-1.5 h-1.5 rounded-full bg-mc-primary" />}
              </button>
            ))}
          </div>
        </div>


      </div>

      {/* ── Bottom-left: Nearby targets ── */}
      {nearbyTargets.length > 0 && (
        <div className="absolute bottom-8 left-5 z-50 w-72 bg-mc-panel border border-mc-border rounded-md p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-mc-border/50">
            <Compass size={13} className="text-mc-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-mc-text">Nearby Targets</span>
            <span className="ml-auto text-[9px] font-mono text-mc-muted truncate">{placeName}</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
            {nearbyTargets.map((target, i) => (
              <button
                key={i}
                onClick={() => {
                  setMapCenter([target.lat, target.lon]);
                  setMapZoom(target.zoom || 10);
                  // Only change the root location context if it's an actual distinct place
                  if (target.type !== 'MACRO_VIEW' && target.type !== 'MICRO_VIEW') {
                    setPlaceName(target.name);
                    setNearbyTargets([]); // Will trigger refresh via useEffect
                    setSearchQuery(target.name); // Keep search bar in sync
                  }
                }}
                className="w-full text-left px-3 py-2 rounded-md bg-mc-bg/60 border border-mc-border/40 hover:border-mc-primary transition-colors flex items-center justify-between group cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-mc-text group-hover:text-mc-primary transition-colors truncate">{target.name}</p>
                  <p className="text-[9px] text-mc-muted font-mono">{target.type?.replace('_', ' ')}</p>
                </div>
                {target.type === 'MACRO_VIEW'
                  ? <ZoomOut size={13} className="text-mc-muted shrink-0 ml-2" />
                  : <ZoomIn  size={13} className="text-mc-muted shrink-0 ml-2" />
                }
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Bottom-centre: Drawing controls ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">
        {bounds && (
          <div className="flex flex-col items-center gap-2 animate-in slide-in-from-bottom-2 duration-300">
            <div className="px-5 py-1.5 bg-mc-panel/90 backdrop-blur-md border border-mc-border rounded-md shadow-sm flex items-center gap-3">
              <span className="text-[11px] font-mono text-mc-text tracking-wider">
                SELECTED AOI: <span className="text-mc-primary font-bold">{getAreaKm2()} KM²</span>
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-[10px] font-mono text-mc-muted truncate max-w-xs">
                {placeName || 'Target Region'}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={handleAnalyze}
                className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-mc-primary hover:bg-mc-secondary text-white font-mono text-xs font-semibold tracking-wider transition-colors shadow-sm cursor-pointer"
              >
                <Play size={13} fill="currentColor" />
                ANALYZE MISSION
              </button>

              <button
                onClick={() => setShowExportModal(true)}
                disabled={isDownloading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-semibold tracking-wider transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isDownloading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Download size={13} />
                )}
                DOWNLOAD SATELLITE IMAGE
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => { setIsDrawing(!isDrawing); if (isDrawing) setBounds(null); }}
          className={`flex items-center gap-2.5 px-7 py-2.5 rounded-md font-mono text-sm font-medium shadow-sm transition-colors cursor-pointer ${
            isDrawing
              ? 'bg-mc-primary text-white shadow-sm'
              : 'bg-mc-panel border border-mc-border text-mc-text hover:border-mc-primary'
          }`}
        >
          <Target size={15} />
          {isDrawing ? 'DRAG ON MAP TO SELECT AREA' : 'DRAW SELECTION BOX'}
        </button>
      </div>

      {/* ── Satellite Image Export Modal ── */}
      {showExportModal && (
        <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-mc-panel border border-mc-border rounded-xl w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 font-mono relative">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-mc-border/50 pb-3">
              <div className="flex items-center gap-2">
                <Download size={16} className="text-mc-primary" />
                <h3 className="text-xs uppercase font-bold tracking-widest text-mc-text">
                  Direct Satellite Image Downloader
                </h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-mc-muted hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Target & AOI Details */}
            <div className="bg-mc-bg/80 border border-mc-border/60 rounded-lg p-3 text-xs flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-mc-muted text-[11px]">
                <span>TARGET REGION:</span>
                <span className="text-mc-text font-bold">{placeName || 'Selected AOI'}</span>
              </div>
              <div className="flex justify-between items-center text-mc-muted text-[11px]">
                <span>COVERAGE SCOPE:</span>
                <span className="text-amber-500 font-semibold">{bounds ? 'User Drawn AOI' : 'Active Viewport'}</span>
              </div>
              <div className="flex justify-between items-center text-mc-muted text-[11px]">
                <span>SURFACE AREA:</span>
                <span className="text-mc-primary font-bold">{getAreaKm2()} km²</span>
              </div>
              <div className="flex justify-between items-center text-mc-muted text-[11px]">
                <span>SENSOR RESOLUTION:</span>
                <span className="text-emerald-400 font-semibold">10m Multi-Spectral Optical</span>
              </div>
            </div>

            {/* Format Selection */}
            <div>
              <label className="text-[10px] uppercase text-mc-muted tracking-wider block mb-2">
                Select Output Format:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'png', label: 'PNG Image', desc: '10m True Color' },
                  { id: 'tif', label: 'GeoTIFF', desc: 'GIS Georeferenced' },
                  { id: 'geojson', label: 'GeoJSON', desc: 'Vector Polygon' },
                ].map(fmt => (
                  <button
                    key={fmt.id}
                    onClick={() => setExportFormat(fmt.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                      exportFormat === fmt.id
                        ? 'bg-mc-primary/20 border-mc-primary text-mc-text shadow-sm'
                        : 'bg-mc-bg/40 border-mc-border/50 text-mc-muted hover:border-mc-border hover:text-mc-text'
                    }`}
                  >
                    <span className="text-xs font-bold">{fmt.label}</span>
                    <span className="text-[9px] opacity-75">{fmt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Observation Year Selection */}
            <div>
              <label className="text-[10px] uppercase text-mc-muted tracking-wider block mb-2">
                Observation Year:
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {['2025', '2024', '2023', '2022', '2020'].map(yr => (
                  <button
                    key={yr}
                    onClick={() => setExportYear(yr)}
                    className={`px-3 py-1.5 rounded-md text-xs border transition-colors cursor-pointer ${
                      exportYear === yr
                        ? 'bg-amber-600 text-white border-amber-500 font-bold'
                        : 'bg-mc-bg border-mc-border text-mc-muted hover:text-mc-text'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2 border-t border-mc-border/40">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-2.5 rounded-lg border border-mc-border hover:bg-mc-bg text-mc-muted hover:text-mc-text text-xs transition-colors cursor-pointer"
              >
                CANCEL
              </button>
              <button
                onClick={() => handleDownloadSatellite(exportFormat, exportYear)}
                disabled={isDownloading}
                className="flex-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isDownloading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>GENERATING RASTER…</span>
                  </>
                ) : (
                  <>
                    <Download size={13} />
                    <span>DOWNLOAD SATELLITE ASSET</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Download Success Notification Toast ── */}
      {downloadSuccess && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[70] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 px-4 py-2.5 rounded-lg font-mono text-xs shadow-xl flex items-center gap-2">
            <CheckCircle size={15} className="text-emerald-400 shrink-0" />
            <span>{downloadSuccess}</span>
          </div>
        </div>
      )}
    </div>
  );
}
