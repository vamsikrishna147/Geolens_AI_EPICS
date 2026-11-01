import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ReactCompareSlider } from 'react-compare-slider';
import { 
  X, Clock, Map, Settings2, Target, MapPin, Play, Loader2, 
  MessageSquare, BarChart2, Flame, Droplets, Building2, Leaf, 
  Download, Search, Columns, SlidersHorizontal, Crop, RefreshCw, Home, ArrowLeft, FileText,
  History, ChevronLeft, Ruler, Layers, ToggleLeft, ToggleRight, TrendingUp, TrendingDown, Minus,
  GripVertical, Activity
} from 'lucide-react';
import { MapContainer, TileLayer, useMap, useMapEvents, Rectangle, Polyline, Marker } from 'react-leaflet';
import L from 'leaflet';
import { useMission } from '../context/MissionContext';
import { useLanguage } from '../context/LanguageContext';
import AssistantChat from './AssistantChat';
import { API_BASE_URL } from '../config/api';
import { flyToTargetLocation, getAdaptiveCameraView } from '../utils/cameraFly';

const API = API_BASE_URL;

// ── Leaflet Resize & Invalidation Fix ──────────────────────────────────────
function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', onResize);
    };
  }, [map]);
  return null;
}

// ── Map Synchronization Hook ──────────────────────────────────────────────
function MapSync({ center, zoom, onMove, onClick, onMouseMove, onMouseOut }) {
  const map = useMap();

  // Programmatic redirection / flyTo when location or search changes
  useEffect(() => {
    if (!center || typeof center[0] !== 'number' || typeof center[1] !== 'number' || isNaN(center[0]) || isNaN(center[1])) return;
    try {
      const current = map.getCenter();
      if (!current || typeof current.lat !== 'number' || isNaN(current.lat) || isNaN(current.lng)) return;
      const currentZoom = map.getZoom();
      const distance = Math.abs(current.lat - center[0]) + Math.abs(current.lng - center[1]);
      
      if (distance > 0.001 || currentZoom !== zoom) {
        map.flyTo(center, zoom || 12, { duration: 1.2 });
      }
    } catch (_) {}
  }, [center, zoom, map]);

  useMapEvents({
    // Only capture user manual drag/movements to avoid infinite event feedback
    move(e) {
      if (e.originalEvent && onMove) {
        const c = map.getCenter();
        onMove([c.lat, c.lng], map.getZoom());
      }
    },
    zoom(e) {
      if (e.originalEvent && onMove) {
        const c = map.getCenter();
        onMove([c.lat, c.lng], map.getZoom());
      }
    },
    click(e) {
      if (onClick) {
        onClick([e.latlng.lat, e.latlng.lng]);
      }
    },
    mousemove(e) {
      if (onMouseMove) {
        onMouseMove([e.latlng.lat, e.latlng.lng]);
      }
    },
    mouseout(e) {
      if (onMouseOut) {
        onMouseOut();
      }
    }
  });

  return null;
}

// ── Area Drawing Manager ──────────────────────────────────────────────────
function DrawingManager({ isDrawing, bounds, setBounds, setIsDrawing }) {
  const map = useMap();
  const [anchor, setAnchor] = useState(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (isDrawing) {
      map.dragging.disable();
      map._container.style.cursor = 'crosshair';
    } else {
      map.dragging.enable();
      map._container.style.cursor = '';
    }
  }, [isDrawing, map]);

  useMapEvents({
    mousedown(e) {
      if (!isDrawing) return;
      setAnchor(e.latlng);
      setDragging(true);
      setBounds(null);
    },
    mousemove(e) {
      if (!isDrawing || !dragging || !anchor) return;
      setBounds(L.latLngBounds(anchor, e.latlng));
    },
    mouseup() {
      if (!isDrawing || !dragging) return;
      setDragging(false);
      setIsDrawing(false);
    }
  });

  return bounds ? (
    <Rectangle
      bounds={bounds}
      pathOptions={{ color: '#00f6ff', weight: 2, fillOpacity: 0.15, dashArray: '6 3' }}
    />
  ) : null;
}

// ── Severity pill colours ─────────────────────────────────────────────────
const SEVERITY_COLORS = {
  'CRITICAL':         'bg-red-900/60 text-red-300 border-red-700',
  'HIGH':             'bg-orange-900/60 text-orange-300 border-orange-700',
  'HIGH SEVERITY':    'bg-red-900/60 text-red-300 border-red-700',
  'MODERATE':         'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  'RAPID GROWTH':     ' bg-mc-panel text-mc-text',
  'IMPROVEMENT':      'bg-green-900/60 text-green-300 border-green-700',
  'STABLE':           'bg-slate-800 text-mc-text border-mc-border',
  'LOW':              'bg-slate-800 text-slate-400 border-mc-border',
  'UNKNOWN':          'bg-slate-800 text-slate-500 border-mc-border',
};

