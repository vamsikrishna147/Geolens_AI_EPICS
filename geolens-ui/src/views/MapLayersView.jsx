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

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Layers, Map as MapIcon, Eye, EyeOff,
  Target, Play, Loader2, Search, Compass,
  ZoomIn, ZoomOut, Navigation,
} from 'lucide-react';
import {
  MapContainer, TileLayer, WMSTileLayer,
  useMap, useMapEvents, Rectangle,
} from 'react-leaflet';
import L from 'leaflet';
import { useLanguage } from '../context/LanguageContext';
import { useMission } from '../context/MissionContext';

const API             = 'http://localhost:8000';
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
    if (center?.[0] && center?.[1]) map.flyTo(center, zoom || 5, { duration: 1.5 });
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

// ── Overlay toggle button ─────────────────────────────────────────────

function OverlayRow({ overlay, active, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-200 group ${
        active
          ? 'bg-mc-panel border-mc-border'
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
    fetch(`${API}/api/geocoder/nearby?location=${encodeURIComponent(placeName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.recommended_targets) setNearbyTargets(data.recommended_targets); })
      .catch(() => {});
  }, [placeName]);

  // ── Handlers ────────────────────────────────────────────────────────

  const handleSearch = async (e, explicitQuery = null) => {
    e?.preventDefault();
    const queryToUse = explicitQuery || searchQuery;
    if (!queryToUse.trim()) return;
    setIsSearching(true);
    try {
      const res  = await fetch(`${API}/api/geocoder/search?q=${encodeURIComponent(queryToUse)}`);
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

  const getAreaKm2 = () => {
    if (!bounds) return '0.00';
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    const w  = sw.distanceTo(L.latLng(sw.lat, ne.lng));
    const h  = sw.distanceTo(L.latLng(ne.lat, sw.lng));
    return ((w * h) / 1_000_000).toFixed(2);
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
      </MapContainer>

      {/* ── Top-left: Back + Search ── */}
      <div className="absolute top-5 left-5 z-50 flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 bg-mc-panel/95 backdrop-blur border border-mc-border text-mc-text font-mono text-xs rounded-xl shadow-2xl hover:border-mc-primary/50 transition-colors"
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
            className="w-full pl-9 pr-10 py-2.5 skeuo-input text-xs font-mono rounded-xl shadow-2xl"
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
      </div>

      {/* ── Right panel: Layer controls ── */}
      <div className="absolute top-5 right-5 z-50 w-72 bg-mc-panel/95 backdrop-blur border border-mc-border rounded-2xl p-5 shadow-2xl flex flex-col gap-5">

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
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono transition-all ${
                  activeBase === base
                    ? 'bg-mc-primary/15 border-mc-primary text-mc-text'
                    : 'bg-transparent border-mc-border/50 text-mc-muted hover:border-mc-primary/40 hover:text-mc-text'
                }`}
              >
                {base}
                {activeBase === base && <div className="w-1.5 h-1.5 rounded-full bg-mc-primary animate-pulse" />}
              </button>
            ))}
          </div>
        </div>

        {/* Live Satellite Overlays */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Layers size={13} className="text-mc-muted" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mc-muted">Live Satellite Overlays</span>
            <span className="ml-auto text-[8px] font-mono text-mc-success border border-mc-success/30 px-1.5 py-0.5 rounded-full">NASA GIBS</span>
          </div>
          <div className="flex flex-col gap-2">
            {OVERLAYS.map(overlay => (
              <OverlayRow
                key={overlay.id}
                overlay={overlay}
                active={activeLayers.has(overlay.id)}
                onToggle={() => toggleLayer(overlay.id)}
              />
            ))}
          </div>
          <p className="mt-3 text-[9px] font-mono text-mc-muted/50 leading-relaxed">
            All overlays are live WMS tiles served directly from NASA&apos;s Earth Observation archive.
          </p>
        </div>
      </div>

      {/* ── Bottom-left: Nearby targets ── */}
      {nearbyTargets.length > 0 && (
        <div className="absolute bottom-8 left-5 z-50 w-72 bg-mc-panel/95 backdrop-blur border border-mc-border rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-mc-border/50">
            <Compass size={13} className="text-mc-primary" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-mc-text">Nearby Targets</span>
            <span className="ml-auto text-[9px] font-mono text-mc-muted truncate">{placeName}</span>
          </div>
          <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
            {nearbyTargets.map((target, i) => (
              <button
                key={i}
                onClick={() => { setMapCenter([target.lat, target.lon]); setMapZoom(target.zoom || 10); }}
                className="w-full text-left px-3 py-2 rounded-lg bg-mc-bg/60 border border-mc-border/40 hover:border-mc-primary/50 transition-all flex items-center justify-between group"
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
          <div className="flex flex-col items-center gap-2 animate-in slide-in-from-bottom-3 duration-300">
            <div className="px-5 py-1.5 bg-mc-panel/95 backdrop-blur border border-mc-primary/40 rounded-full shadow-xl">
              <span className="text-[11px] font-mono text-mc-text tracking-wider">
                AREA: <span className="text-mc-primary font-bold">{getAreaKm2()} KM²</span>
              </span>
            </div>
            <button
              onClick={handleAnalyze}
              className="flex items-center gap-2 px-8 py-3 rounded-xl bg-mc-primary hover:bg-mc-secondary text-white font-mono text-sm font-semibold tracking-wider transition-all shadow-[0_0_20px_rgba(47,129,247,0.4)] hover:shadow-[0_0_28px_rgba(47,129,247,0.6)]"
            >
              <Play size={14} fill="currentColor" />
              ANALYZE SELECTED REGION
            </button>
          </div>
        )}

        <button
          onClick={() => { setIsDrawing(!isDrawing); if (isDrawing) setBounds(null); }}
          className={`flex items-center gap-2.5 px-7 py-2.5 rounded-full font-mono text-sm font-medium shadow-xl transition-all ${
            isDrawing
              ? 'bg-mc-primary text-white animate-pulse shadow-[0_0_18px_rgba(47,129,247,0.5)]'
              : 'bg-mc-panel/95 backdrop-blur border border-mc-border text-mc-text hover:border-mc-primary/50'
          }`}
        >
          <Target size={15} />
          {isDrawing ? 'DRAG ON MAP TO SELECT AREA' : 'DRAW SELECTION BOX'}
        </button>
      </div>
    </div>
  );
}