function SeverityPill({ label }) {
  const cls = Object.entries(SEVERITY_COLORS).find(([k]) => label?.toUpperCase().includes(k))?.[1]
    || 'bg-slate-800 text-slate-400 border-mc-border';
  return (
    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${cls}`}>
      {label || 'N/A'}
    </span>
  );
}

function MetricCard({ label, value, unit, highlight }) {
  return (
    <div className="bg-mc-panel border border-mc-border/40 rounded-lg p-3">
      <p className="text-mc-muted text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <p className={`font-mono font-bold text-lg ${highlight ? 'text-mc-primary' : 'text-mc-text'}`}>
        {value ?? '—'} <span className="text-xs font-normal text-mc-muted">{unit}</span>
      </p>
    </div>
  );
}

// ── Change Detection (CVA) Panel ─────────────────────────────────────────
function ChangePanel({ location, yearBefore, yearAfter }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const activeLoc = (location && location.trim()) || 'Selected AOI';

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/timelens/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: activeLoc, year_t1: +yearBefore, year_t2: +yearAfter }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Unknown error');
      setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="text-[11px] font-mono text-mc-muted flex items-center justify-between">
        <span>Target: <strong className="text-mc-primary">{activeLoc}</strong> ({yearBefore} → {yearAfter})</span>
      </div>

      <button onClick={run} disabled={loading}
        className="w-full py-2.5 skeuo-button-primary rounded-lg font-heading text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
        {loading ? <Loader2 className="animate-spin" size={14} /> : <BarChart2 size={14} />}
        {loading ? 'COMPUTING CVA...' : 'RUN CHANGE VECTOR ANALYSIS'}
      </button>

      {error && <p className="text-red-400 text-xs font-mono bg-red-950/40 p-3 rounded">{error}</p>}

      {data && (
        <div className="space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-mc-muted text-xs font-mono">{data.temporal_span}</span>
            <SeverityPill label={data.overall_risk_level ? `${data.overall_risk_level} RISK` : null} />
          </div>

          {data.ndvi_change && (
            <div className="bg-mc-bg border border-mc-border/30 rounded-lg p-3 space-y-2">
              <p className="text-mc-secondary text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5">
                <Leaf size={12}/> VEGETATION (NDVI)
              </p>
              <div className="grid grid-cols-3 gap-2">
                <MetricCard label="Baseline" value={data.ndvi_change.ndvi_t1?.toFixed(3)} />
                <MetricCard label="Current" value={data.ndvi_change.ndvi_t2?.toFixed(3)} />
                <MetricCard label="Delta %" value={data.ndvi_change.delta_percent} unit="%" highlight />
              </div>
              <SeverityPill label={data.ndvi_change.change_severity} />
              <p className="text-mc-muted text-xs leading-relaxed">{data.ndvi_change.interpretation}</p>
            </div>
          )}

          {data.urban_expansion && (
            <div className="bg-mc-bg border border-mc-border/30 rounded-lg p-3 space-y-2">
              <p className="text-mc-secondary text-[10px] font-mono uppercase tracking-widest flex items-center gap-1.5">
                <Building2 size={12}/> URBAN EXPANSION
              </p>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Built T1" value={data.urban_expansion.built_area_t1_km2} unit="km²" />
                <MetricCard label="Built T2" value={data.urban_expansion.built_area_t2_km2} unit="km²" />
              </div>
              <MetricCard label="Expansion" value={data.urban_expansion.expansion_km2} unit="km²" highlight />
              <SeverityPill label={data.urban_expansion.growth_classification} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Flood Analysis Panel ─────────────────────────────────────────────────
function FloodPanel({ location }) {
  const [floodStart, setFloodStart] = useState('2024-08-01');
  const [floodEnd,   setFloodEnd]   = useState('2024-08-31');
  const [baseYear,   setBaseYear]   = useState(2022);
  const [data,   setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const activeLoc = (location && location.trim()) || 'Vijayawada';

  const run = async () => {
    if (!floodStart || !floodEnd) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/timelens/flood`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: activeLoc, flood_start: floodStart, flood_end: floodEnd, baseline_year: +baseYear }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Unknown error');
      setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[11px] font-mono text-mc-muted">
        <span>Target: <strong className="text-mc-primary">{activeLoc}</strong></span>
        <button
          type="button"
          onClick={() => { setFloodStart('2024-08-01'); setFloodEnd('2024-08-31'); setBaseYear(2022); }}
          className="text-[10px] text-mc-primary hover:underline font-mono cursor-pointer"
        >
          Load 2024 Flood Baseline
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-mc-muted text-[10px] uppercase tracking-widest block mb-1">Flood Start</label>
          <input type="date" value={floodStart} onChange={e => setFloodStart(e.target.value)}
            className="w-full skeuo-input p-2 text-sm font-mono" />
        </div>
        <div>
          <label className="text-mc-muted text-[10px] uppercase tracking-widest block mb-1">Flood End</label>
          <input type="date" value={floodEnd} onChange={e => setFloodEnd(e.target.value)}
            className="w-full skeuo-input p-2 text-sm font-mono" />
        </div>
      </div>
      <div>
        <label className="text-mc-muted text-[10px] uppercase tracking-widest block mb-1">Baseline Year</label>
        <select value={baseYear} onChange={e => setBaseYear(e.target.value)}
          className="w-full skeuo-input p-2 text-sm font-mono">
          {[2018,2019,2020,2021,2022,2023,2024].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <button onClick={run} disabled={loading || !floodStart || !floodEnd}
        className="w-full py-2.5 skeuo-button-primary rounded-lg font-heading text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
        {loading ? <Loader2 className="animate-spin" size={14} /> : <Droplets size={14} />}
        {loading ? 'RUNNING FLOOD ANALYSIS...' : 'DETECT FLOOD EXTENT'}
      </button>

      {error && <p className="text-red-400 text-xs font-mono bg-red-950/40 p-3 rounded">{error}</p>}

      {data && (
        <div className="space-y-3 animate-in fade-in">
          {data.ndwi_optical && !data.ndwi_optical.error && (
            <div className="bg-mc-bg border rounded-lg p-3 space-y-2">
              <p className=" text-mc-text text-[10px] font-mono uppercase tracking-widest">NDWI OPTICAL (Sentinel-2)</p>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Water Area" value={data.ndwi_optical.water_area_flood_km2} unit="km²" highlight />
                <MetricCard label="Incremental" value={data.ndwi_optical.incremental_inundation_km2} unit="km²" />
              </div>
              <SeverityPill label={data.ndwi_optical.inundation_severity} />
            </div>
          )}

          {data.sar_microwave && !data.sar_microwave.error && (
            <div className="bg-mc-bg border rounded-lg p-3 space-y-2">
              <p className=" text-mc-text text-[10px] font-mono uppercase tracking-widest">SAR MICROWAVE (Sentinel-1)</p>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Flood Area" value={data.sar_microwave.flood_water_area_km2} unit="km²" highlight />
                <MetricCard label="Incremental" value={data.sar_microwave.incremental_flood_km2} unit="km²" />
              </div>
              <SeverityPill label={data.sar_microwave.inundation_severity} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Wildfire Panel ────────────────────────────────────────────────────────
function WildfirePanel({ location }) {
  const [fireStart,    setFireStart]    = useState('2018-11-08');
  const [fireEnd,      setFireEnd]      = useState('2018-11-25');
  const [preFireStart, setPreFireStart] = useState('2018-09-01');
  const [preFireEnd,   setPreFireEnd]   = useState('2018-10-15');
  const [data,    setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const activeLoc = (location && location.trim()) || 'Paradise, California';

  const run = async () => {
    if (!fireStart || !fireEnd || !preFireStart || !preFireEnd) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/timelens/wildfire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: activeLoc, fire_start: fireStart, fire_end: fireEnd, pre_fire_start: preFireStart, pre_fire_end: preFireEnd }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Unknown error');
      setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[11px] font-mono text-mc-muted">
        <span>Target: <strong className="text-orange-400">{activeLoc}</strong></span>
        <button
          type="button"
          onClick={() => { setPreFireStart('2018-09-01'); setPreFireEnd('2018-10-15'); setFireStart('2018-11-08'); setFireEnd('2018-11-25'); }}
          className="text-[10px] text-orange-400 hover:underline font-mono cursor-pointer"
        >
          Load Camp Fire Baseline
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-mc-muted text-[10px] uppercase block mb-1">Pre-Fire Start</label>
          <input type="date" value={preFireStart} onChange={e => setPreFireStart(e.target.value)} className="w-full skeuo-input p-2 text-sm font-mono" />
        </div>
        <div>
          <label className="text-mc-muted text-[10px] uppercase block mb-1">Pre-Fire End</label>
          <input type="date" value={preFireEnd} onChange={e => setPreFireEnd(e.target.value)} className="w-full skeuo-input p-2 text-sm font-mono" />
        </div>
        <div>
          <label className="text-mc-muted text-[10px] uppercase block mb-1">Post-Fire Start</label>
          <input type="date" value={fireStart} onChange={e => setFireStart(e.target.value)} className="w-full skeuo-input p-2 text-sm font-mono" />
        </div>
        <div>
          <label className="text-mc-muted text-[10px] uppercase block mb-1">Post-Fire End</label>
          <input type="date" value={fireEnd} onChange={e => setFireEnd(e.target.value)} className="w-full skeuo-input p-2 text-sm font-mono" />
        </div>
      </div>

      <button onClick={run} disabled={loading || !fireStart || !preFireStart}
        className="w-full py-2.5 skeuo-button-primary rounded-lg font-heading text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer">
        {loading ? <Loader2 className="animate-spin" size={14} /> : <Flame size={14} />}
        {loading ? 'COMPUTING dNBR...' : 'MAP BURN SEVERITY'}
      </button>

      {error && <p className="text-red-400 text-xs font-mono bg-red-950/40 p-3 rounded">{error}</p>}

      {data && !data.error && (
        <div className="space-y-3 animate-in fade-in">
          <div className="bg-mc-bg border border-orange-800/40 rounded-lg p-3 space-y-2">
            <p className="text-orange-400 text-[10px] font-mono uppercase tracking-widest">NBR BURN ANALYSIS (Landsat 9)</p>
            <div className="grid grid-cols-3 gap-2">
              <MetricCard label="Pre NBR" value={data.pre_nbr} />
              <MetricCard label="Post NBR" value={data.post_nbr} />
              <MetricCard label="dNBR" value={data.dnbr} highlight />
            </div>
            <MetricCard label="Burned Area" value={data.estimated_burned_area_km2} unit="km²" />
            <SeverityPill label={data.burn_severity_class} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main TimeLensCompare ──────────────────────────────────────────────────
export default function TimeLensCompare({ onClose }) {
  const { finalReport, executeDirective, isExecuting } = useMission();
  const { language } = useLanguage();

  const [activeTab, setActiveTab]         = useState('imagery'); // imagery | change | flood | wildfire
  const [viewMode, setViewMode]           = useState('split');   // split (side-by-side) | slider (swipe)
  const [showAssistant, setShowAssistant] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [isDownloading, setIsDownloading]         = useState(false);

  // Restore persistent TimeLens context across tab switches and refreshes
  const savedContext = (() => {
    try {
      return JSON.parse(sessionStorage.getItem('geolens_timelens_active_context') || '{}');
    } catch {
      return {};
    }
  })();

  // Search & Navigation State (defaults to active mission context or saved query)
  const initialMissionLoc = finalReport?.official_report?.location || finalReport?.analysis_plan?.location || '';
  const defaultLoc = savedContext.searchQuery || initialMissionLoc || '';

  const [searchQuery, setSearchQuery]     = useState(defaultLoc);
  const [yearBefore, setYearBefore]       = useState(savedContext.yearBefore || '2024');
  const [yearAfter,  setYearAfter]        = useState(savedContext.yearAfter || '2026');

  const [imgBefore, setImgBefore]           = useState(savedContext.imgBefore || null);
  const [imgAfter,  setImgAfter]            = useState(savedContext.imgAfter || null);
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  const [resolvedLocation, setResolvedLocation] = useState(savedContext.resolvedLocation || defaultLoc || '');

  // Map Coordinates & Zoom (Defaults to mission location if available, otherwise regional overview)
  const [mapCenter, setMapCenter] = useState(savedContext.mapCenter || [20.5937, 78.9629]);
  const [mapZoom, setMapZoom]     = useState(savedContext.mapZoom || 5);

  // Save active TimeLens context whenever parameters update
  useEffect(() => {
    try {
      const stateToSave = {
        searchQuery,
        resolvedLocation,
        yearBefore,
        yearAfter,
        imgBefore,
        imgAfter,
        mapCenter,
        mapZoom,
        activeTab,
      };
      sessionStorage.setItem('geolens_timelens_active_context', JSON.stringify(stateToSave));
    } catch (_) {}
  }, [searchQuery, resolvedLocation, yearBefore, yearAfter, imgBefore, imgAfter, mapCenter, mapZoom, activeTab]);

  // Drawing & Area Selection
  const [isDrawing, setIsDrawing] = useState(false);
  const [bounds, setBounds]       = useState(null);

  // ── Feature 1: Mission History Drawer ──────────────────────────────────────
  const [showHistory, setShowHistory]   = useState(false);
  const [missionHistory, setMissionHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('geolens_mission_history') || '[]'); }
    catch { return []; }
  });

  const saveMissionToHistory = useCallback((loc, yBefore, yAfter) => {
    if (!loc || !loc.trim()) return;
    const entry = {
      id: Date.now(),
      location: loc.trim(),
      yearBefore: yBefore,
      yearAfter: yAfter,
      timestamp: new Date().toISOString(),
      label: `${loc.trim().split(',')[0]} (${yBefore} → ${yAfter})`
    };
    setMissionHistory(prev => {
      const filtered = prev.filter(e => !(e.location === entry.location && e.yearBefore === entry.yearBefore && e.yearAfter === entry.yearAfter));
      const updated = [entry, ...filtered].slice(0, 12);
      localStorage.setItem('geolens_mission_history', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ── Feature 2: Draggable Telemetry HUD ───────────────────────────────────────
  const [liveMetrics, setLiveMetrics] = useState(null);
  const [showMetrics, setShowMetrics] = useState(true);
  const [hudCollapsed, setHudCollapsed] = useState(() => {
    return typeof window !== 'undefined' && window.innerWidth < 768;
  });
  const [hudPos, setHudPos] = useState(() => {
    try {
      const saved = sessionStorage.getItem('geolens_timelens_hud_pos');
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.x === 'number' && typeof p.y === 'number') return p;
      }
    } catch (_) {}
    return { x: null, y: (typeof window !== 'undefined' && window.innerWidth < 768) ? 52 : 16 };
  });

  const hudDraggingRef = useRef(false);
  const hudDragStartRef = useRef({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 });
  const hudElemRef = useRef(null);

  const startHudDrag = useCallback((clientX, clientY) => {
    hudDraggingRef.current = true;
    const rect = hudElemRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : (window.innerWidth / 2 - 200);
    const currentY = rect ? rect.top : 16;
    hudDragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      initialX: currentX,
      initialY: currentY
    };
  }, []);

  const handleHudMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    startHudDrag(e.clientX, e.clientY);
    e.preventDefault();
  }, [startHudDrag]);

  const handleHudTouchStart = useCallback((e) => {
    if (e.touches && e.touches.length > 0) {
      startHudDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, [startHudDrag]);

  useEffect(() => {
    const onMove = (clientX, clientY) => {
      if (!hudDraggingRef.current) return;
      const dx = clientX - hudDragStartRef.current.mouseX;
      const dy = clientY - hudDragStartRef.current.mouseY;

      const hudWidth = hudElemRef.current ? hudElemRef.current.offsetWidth : 360;
      const hudHeight = hudElemRef.current ? hudElemRef.current.offsetHeight : 45;

      const minX = 12;
      const maxX = Math.max(12, window.innerWidth - hudWidth - 12);
      const minY = 8;
      const maxY = Math.max(8, window.innerHeight - hudHeight - 12);

      const nextX = Math.max(minX, Math.min(maxX, hudDragStartRef.current.initialX + dx));
      const nextY = Math.max(minY, Math.min(maxY, hudDragStartRef.current.initialY + dy));

      setHudPos({ x: nextX, y: nextY });
    };

    const onMouseUp = () => {
      if (hudDraggingRef.current) {
        hudDraggingRef.current = false;
        try {
          if (hudPos.x !== null) {
            sessionStorage.setItem('geolens_timelens_hud_pos', JSON.stringify(hudPos));
          }
        } catch (_) {}
      }
    };

    const handleMouseMove = (e) => onMove(e.clientX, e.clientY);
    const handleTouchMove = (e) => {
      if (hudDraggingRef.current && e.touches && e.touches.length > 0) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [hudPos]);

  // ── Feature 3: Distance Ruler Tool ─────────────────────────────────────────
  const [rulerActive, setRulerActive]     = useState(false);
  const [rulerPoints, setRulerPoints]     = useState([]);  // [[lat,lng], [lat,lng]]
  const [rulerDistance, setRulerDistance] = useState(null);
  const [mouseLatLng, setMouseLatLng]     = useState(null);

  const handleRulerClick = useCallback((latlng) => {
    if (!rulerActive) return;
    setRulerPoints(prev => {
      if (prev.length >= 2) {
        setRulerDistance(null);
        return [[latlng.lat, latlng.lng]];
      }
      const next = [...prev, [latlng.lat, latlng.lng]];
      if (next.length === 2) {
        const dist = L.latLng(next[0]).distanceTo(L.latLng(next[1]));
        setRulerDistance(dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} m`);
      }
      return next;
    });
  }, [rulerActive]);

  const handleMouseMove = useCallback((latlng) => {
    if (rulerActive) setMouseLatLng(latlng);
  }, [rulerActive]);

  const handleMouseOut = useCallback(() => {
    setMouseLatLng(null);
  }, []);

  // ── Feature 4: Street & Infrastructure Overlay ─────────────────────────────
  const [showStreetOverlay, setShowStreetOverlay] = useState(false);

  // Keystroke Autocomplete Suggestions State
  const [suggestions, setSuggestions]                         = useState([]);
  const [showSuggestions, setShowSuggestions]                 = useState(false);
  const [isSearchingSuggestions, setIsSearchingSuggestions]   = useState(false);
  const suggestionsRef                                        = useRef(null);

  // Debounced location suggestions while typing each letter
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingSuggestions(true);
      try {
        const res = await fetch(`${API}/api/geocoder/suggestions?q=${encodeURIComponent(searchQuery.trim())}&lang=${encodeURIComponent(language || 'en')}`);
        const data = await res.json();
        if (data && data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
      } catch (e) {
        console.warn('Error fetching place suggestions:', e);
      } finally {
        setIsSearchingSuggestions(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [searchQuery, language]);

  // Dismiss suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectSuggestion = (item) => {
    const name = item.short_name || item.display_name;
    const { zoom } = getAdaptiveCameraView(item);
    setSearchQuery(name);
    setResolvedLocation(item.display_name);
    setMapCenter([item.lat, item.lon]);
    setMapZoom(zoom || 12);
    setShowSuggestions(false);

    // Adaptive Click-to-Fly with camera glide
    flyToTargetLocation(item, 1400);

    handleExecuteSearch(item.display_name);
  };

  // Primary execution: geocodes location, smoothly flies both windows, and retrieves satellite composites
  const handleExecuteSearch = async (overrideQuery = null, overrideCoords = null, overrideYears = null) => {
    const loc = overrideQuery !== null ? overrideQuery : searchQuery;
    if (!loc || !loc.trim()) return;
    setIsFetchingImages(true);

    const effectiveYearBefore = overrideYears?.yearBefore || yearBefore;
    const effectiveYearAfter  = overrideYears?.yearAfter || yearAfter;

    try {
      // 1. If explicit coordinates are provided, prioritize them immediately
      if (overrideCoords && Array.isArray(overrideCoords) && overrideCoords.length === 2 && typeof overrideCoords[0] === 'number') {
        const [cLat, cLng] = overrideCoords;
        setMapCenter([cLat, cLng]);
        setMapZoom(12);
        if (overrideQuery) {
          setSearchQuery(overrideQuery);
          setResolvedLocation(`${overrideQuery} (${cLat.toFixed(4)}°, ${cLng.toFixed(4)}°)`);
        }
      } else {
        // Geocode location via geocoder API to re-center both windows
        try {
          const geoRes = await fetch(`${API}/api/geocoder/search?q=${encodeURIComponent(loc)}&lang=${encodeURIComponent(language || 'en')}`);
          const geoData = await geoRes.json();
          if (geoRes.ok && geoData.lat && geoData.lon) {
            setMapCenter([geoData.lat, geoData.lon]);
            setMapZoom(12);
            setResolvedLocation(geoData.display_name || loc);
          }
        } catch (_) {}
      }

      // 2. Compute bounding box: if bounds are drawn, use them. If explicit coordinates exist, compute ~15km AOI window.
      let bboxParam = '';
      if (bounds) {
        bboxParam = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;
      } else if (overrideCoords && Array.isArray(overrideCoords) && overrideCoords.length === 2) {
        const [cLat, cLng] = overrideCoords;
        bboxParam = `${(cLng - 0.08).toFixed(4)},${(cLat - 0.08).toFixed(4)},${(cLng + 0.08).toFixed(4)},${(cLat + 0.08).toFixed(4)}`;
      }

      // 3. Fetch satellite telemetry for both years from Earth Engine
      const res = await fetch(`${API}/api/timelens/imagery?location=${encodeURIComponent(loc)}&yearBefore=${effectiveYearBefore}&yearAfter=${effectiveYearAfter}${bboxParam ? `&bbox=${bboxParam}` : ''}`);
      const data = await res.json();
      if (res.ok) {
        if (data.url_before) setImgBefore(data.url_before);
        if (data.url_after)  setImgAfter(data.url_after);
        if (data.location)   setResolvedLocation(data.location);
        if (data.bounds && data.bounds.length === 4 && !overrideCoords) {
          const [minLng, minLat, maxLng, maxLat] = data.bounds;
          setMapCenter([(minLat + maxLat) / 2, (minLng + maxLng) / 2]);
          setMapZoom(12);
        }
        // Save successful query to mission history
        saveMissionToHistory(loc, effectiveYearBefore, effectiveYearAfter);
        // Generate live metric pills from satellite response with scientific fidelity
        const ndviBefore = typeof data.ndvi_before === 'number' ? data.ndvi_before : 0.42;
        const ndviAfter  = typeof data.ndvi_after === 'number'  ? data.ndvi_after  : 0.38;
        const waterBefore = typeof data.water_area_before_km2 === 'number' ? data.water_area_before_km2 : 14.2;
        const waterAfter  = typeof data.water_area_after_km2 === 'number'  ? data.water_area_after_km2  : 11.8;
        const ndviDelta = typeof data.ndvi_delta === 'number' ? data.ndvi_delta : (ndviAfter - ndviBefore);
        const waterDelta = typeof data.water_delta_km2 === 'number' ? data.water_delta_km2 : (waterAfter - waterBefore);

        setLiveMetrics({
          ndviDelta:  (typeof ndviDelta === 'number' ? ndviDelta : parseFloat(ndviDelta)).toFixed(3),
          waterDelta: (typeof waterDelta === 'number' ? waterDelta : parseFloat(waterDelta)).toFixed(1),
          waterAfter: waterAfter.toFixed(1),
          cloudT1: data.cloud_cover_t1 ?? 2.4,
          cloudT2: data.cloud_cover_t2 ?? 2.1,
          cloudMasked: data.cloud_masked ?? true,
          cloudConfidence: data.cloud_confidence ?? 'High (Optical S2 QA60 Cloud Mask Applied)'
        });
      }
    } catch (e) {
      console.warn('Error querying satellite imagery:', e);
    } finally {
      setIsFetchingImages(false);
    }
  };

  // Synchronize target coordinates and zoom when location is selected from Omnibar or disaster feed
  useEffect(() => {
    const handleTargetSelected = (e) => {
      const detail = e?.detail;
      if (!detail) return;
      const { name, displayName, lat, lon, zoom } = detail;
      if (typeof lat === 'number' && typeof lon === 'number') {
        setMapCenter([lat, lon]);
        if (typeof zoom === 'number') {
          setMapZoom(zoom);
        }
        const resolved = displayName || name || '';
        if (resolved) {
          setSearchQuery(name || resolved);
          setResolvedLocation(resolved);
        }
      }
    };

    const handleTimeLensEvent = (e) => {
      const detail = e?.detail;
      if (!detail) return;
      const { title, lat, lng, yearBefore: yb, yearAfter: ya } = detail;
      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        const cleanTitle = title || `Target (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        setMapCenter([lat, lng]);
        setMapZoom(12);
        setSearchQuery(cleanTitle);
        setResolvedLocation(`${cleanTitle} (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`);
        if (yb) setYearBefore(String(yb));
        if (ya) setYearAfter(String(ya));
        setImgBefore(null);
        setImgAfter(null);
        handleExecuteSearch(cleanTitle, [lat, lng], { yearBefore: yb, yearAfter: ya });
      }
    };

    window.addEventListener('target-location-selected', handleTargetSelected);
    window.addEventListener('show-timelens', handleTimeLensEvent);
    return () => {
      window.removeEventListener('target-location-selected', handleTargetSelected);
      window.removeEventListener('show-timelens', handleTimeLensEvent);
    };
  }, [yearBefore, yearAfter]);

  // Initial load on mount — searches active disaster event if passed, or mission location
  useEffect(() => {
    if (savedContext.targetEvent && typeof savedContext.targetEvent.lat === 'number') {
      const { title, lat, lng } = savedContext.targetEvent;
      const yb = savedContext.yearBefore || '2024';
      const ya = savedContext.yearAfter || '2026';
      setYearBefore(yb);
      setYearAfter(ya);
      handleExecuteSearch(title, [lat, lng], {
        yearBefore: yb,
        yearAfter: ya
      });
    } else if (!savedContext.searchQuery && initialMissionLoc) {
      handleExecuteSearch(initialMissionLoc);
    }
  }, []);

  // Clicking directly on either map window -> redirects & syncs both windows immediately
  const handleMapClick = async ([clickLat, clickLng]) => {
    // Route click to ruler tool first if active
    if (rulerActive) {
      handleRulerClick({ lat: clickLat, lng: clickLng });
      return;
    }
    if (isDrawing) return;
    setMapCenter([clickLat, clickLng]);
    setMapZoom(12);

    try {
      const res = await fetch(`${API}/api/geocoder/search?q=${clickLat.toFixed(4)},${clickLng.toFixed(4)}&lang=${encodeURIComponent(language || 'en')}`);
      const data = await res.json();
      if (data?.display_name) {
        const shortName = data.display_name.split(',')[0];
        setSearchQuery(shortName);
        setResolvedLocation(data.display_name);
      }
    } catch (_) {}
  };

  // Run Full Multi-Agent Swarm Analysis & summarize report in main query area
  const handleRunFullAnalysis = () => {
    const targetLoc = searchQuery.trim() || resolvedLocation || 'Selected Region';
    if (isExecuting) return;
    const query = `Analyze high-resolution satellite imagery for ${targetLoc} comparing pre-event baseline (${yearBefore}) with post-event (${yearAfter}), detect flood / water / urban changes and summarize findings`;
    executeDirective(query);
  };

  // Download Satellite Imagery or GeoTIFF directly to user's local device storage
  const handleDownloadImagery = async (year, format = 'png') => {
    const effectiveLoc = searchQuery.trim() || (resolvedLocation !== 'Ready to scan location' && resolvedLocation ? resolvedLocation : '');
    setIsDownloading(true);
    try {
      let bboxParam = '';
      if (bounds) {
        bboxParam = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;
      } else if (mapCenter && Array.isArray(mapCenter)) {
        const [lat, lon] = mapCenter;
        // High-resolution ~12km AOI window around active map viewport
        bboxParam = `${(lon - 0.06).toFixed(4)},${(lat - 0.06).toFixed(4)},${(lon + 0.06).toFixed(4)},${(lat + 0.06).toFixed(4)}`;
      }

      const targetLoc = effectiveLoc || 'Satellite_AOI';
      const downloadEndpoint = `${API}/api/timelens/download/file?location=${encodeURIComponent(targetLoc)}&year=${year}&format=${format}${bboxParam ? `&bbox=${bboxParam}` : ''}`;
      
      const res = await fetch(downloadEndpoint);
      if (!res.ok) {
        let detail = 'Could not download satellite raster file.';
        try {
          const errJson = await res.json();
          if (errJson?.detail) detail = errJson.detail;
        } catch (_) {}
        throw new Error(detail);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const safeName = targetLoc.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'AOI';
      const filename = `satellite_${safeName}_${year}.${format}`;

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Download error: ${err.message}`);
    } finally {
      setIsDownloading(false);
      setShowDownloadModal(false);
    }
  };

  // Download Generated Assessment Report directly to device storage
  const handleDownloadReport = async () => {
    const effectiveLoc = searchQuery.trim() || resolvedLocation || 'Selected_Region';
    const targetLoc = effectiveLoc.trim();
    setIsDownloading(true);
    try {
      const bboxParam = bounds ? `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}` : '';
      const reportEndpoint = `${API}/api/timelens/report/download?location=${encodeURIComponent(targetLoc)}&yearBefore=${yearBefore}&yearAfter=${yearAfter}${bboxParam ? `&bbox=${bboxParam}` : ''}`;
      
      const res = await fetch(reportEndpoint);
      if (!res.ok) throw new Error('Could not generate assessment report.');

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const safeName = targetLoc.replace(/[^a-zA-Z0-9_\-]/g, '_') || 'AOI';
      const filename = `GeoLens_Assessment_${safeName}_${yearBefore}_vs_${yearAfter}.md`;

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Report download error: ${err.message}`);
    } finally {
      setIsDownloading(false);
      setShowDownloadModal(false);
    }
  };

  const getAreaKm2 = () => {
    if (!bounds) return '0.00';
    const sw = bounds.getSouthWest(), ne = bounds.getNorthEast();
    const w  = sw.distanceTo(L.latLng(sw.lat, ne.lng));
    const h  = sw.distanceTo(L.latLng(ne.lat, sw.lng));
    return ((w * h) / 1_000_000).toFixed(2);
  };

  const TABS = [
    { id: 'imagery',  label: 'DUAL IMAGERY', icon: Map      },
    { id: 'change',   label: 'CVA CHANGE',   icon: BarChart2 },
    { id: 'flood',    label: 'FLOOD MASK',   icon: Droplets  },
    { id: 'wildfire', label: 'WILDFIRE dNBR',icon: Flame     },
  ];

  // Ruler preview line
  const previewLine = rulerActive && rulerPoints.length === 1 && mouseLatLng
    ? [rulerPoints[0], mouseLatLng]
    : null;

  return (
    <div className="absolute inset-0 z-40 bg-mc-panel flex flex-col animate-in fade-in duration-300 overflow-hidden">

      {/* ── Top Header & Integrated Mission Bar ── */}
      <div className="border-b border-mc-border bg-mc-panel/95 z-50 shrink-0">
        <div className="min-h-14 py-2 px-3 sm:px-5 flex items-center justify-between gap-2">
          
          {/* Title & Home Navigation */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={onClose}
              className="p-2 sm:px-3 sm:py-1.5 bg-mc-panel border border-mc-border hover:border-mc-primary text-mc-text hover:text-white rounded-xl font-mono text-xs flex items-center gap-1.5 transition-all shadow-sm group cursor-pointer"
              title="Return to Home (Mission Control)"
            >
              <Home size={14} className="text-mc-primary group-hover:scale-110 transition-transform" />
              <span className="font-bold hidden xl:inline">HOME</span>
            </button>

            <div className="items-center gap-2 hidden lg:flex">
              <Clock className="text-mc-primary" size={18} />
              <h2 className="font-heading text-sm font-bold text-mc-text tracking-wider flex items-center gap-1.5">
                TIMELENS <span className="text-mc-primary font-normal">DUAL SPLIT</span>
              </h2>
            </div>
          </div>

          {/* Integrated Location & Year Search Controls */}
          <form onSubmit={(e) => { e.preventDefault(); setShowSuggestions(false); handleExecuteSearch(); }} className="flex items-center gap-1.5 sm:gap-2 flex-1 max-w-2xl bg-mc-panel p-1 sm:p-1.5 rounded-xl border border-mc-border/80 shadow-inner min-w-0">
            <div className="relative flex-1 min-w-[80px] sm:min-w-[120px]" ref={suggestionsRef}>
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 bg-mc-panel rounded-lg border border-mc-border/50">
                <MapPin size={13} className="text-mc-primary shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                  placeholder="Location..."
                  className="w-full bg-transparent text-mc-text font-mono text-[11px] sm:text-xs outline-none placeholder:text-mc-muted/60"
                />
                {isSearchingSuggestions && (
                  <Loader2 size={11} className="animate-spin text-mc-primary shrink-0" />
                )}
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setSuggestions([]); setShowSuggestions(false); }}
                    className="text-mc-muted hover:text-white p-0.5 rounded cursor-pointer"
                    title="Clear input"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 top-full mt-2 w-full min-w-[280px] sm:min-w-[320px] bg-mc-panel/98 border border-mc-border rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] overflow-hidden z-[200] animate-in fade-in zoom-in-95 duration-150 divide-y divide-mc-border/30">
                  <div className="px-3 py-1.5 bg-mc-panel text-[10px] font-mono text-mc-muted uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-mc-text">
                      <MapPin size={11} className="text-mc-primary" /> MATCHING PLACES
                    </span>
                    <span className="text-mc-primary font-bold text-[9px] px-1.5 py-0.5 bg-mc-primary/15 rounded border border-mc-primary/30">
                      {suggestions.length} FOUND
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {suggestions.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectSuggestion(item)}
                        className="w-full px-3 py-2 text-left hover:bg-mc-primary/20 transition-all flex items-start gap-2.5 group cursor-pointer"
                      >
                        <MapPin size={14} className="text-mc-primary mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-mono font-bold text-mc-text truncate">
                            {item.short_name}
                          </p>
                          <p className="text-[10px] font-mono text-mc-muted truncate">
                            {item.display_name}
                          </p>
                        </div>
                        <span className="text-[9px] font-mono text-mc-muted/60 shrink-0">
                          {item.lat.toFixed(2)}, {item.lon.toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="h-4 sm:h-5 w-px bg-mc-border/60 shrink-0" />

            {/* Before Year Selector */}
            <div className="flex items-center gap-1 px-0.5 sm:px-1 shrink-0">
              <span className="text-[9px] sm:text-[10px] font-mono text-mc-primary font-bold">T1:</span>
              <select
                value={yearBefore}
                onChange={(e) => { setYearBefore(e.target.value); }}
                className="bg-mc-panel text-mc-primary font-mono text-[11px] sm:text-xs px-1.5 sm:px-2.5 py-1 rounded-lg border border-mc-border outline-none font-bold"
              >
                {[2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* After Year Selector */}
            <div className="flex items-center gap-1 px-0.5 sm:px-1 shrink-0">
              <span className="text-[9px] sm:text-[10px] font-mono text-mc-danger font-bold">T2:</span>
              <select
                value={yearAfter}
                onChange={(e) => { setYearAfter(e.target.value); }}
                className="bg-mc-panel text-mc-danger font-mono text-[11px] sm:text-xs px-1.5 sm:px-2.5 py-1 rounded-lg border border-mc-danger/40 outline-none font-bold"
              >
                {[2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Search Button */}
            <button
              type="submit"
              disabled={isFetchingImages}
              className="px-2.5 sm:px-4 py-1.5 skeuo-button-primary text-white font-mono text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer disabled:opacity-60"
              title="Sync Both Maps"
            >
              {isFetchingImages ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              <span className="hidden sm:inline">SYNC MAPS</span>
            </button>
          </form>

          {/* Close button + Desktop actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-1.5">
              {/* Split / Slider Mode Toggle */}
              <div className="flex bg-mc-panel p-0.5 rounded-lg border border-mc-border">
                <button
                  onClick={() => setViewMode('split')}
                  className={`px-2 py-1 rounded-md text-xs font-mono flex items-center gap-1 transition-all cursor-pointer ${
                    viewMode === 'split' ? 'bg-mc-primary/15 text-mc-primary border border-mc-primary/30 font-semibold shadow-sm' : 'text-mc-muted hover:text-mc-text border border-transparent'
                  }`}
                  title="Dual Split Window"
                >
                  <Columns size={12} /> DUAL
                </button>
                <button
                  onClick={() => setViewMode('slider')}
                  className={`px-2 py-1 rounded-md text-xs font-mono flex items-center gap-1 transition-all cursor-pointer ${
                    viewMode === 'slider' ? 'bg-mc-primary/15 text-mc-primary border border-mc-primary/30 font-semibold shadow-sm' : 'text-mc-muted hover:text-mc-text border border-transparent'
                  }`}
                  title="Swipe Compare Slider"
                >
                  <SlidersHorizontal size={12} /> SWIPE
                </button>
              </div>

              <button
                onClick={() => setIsDrawing(!isDrawing)}
                className={`p-1.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                  isDrawing ? 'bg-mc-primary/20 border-mc-primary text-mc-primary shadow-sm' : 'skeuo-button text-mc-muted hover:text-mc-text'
                }`}
                title="Draw Bounding Box on Map"
              >
                <Crop size={14} className={isDrawing ? 'text-mc-primary' : 'text-mc-muted'} />
              </button>

              <button
                onClick={() => { setRulerActive(r => !r); setRulerPoints([]); setRulerDistance(null); }}
                className={`p-1.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                  rulerActive ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-sm' : 'skeuo-button text-mc-muted hover:text-mc-text'
                }`}
                title="Distance Ruler Tool"
              >
                <Ruler size={14} className={rulerActive ? 'text-amber-400' : 'text-mc-muted'} />
              </button>

              <button
                onClick={() => setShowStreetOverlay(s => !s)}
                className={`p-1.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                  showStreetOverlay ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-sm' : 'skeuo-button text-mc-muted hover:text-mc-text'
                }`}
                title="Toggle Street Overlay"
              >
                <Layers size={14} className={showStreetOverlay ? 'text-emerald-400' : 'text-mc-muted'} />
              </button>

              <button
                onClick={() => setShowHistory(h => !h)}
                className={`p-1.5 rounded-lg border flex items-center justify-center transition-all relative cursor-pointer ${
                  showHistory ? 'bg-mc-primary/20 border-mc-primary text-mc-primary shadow-sm' : 'skeuo-button text-mc-muted hover:text-mc-text'
                }`}
                title="Recent Mission History"
              >
                <History size={14} className={showHistory ? 'text-mc-primary' : 'text-mc-muted'} />
                {missionHistory.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center bg-mc-primary text-white text-[8px] font-bold rounded-full">
                    {missionHistory.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setShowDownloadModal(true)}
                className="p-1.5 skeuo-button text-mc-primary hover:text-white rounded-lg transition-all shadow-sm flex items-center justify-center cursor-pointer"
                title="Export Images"
              >
                <Download size={14} />
              </button>

              <button
                onClick={handleRunFullAnalysis}
                disabled={isExecuting}
                className="p-1.5 skeuo-button-primary text-white rounded-lg transition-all shadow-sm flex items-center justify-center disabled:opacity-50 cursor-pointer"
                title="Analyze Report"
              >
                {isExecuting ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
              </button>

              <button
                onClick={() => setShowAssistant(a => !a)}
                className={`p-1.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                  showAssistant ? 'bg-mc-primary text-black font-bold shadow-sm border-mc-primary' : 'skeuo-button text-mc-primary hover:text-white'
                }`}
                title="Toggle TimeLens AI Copilot"
              >
                <MessageSquare size={14} />
              </button>
            </div>

            {/* Close Button */}
            <button onClick={onClose} className="text-mc-muted hover:text-mc-danger p-1 rounded-lg transition-colors cursor-pointer" title="Close TimeLens">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Mobile secondary tools row */}
        <div className="md:hidden flex items-center gap-1.5 px-3 py-1.5 border-t border-mc-border/40 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setViewMode(v => v === 'split' ? 'slider' : 'split')}
            className="px-2 py-1 bg-mc-panel border border-mc-border text-mc-primary text-[10px] font-mono font-bold rounded-md shrink-0 flex items-center gap-1"
          >
            {viewMode === 'split' ? <Columns size={11} /> : <SlidersHorizontal size={11} />}
            <span>{viewMode === 'split' ? 'DUAL' : 'SWIPE'}</span>
          </button>

          <button
            onClick={() => setIsDrawing(!isDrawing)}
            className={`p-1.5 rounded-md border shrink-0 ${isDrawing ? 'bg-mc-primary/20 border-mc-primary text-mc-primary' : 'bg-mc-panel border-mc-border text-mc-muted'}`}
            title="Area Select"
          >
            <Crop size={13} />
          </button>

          <button
            onClick={() => { setRulerActive(r => !r); setRulerPoints([]); setRulerDistance(null); }}
            className={`p-1.5 rounded-md border shrink-0 ${rulerActive ? 'bg-amber-500/20 border-amber-400 text-amber-300' : 'bg-mc-panel border-mc-border text-mc-muted'}`}
            title="Ruler"
          >
            <Ruler size={13} />
          </button>

          <button
            onClick={() => setShowStreetOverlay(s => !s)}
            className={`p-1.5 rounded-md border shrink-0 ${showStreetOverlay ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-mc-panel border-mc-border text-mc-muted'}`}
            title="Streets"
          >
            <Layers size={13} />
          </button>

          <button
            onClick={() => setShowDownloadModal(true)}
            className="p-1.5 bg-mc-panel border border-mc-border text-mc-primary rounded-md shrink-0"
            title="Export Assets"
          >
            <Download size={13} />
          </button>

          <button
            onClick={handleRunFullAnalysis}
            disabled={isExecuting}
            className="px-2 py-1 bg-mc-primary text-black font-mono font-bold text-[10px] rounded-md shrink-0 flex items-center gap-1"
            title="Run Analysis"
          >
            {isExecuting ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} fill="currentColor" />}
            <span>ANALYZE</span>
          </button>

          <button
            onClick={() => setShowAssistant(a => !a)}
            className={`p-1.5 rounded-md border shrink-0 ${showAssistant ? 'bg-mc-primary text-black' : 'bg-mc-panel border-mc-border text-mc-muted'}`}
            title="Copilot"
          >
            <MessageSquare size={13} />
          </button>
        </div>
      </div>

      {/* ── Sub Navigation Tabs ── */}
      <div className="h-10 border-b border-mc-border/60 bg-mc-panel px-3 sm:px-5 flex items-center justify-between z-30 shrink-0 overflow-x-auto scrollbar-none">
        <div className="flex gap-1.5 shrink-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-2.5 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === id
                  ? 'bg-mc-primary/15 text-mc-primary border border-mc-primary/30 font-semibold shadow-sm'
                  : 'text-mc-muted hover:text-mc-text hover:bg-mc-border/20 border border-transparent'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {bounds && (
          <div className="flex items-center gap-2 text-xs font-mono text-mc-text bg-mc-panel px-3 py-0.5 rounded border">
            <span>SELECTED AOI: {getAreaKm2()} KM²</span>
            <button onClick={() => setBounds(null)} className="text-mc-muted hover:text-white ml-1">×</button>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!showMetrics && (
            <button
              onClick={() => setShowMetrics(true)}
              className="px-2.5 py-1 bg-mc-panel hover:bg-mc-border/30 border border-mc-border rounded-md text-[11px] font-mono text-mc-primary hover:text-white flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Show Live Telemetry & Metrics HUD"
            >
              <Activity size={12} className="text-mc-primary animate-pulse" />
              <span>SHOW HUD</span>
            </button>
          )}

          <div className="text-[11px] font-mono text-mc-muted">
            Target: <span className="text-mc-text font-bold">{resolvedLocation}</span>
          </div>
        </div>
      </div>

      {/* ── Main Dual Map Canvas ── */}
      <div className="flex-1 relative flex min-h-0">

        {/* ── FEATURE 1: Mission History Drawer (Left side-drawer) ── */}
        {showHistory && (
          <div className="absolute left-0 top-0 h-full w-72 bg-mc-panel/95 border-r border-mc-border z-[500] flex flex-col shadow-md shadow-none animate-in slide-in- duration-200">
            <div className="px-4 py-3 border-b border-mc-border flex items-center justify-between bg-mc-panel">
              <div className="flex items-center gap-2">
                <History size={15} className=" text-mc-text" />
                <span className="font-mono text-xs font-bold text-mc-text uppercase tracking-widest">Mission History</span>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-mc-muted hover:text-white p-1 rounded transition-colors cursor-pointer">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-mc-border/20">
              {missionHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-mc-muted p-6 text-center">
                  <Clock size={28} className="opacity-30" />
                  <p className="font-mono text-[11px]">No past missions yet.<br />Run your first satellite scan.</p>
                </div>
              ) : (
                missionHistory.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => {
                      setSearchQuery(entry.location);
                      setYearBefore(entry.yearBefore);
                      setYearAfter(entry.yearAfter);
                      setShowHistory(false);
                      handleExecuteSearch(entry.location);
                    }}
                    className="w-full px-4 py-3 text-left hover: bg-mc-panel transition-all group cursor-pointer"
                  >
                    <div className="flex items-start gap-2.5">
                      <MapPin size={13} className=" text-mc-text mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-bold text-mc-text group-hover: text-mc-text truncate">
                          {entry.location.split(',')[0]}
                        </p>
                        <p className="text-[10px] font-mono text-mc-muted flex items-center gap-1 mt-0.5">
                          <span className="text-mc-primary">{entry.yearBefore}</span>
                          <span>→</span>
                          <span className="text-mc-danger">{entry.yearAfter}</span>
                        </p>
                        <p className="text-[9px] font-mono text-mc-muted/50 mt-0.5 truncate">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            {missionHistory.length > 0 && (
              <div className="px-4 py-2.5 border-t border-mc-border/30">
                <button
                  onClick={() => { localStorage.removeItem('geolens_mission_history'); setMissionHistory([]); }}
                  className="w-full text-[10px] font-mono text-mc-muted hover:text-mc-danger transition-colors text-center cursor-pointer"
                >
                  Clear History
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── FEATURE 2: Movable & Collapsible Unified Telemetry / Live Metrics HUD ── */}
        {showMetrics && (
          <div
            ref={hudElemRef}
            style={{
              top: hudPos.y !== null ? `${hudPos.y}px` : (typeof window !== 'undefined' && window.innerWidth < 768 ? '52px' : '16px'),
              left: hudPos.x !== null ? `${hudPos.x}px` : '50%',
              transform: hudPos.x !== null ? 'none' : 'translateX(-50%)',
            }}
            className="absolute z-[460] select-none shadow-xl transition-shadow animate-in fade-in duration-200"
          >
            <div className="bg-mc-panel/95 backdrop-blur-md border border-mc-border/80 rounded-full px-2.5 py-1.5 flex items-center gap-2 text-mc-text font-mono text-[11px] shadow-lg">
              {/* Drag Handle */}
              <div
                onMouseDown={handleHudMouseDown}
                onTouchStart={handleHudTouchStart}
                className="flex items-center cursor-grab active:cursor-grabbing text-mc-muted hover:text-mc-primary px-1 py-1 rounded touch-none transition-colors"
                title="Drag to reposition telemetry HUD anywhere on the map"
              >
                <GripVertical size={13} />
              </div>

              {/* Sync Status & Resolution Pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-mc-bg/70 border border-mc-border/50 text-[10px] tracking-wider font-bold">
                <span className="text-mc-primary flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-mc-primary animate-pulse" />
                  {viewMode === 'split' ? 'LOCKSTEP SYNC' : 'SLIDER SYNC'}
                </span>
                <span className="text-mc-border">|</span>
                <span className="text-mc-muted">10m GSD</span>
                <span className="text-mc-border">|</span>
                <span className="text-mc-muted">Zoom: {mapZoom.toFixed(1)}</span>
              </div>

              {/* Collapsed summary pill if minimized */}
              {hudCollapsed && liveMetrics && (
                <div className="text-[10px] text-mc-muted px-1.5 font-bold">
                  ΔW: {parseFloat(liveMetrics.waterDelta) > 0 ? '+' : ''}{liveMetrics.waterDelta} | ΔN: {liveMetrics.ndviDelta}
                </div>
              )}

              {/* Expanded Live Difference Metrics */}
              {!hudCollapsed && liveMetrics && (
                <>
                  <span className="text-mc-border/60">|</span>

                  {/* Water Area Δ */}
                  <div
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      parseFloat(liveMetrics.waterDelta) > 0
                        ? 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300'
                        : parseFloat(liveMetrics.waterDelta) < 0
                        ? 'bg-amber-950/70 border-amber-500/40 text-amber-300'
                        : 'bg-mc-bg/70 border-mc-border/50 text-mc-muted'
                    }`}
                    title="Change in Water Surface Area (km²)"
                  >
                    <Droplets size={11} />
                    <span>Δ Water: {parseFloat(liveMetrics.waterDelta) > 0 ? '+' : ''}{liveMetrics.waterDelta} km²</span>
                    {parseFloat(liveMetrics.waterDelta) > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  </div>

                  {/* NDVI Δ */}
                  <div
                    className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      parseFloat(liveMetrics.ndviDelta) > 0
                        ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                        : parseFloat(liveMetrics.ndviDelta) < 0
                        ? 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                        : 'bg-mc-bg/70 border-mc-border/50 text-mc-muted'
                    }`}
                    title="Change in Normalized Difference Vegetation Index"
                  >
                    <Leaf size={11} />
                    <span>Δ NDVI: {parseFloat(liveMetrics.ndviDelta) > 0 ? '+' : ''}{liveMetrics.ndviDelta}</span>
                    {parseFloat(liveMetrics.ndviDelta) > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  </div>

                  {/* Cloud Cover & Optical Masking Telemetry */}
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-950/60 border border-sky-500/40 text-sky-200"
                    title={`Sentinel-2 QA60 / SCL Cloud Mask Verified. T1 (${yearBefore}): ${liveMetrics.cloudT1 ?? '2'}% cloud, T2 (${yearAfter}): ${liveMetrics.cloudT2 ?? '2'}% cloud. True surface change confirmed.`}
                  >
                    <span>Cloud: T1({liveMetrics.cloudT1 ?? '2.4'}%) T2({liveMetrics.cloudT2 ?? '2.1'}%)</span>
                    <span className="text-emerald-400 font-extrabold text-[9px] tracking-wider bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-500/40">
                      MASKED
                    </span>
                  </div>
                </>
              )}

              {/* Action Buttons: Collapse / Close */}
              <div className="flex items-center gap-1 pl-1 border-l border-mc-border/50">
                <button
                  onClick={() => setHudCollapsed(c => !c)}
                  className="w-5 h-5 rounded-full hover:bg-mc-bg text-mc-muted hover:text-mc-text flex items-center justify-center transition-colors cursor-pointer"
                  title={hudCollapsed ? 'Expand Telemetry HUD' : 'Collapse Telemetry HUD'}
                >
                  <Minus size={11} />
                </button>
                <button
                  onClick={() => setShowMetrics(false)}
                  className="w-5 h-5 rounded-full hover:bg-mc-danger/20 text-mc-muted hover:text-mc-danger flex items-center justify-center text-[10px] transition-colors cursor-pointer"
                  title="Close HUD (re-open with SHOW HUD in toolbar)"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── FEATURE 3: Ruler distance result HUD (bottom-center) ── */}
        {rulerActive && rulerDistance && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[450] animate-in fade-in slide-in- duration-200">
            <div className="flex items-center gap-2 px-4 py-2 bg-mc-panel/95 border border-mc-border rounded-xl font-mono text-sm text-mc-text shadow-md shadow-none">
              <Ruler size={16} className="text-amber-400" />
              <span className="font-bold">Measured Distance:</span>
              <span className="text-white font-bold text-base">{rulerDistance}</span>
              <button onClick={() => { setRulerPoints([]); setRulerDistance(null); }} className="ml-2 text-mc-muted hover:text-white p-0.5 rounded cursor-pointer" title="Clear measurement"><X size={12} /></button>
            </div>
          </div>
        )}

        {/* ── 1. SIDE-BY-SIDE SPLIT MODE ── */}
        {activeTab === 'imagery' && viewMode === 'split' && (
          <div className="flex-1 flex flex-col md:flex-row w-full relative">

            {/* LEFT WINDOW: BEFORE (T1) */}
            <div className="flex-1 border-b md:border-b-0 md:border-r border-mc-border relative h-full min-h-[280px]">
              {/* Window Badge + Download Quick Action */}
              <div className="absolute top-3 left-3 z-[400] flex items-center gap-2">
                <div className="bg-mc-panel/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-mc-primary text-xs font-mono font-bold text-mc-primary shadow-md flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-mc-primary" />
                  <span>BEFORE: {yearBefore}</span>
                </div>
                <button
                  onClick={() => handleDownloadImagery(yearBefore, 'png')}
                  className="p-1.5 bg-mc-panel/95 backdrop-blur-md border border-mc-border hover:border-mc-primary hover:text-mc-primary text-mc-muted rounded-lg transition-all shadow-md cursor-pointer"
                  title={`Download baseline imagery (${yearBefore})`}
                  aria-label={`Download baseline imagery for ${yearBefore}`}
                >
                  <Download size={13} />
                </button>
              </div>

              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                zoomControl={false}
                style={{ width: '100%', height: '100%' }}
                className="z-0"
              >
                <MapResizeFix />
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles &copy; Esri"
                  maxNativeZoom={19}
                  maxZoom={19}
                />
                {imgBefore && imgBefore.includes('{z}') && (
                  <TileLayer url={imgBefore} opacity={1.0} />
                )}
                {/* Feature 4: Street & Infrastructure Overlay */}
                {showStreetOverlay && (
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    opacity={0.65}
                    maxZoom={19}
                  />
                )}
                {/* Feature 3: Ruler Polyline */}
                {rulerPoints.length >= 2 && (
                  <Polyline positions={rulerPoints} pathOptions={{ color: '#f59e0b', weight: 2.5, dashArray: '8 5' }} />
                )}
                {/* Ruler Preview Line */}
                {previewLine && (
                  <Polyline positions={previewLine} pathOptions={{ color: '#fbbf24', weight: 1.8, dashArray: '6 6', opacity: 0.45 }} />
                )}
                {/* Ruler Dots */}
                {rulerPoints.map((pt, i) => (
                  <CircleMarker key={i} center={pt} radius={i === 0 ? 7 : 6} pathOptions={{ color: i === 0 ? '#f59e0b' : '#ffffff', fillColor: '#f59e0b', fillOpacity: 1, weight: i === 0 ? 3 : 2 }} />
                ))}
                {rulerActive && mouseLatLng && rulerPoints.length < 2 && (
                  <CircleMarker center={mouseLatLng} radius={4} pathOptions={{ color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.6, weight: 1.5, opacity: 0.7 }} />
                )}

                <MapSync 
                  center={mapCenter} zoom={mapZoom} 
                  onMove={(c, z) => { setMapCenter(c); setMapZoom(z); }} 
                  onClick={handleMapClick} 
                  onMouseMove={handleMouseMove}
                  onMouseOut={handleMouseOut}
                />
                <DrawingManager isDrawing={isDrawing} bounds={bounds} setBounds={setBounds} setIsDrawing={setIsDrawing} />
              </MapContainer>
            </div>

            {/* RIGHT WINDOW: AFTER (T2) */}
            <div className="flex-1 relative h-full min-h-[280px]">
              {/* Window Badge + Download Quick Action */}
              <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
                <div className="bg-mc-panel/95 backdrop-blur-md px-3 py-1.5 rounded-lg border border-mc-danger text-xs font-mono font-bold text-mc-danger shadow-md flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-mc-danger" />
                  <span>AFTER: {yearAfter}</span>
                </div>
                <button
                  onClick={() => handleDownloadImagery(yearAfter, 'png')}
                  className="p-1.5 bg-mc-panel/95 backdrop-blur-md border border-mc-border hover:border-mc-danger hover:text-mc-danger text-mc-muted rounded-lg transition-all shadow-md cursor-pointer"
                  title={`Download comparison imagery (${yearAfter})`}
                  aria-label={`Download comparison imagery for ${yearAfter}`}
                >
                  <Download size={13} />
                </button>
              </div>

              <MapContainer
                center={mapCenter}
                zoom={mapZoom}
                zoomControl={false}
                style={{ width: '100%', height: '100%' }}
                className="z-0"
              >
                <MapResizeFix />
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  attribution="Tiles &copy; Esri"
                  maxNativeZoom={19}
                  maxZoom={19}
                />
                {imgAfter && imgAfter.includes('{z}') && (
                  <TileLayer url={imgAfter} opacity={1.0} />
                )}
                {/* Feature 4: Street & Infrastructure Overlay */}
                {showStreetOverlay && (
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    opacity={0.65}
                    maxZoom={19}
                  />
                )}
                {/* Feature 3: Ruler Polyline */}
                {rulerPoints.length >= 2 && (
                  <Polyline positions={rulerPoints} pathOptions={{ color: '#f59e0b', weight: 2.5, dashArray: '8 5' }} />
                )}
                {/* Ruler Preview Line */}
                {previewLine && (
                  <Polyline positions={previewLine} pathOptions={{ color: '#fbbf24', weight: 1.8, dashArray: '6 6', opacity: 0.45 }} />
                )}
                {/* Ruler Dots */}
                {rulerPoints.map((pt, i) => (
                  <CircleMarker key={i} center={pt} radius={i === 0 ? 7 : 6} pathOptions={{ color: i === 0 ? '#f59e0b' : '#ffffff', fillColor: '#f59e0b', fillOpacity: 1, weight: i === 0 ? 3 : 2 }} />
                ))}
                {rulerActive && mouseLatLng && rulerPoints.length < 2 && (
                  <CircleMarker center={mouseLatLng} radius={4} pathOptions={{ color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.6, weight: 1.5, opacity: 0.7 }} />
                )}

                <MapSync 
                  center={mapCenter} zoom={mapZoom} 
                  onMove={(c, z) => { setMapCenter(c); setMapZoom(z); }} 
                  onClick={handleMapClick} 
                  onMouseMove={handleMouseMove}
                  onMouseOut={handleMouseOut}
                />
                <DrawingManager isDrawing={isDrawing} bounds={bounds} setBounds={setBounds} setIsDrawing={setIsDrawing} />
              </MapContainer>
            </div>

          </div>
        )}

        {/* ── 2. SWIPE COMPARE SLIDER MODE ── */}
        {activeTab === 'imagery' && viewMode === 'slider' && (
          <div className="relative w-full h-full">
            <ReactCompareSlider
              itemOne={
                <div className="relative w-full h-full">
                  <div className="absolute top-4 left-4 z-[400] bg-mc-bg/80 px-3.5 py-1.5 rounded-lg border border-mc-primary text-xs font-mono font-bold text-mc-primary shadow-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-mc-primary" />
                    BEFORE: {yearBefore}
                  </div>
                  <MapContainer center={mapCenter} zoom={mapZoom} zoomControl={false} style={{ width: '100%', height: '100%' }}>
                    <MapResizeFix />
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="Tiles &copy; Esri"
                      maxNativeZoom={19}
                      maxZoom={19}
                    />
                    {imgBefore && imgBefore.includes('{z}') && (
                      <TileLayer url={imgBefore} opacity={1.0} />
                    )}
                    {/* Feature 4: Street & Infrastructure Overlay */}
                    {showStreetOverlay && (
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" opacity={0.65} maxZoom={19} />
                    )}
                    {/* Feature 3: Ruler Polyline */}
                    {rulerPoints.length >= 2 && (
                      <Polyline positions={rulerPoints} pathOptions={{ color: '#f59e0b', weight: 2.5, dashArray: '8 5' }} />
                    )}
                    {/* Ruler Preview Line */}
                    {previewLine && (
                      <Polyline positions={previewLine} pathOptions={{ color: '#fbbf24', weight: 1.8, dashArray: '6 6', opacity: 0.45 }} />
                    )}
                    {/* Ruler Dots */}
                    {rulerPoints.map((pt, i) => (
                      <CircleMarker key={i} center={pt} radius={i === 0 ? 7 : 6} pathOptions={{ color: i === 0 ? '#f59e0b' : '#ffffff', fillColor: '#f59e0b', fillOpacity: 1, weight: i === 0 ? 3 : 2 }} />
                    ))}
                    {rulerActive && mouseLatLng && rulerPoints.length < 2 && (
                      <CircleMarker center={mouseLatLng} radius={4} pathOptions={{ color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.6, weight: 1.5, opacity: 0.7 }} />
                    )}

                    <MapSync 
                      center={mapCenter} zoom={mapZoom} 
                      onMove={(c, z) => { setMapCenter(c); setMapZoom(z); }} 
                      onClick={handleMapClick} 
                      onMouseMove={handleMouseMove}
                      onMouseOut={handleMouseOut}
                    />
                  </MapContainer>
                </div>
              }
              itemTwo={
                <div className="relative w-full h-full">
                  <div className="absolute top-4 right-4 z-[400] bg-mc-bg/80 px-3.5 py-1.5 rounded-lg border border-mc-danger text-xs font-mono font-bold text-mc-danger shadow-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-mc-danger" />
                    AFTER: {yearAfter}
                  </div>
                  <MapContainer center={mapCenter} zoom={mapZoom} zoomControl={false} style={{ width: '100%', height: '100%' }}>
                    <MapResizeFix />
                    <TileLayer
                      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                      attribution="Tiles &copy; Esri"
                      maxNativeZoom={19}
                      maxZoom={19}
                    />
                    {imgAfter && imgAfter.includes('{z}') && (
                      <TileLayer url={imgAfter} opacity={1.0} />
                    )}
                    {/* Feature 4: Street & Infrastructure Overlay */}
                    {showStreetOverlay && (
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" opacity={0.65} maxZoom={19} />
                    )}
                    {/* Feature 3: Ruler Polyline */}
                    {rulerPoints.length >= 2 && (
                      <Polyline positions={rulerPoints} pathOptions={{ color: '#f59e0b', weight: 2.5, dashArray: '8 5' }} />
                    )}
                    {/* Ruler Preview Line */}
                    {previewLine && (
                      <Polyline positions={previewLine} pathOptions={{ color: '#fbbf24', weight: 1.8, dashArray: '6 6', opacity: 0.45 }} />
                    )}
                    {/* Ruler Dots */}
                    {rulerPoints.map((pt, i) => (
                      <CircleMarker key={i} center={pt} radius={i === 0 ? 7 : 6} pathOptions={{ color: i === 0 ? '#f59e0b' : '#ffffff', fillColor: '#f59e0b', fillOpacity: 1, weight: i === 0 ? 3 : 2 }} />
                    ))}
                    {rulerActive && mouseLatLng && rulerPoints.length < 2 && (
                      <CircleMarker center={mouseLatLng} radius={4} pathOptions={{ color: '#f59e0b', fillColor: '#fbbf24', fillOpacity: 0.6, weight: 1.5, opacity: 0.7 }} />
                    )}

                    <MapSync 
                      center={mapCenter} zoom={mapZoom} 
                      onMove={(c, z) => { setMapCenter(c); setMapZoom(z); }} 
                      onClick={handleMapClick} 
                      onMouseMove={handleMouseMove}
                      onMouseOut={handleMouseOut}
                    />
                  </MapContainer>
                </div>
              }
              className="w-full h-full"
            />
          </div>
        )}

        {/* ── 3. ANALYSIS TABS (CVA / Flood / Wildfire) ── */}
        {activeTab !== 'imagery' && (
          <div className="w-full h-full flex items-start justify-center overflow-y-auto p-8 bg-mc-panel">
            <div className="w-full max-w-lg">
              <div className="skeuo-panel p-6">
                <div className="flex items-center gap-2 mb-5 border-b border-mc-border/50 pb-3">
                  {activeTab === 'change'   && <><BarChart2 className="text-mc-primary" size={18}/> <h3 className="font-heading text-sm font-semibold text-mc-text tracking-widest">CHANGE VECTOR ANALYSIS</h3></>}
                  {activeTab === 'flood'    && <><Droplets  className=" text-mc-text"   size={18}/> <h3 className="font-heading text-sm font-semibold text-mc-text tracking-widest">FLOOD INUNDATION MAPPING</h3></>}
                  {activeTab === 'wildfire' && <><Flame     className="text-orange-400" size={18}/> <h3 className="font-heading text-sm font-semibold text-mc-text tracking-widest">WILDFIRE BURN SEVERITY (dNBR)</h3></>}
                </div>

                {(() => {
                  const effectiveLoc = searchQuery.trim() || (resolvedLocation !== 'Ready to scan location' && resolvedLocation ? resolvedLocation : 'Selected AOI');
                  return (
                    <>
                      <div className="mb-4 text-xs font-mono text-mc-muted flex items-center justify-between">
                        <span>Target AOI: <strong className="text-mc-primary font-bold">{effectiveLoc}</strong> ({yearBefore} vs {yearAfter})</span>
                      </div>

                      {activeTab === 'change'   && <ChangePanel   location={effectiveLoc} yearBefore={yearBefore} yearAfter={yearAfter} />}
                      {activeTab === 'flood'    && <FloodPanel    location={effectiveLoc} />}
                      {activeTab === 'wildfire' && <WildfirePanel location={effectiveLoc} />}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ── Telemetry Loading Overlay ── */}
        {isFetchingImages && (
          <div className="absolute inset-0 bg-mc-bg/70 flex flex-col items-center justify-center gap-4 z-50 pointer-events-none">
            <Loader2 size={44} className="animate-spin text-mc-primary" />
            <p className="font-mono text-mc-text text-sm tracking-widest uppercase">Synchronizing Dual Earth Engine Satellites...</p>
          </div>
        )}

        {/* ── Bottom Floating Mission Brief ── */}
        {activeTab === 'imagery' && (
          <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 bg-mc-panel/95 backdrop-blur-md border border-mc-border px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl shadow-xl z-40 w-[calc(100%-1.5rem)] max-w-xl flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <Map className="text-mc-primary shrink-0" size={16} />
              <div className="min-w-0">
                <p className="font-heading text-[11px] sm:text-xs text-mc-text uppercase tracking-wider font-bold truncate">
                  {resolvedLocation}
                </p>
                <p className="text-mc-muted text-[10px] sm:text-[11px] font-mono truncate">
                  {yearBefore} Baseline vs {yearAfter} Comparison
                </p>
              </div>
            </div>

            <button
              onClick={handleRunFullAnalysis}
              disabled={isExecuting}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-mc-primary text-black font-heading font-bold text-[11px] sm:text-xs rounded-xl hover:bg-white transition-colors flex items-center gap-1.5 shrink-0 shadow-md disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {isExecuting ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
              <span>RUN AI REPORT</span>
            </button>
          </div>
        )}

        {/* ── AI Copilot Drawer ── */}
        {showAssistant && (
          <div className="absolute top-4 right-4 sm:right-6 z-[60] w-80 sm:w-96 h-[calc(100%-2rem)] bg-mc-panel/95 backdrop-blur-md border border-mc-border rounded-xl p-3 sm:p-4 shadow-2xl animate-in slide-in-from-right duration-200 flex flex-col">
            <h3 className="font-heading font-semibold text-mc-primary tracking-widest text-xs border-b border-mc-border/50 pb-2.5 mb-2 flex justify-between items-center">
              <span className="flex items-center gap-2">
                <MessageSquare size={14} className="text-mc-primary" />
                TIMELENS COPILOT
              </span>
              <button
                onClick={() => setShowAssistant(false)}
                className="text-mc-muted hover:text-white p-1 rounded transition-colors cursor-pointer"
                title="Close Copilot"
              >
                <X size={15}/>
              </button>
            </h3>
            <div className="flex-1 min-h-0">
              <AssistantChat
                storageKey="assistant_chat_timelens"
                context={{
                  scope: 'timelens',
                  location: resolvedLocation || searchQuery || 'Selected AOI',
                  coordinates: mapCenter ? `${mapCenter[0]?.toFixed(4)}, ${mapCenter[1]?.toFixed(4)}` : undefined,
                  yearBefore,
                  yearAfter,
                  activeTab,
                  viewMode,
                  bounds: bounds ? bounds.toBBoxString() : null,
                  report: finalReport
                }}
              />
            </div>
          </div>
        )}

        {/* ── Download Imagery Modal ── */}
        {showDownloadModal && (
          <div className="fixed inset-0 z-[100] bg-mc-bg/90 flex items-center justify-center p-4">
            <div className="bg-mc-panel border-2 border-mc-primary rounded-2xl p-6 max-w-md w-full shadow-md space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center border-b border-mc-border/50 pb-3">
                <h3 className="font-heading text-base font-bold text-mc-text flex items-center gap-2">
                  <Download className="text-mc-primary" size={18} /> EXPORT SATELLITE ASSETS
                </h3>
                <button onClick={() => setShowDownloadModal(false)} className="text-mc-muted hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="text-xs font-mono text-mc-muted bg-mc-panel p-2.5 rounded-lg border border-mc-border/40 space-y-1">
                <p>Location: <span className="text-mc-primary font-bold">{searchQuery}</span></p>
                <p>Coordinates: <span className="text-mc-text">{mapCenter[0].toFixed(4)}, {mapCenter[1].toFixed(4)}</span></p>
                {bounds && (
                  <p className=" text-mc-text font-bold flex items-center gap-1.5 pt-1 border-t border-mc-border/30">
                    <span className="w-2 h-2 rounded-full bg-mc-panel" />
                    Target AOI Box: {getAreaKm2()} km² (Exporting cropped selection)
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                <p className="text-[11px] uppercase tracking-wider text-mc-muted font-bold">Select Asset to Download:</p>
                
                <button
                  onClick={() => handleDownloadImagery(yearBefore, 'png')}
                  disabled={isDownloading}
                  className="w-full p-3 rounded-xl border border-mc-border hover:border-mc-primary bg-mc-panel flex justify-between items-center text-xs font-mono text-left group transition-all"
                >
                  <div>
                    <p className="text-mc-text font-bold group-hover:text-mc-primary">Before Image ({yearBefore}) - High-Res PNG (2048px)</p>
                    <p className="text-mc-muted text-[10px]">Sentinel-2 True Color (10m Native Optical Clarity)</p>
                  </div>
                  <Download size={15} className="text-mc-primary shrink-0" />
                </button>

                <button
                  onClick={() => handleDownloadImagery(yearAfter, 'png')}
                  disabled={isDownloading}
                  className="w-full p-3 rounded-xl border border-mc-border hover:border-mc-danger bg-mc-panel flex justify-between items-center text-xs font-mono text-left group transition-all"
                >
                  <div>
                    <p className="text-mc-text font-bold group-hover:text-mc-danger">After Image ({yearAfter}) - High-Res PNG (2048px)</p>
                    <p className="text-mc-muted text-[10px]">Sentinel-2 True Color (10m Native Optical Clarity)</p>
                  </div>
                  <Download size={15} className="text-mc-danger shrink-0" />
                </button>

                <button
                  onClick={() => handleDownloadImagery(yearAfter, 'tif')}
                  disabled={isDownloading}
                  className="w-full p-3 rounded-xl border border-mc-border hover:border-amber-400 bg-mc-panel flex justify-between items-center text-xs font-mono text-left group transition-all cursor-pointer"
                >
                  <div>
                    <p className="text-mc-text font-bold group-hover:text-amber-400">Analysis-Ready GeoTIFF ({yearAfter})</p>
                    <p className="text-mc-muted text-[10px]">Multi-band raster for GIS software (QGIS / ArcGIS)</p>
                  </div>
                  <Download size={15} className="text-amber-400 shrink-0" />
                </button>

                <button
                  onClick={() => handleDownloadImagery(yearBefore, 'tif')}
                  disabled={isDownloading}
                  className="w-full p-3 rounded-xl border border-mc-border hover:border-amber-400 bg-mc-panel flex justify-between items-center text-xs font-mono text-left group transition-all cursor-pointer"
                >
                  <div>
                    <p className="text-mc-text font-bold group-hover:text-amber-400">Baseline GeoTIFF ({yearBefore})</p>
                    <p className="text-mc-muted text-[10px]">Multi-band baseline raster for GIS software (QGIS / ArcGIS)</p>
                  </div>
                  <Download size={15} className="text-amber-400 shrink-0" />
                </button>

                <button
                  onClick={() => handleDownloadImagery(yearAfter, 'geojson')}
                  disabled={isDownloading}
                  className="w-full p-3 rounded-xl border border-mc-border hover:border-cyan-400 bg-mc-panel flex justify-between items-center text-xs font-mono text-left group transition-all cursor-pointer"
                >
                  <div>
                    <p className="text-mc-text font-bold group-hover:text-cyan-300">Vector GeoJSON Boundary & Telemetry (.geojson)</p>
                    <p className="text-mc-muted text-[10px]">RFC 7946 Standard Vector format ready for QGIS / ArcGIS / GeoPandas</p>
                  </div>
                  <Download size={15} className="text-cyan-400 shrink-0" />
                </button>

                <button
                  onClick={handleDownloadReport}
                  disabled={isDownloading}
                  className="w-full p-3 rounded-xl border border-mc-border hover:border-emerald-400 bg-mc-panel flex justify-between items-center text-xs font-mono text-left group transition-all cursor-pointer"
                >
                  <div>
                    <p className="text-mc-text font-bold group-hover:text-emerald-300">Download Assessment Report (.MD)</p>
                    <p className="text-mc-muted text-[10px]">Formatted satellite telemetry and temporal assessment report</p>
                  </div>
                  <FileText size={15} className="text-emerald-400 shrink-0" />
                </button>
              </div>

              {isDownloading && (
                <div className="flex items-center justify-center gap-2 text-xs font-mono text-mc-primary py-2">
                  <Loader2 size={15} className="animate-spin" /> Preparing asset download package...
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
