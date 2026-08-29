import React, { useState, useEffect, useRef } from 'react';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import { X, Clock, Map, Settings2, Target, MapPin, Play, Loader2, MessageSquare, BarChart2, Flame, Droplets, Building2, Leaf } from 'lucide-react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useMission } from '../context/MissionContext';
import AssistantChat from './AssistantChat';

const API = 'http://localhost:8000';

// ── Map Synchronization Hook ──────────────────────────────────────────────
function MapSync({ center, zoom, onMove }) {
  const map = useMap();
  const isUpdating = useRef(false);

  useEffect(() => {
    if (isUpdating.current) return;
    const currentCenter = map.getCenter();
    if (
      Math.abs(currentCenter.lat - center[0]) > 0.0001 ||
      Math.abs(currentCenter.lng - center[1]) > 0.0001 ||
      map.getZoom() !== zoom
    ) {
      map.setView(center, zoom, { animate: false });
    }
  }, [center, zoom, map]);

  useMapEvents({
    move() {
      isUpdating.current = true;
      const c = map.getCenter();
      onMove([c.lat, c.lng], map.getZoom());
      setTimeout(() => { isUpdating.current = false; }, 50);
    },
    zoom() {
      isUpdating.current = true;
      const c = map.getCenter();
      onMove([c.lat, c.lng], map.getZoom());
      setTimeout(() => { isUpdating.current = false; }, 50);
    }
  });

  return null;
}

// ── Severity pill colours ─────────────────────────────────────────────────
const SEVERITY_COLORS = {
  'CRITICAL':         'bg-red-900/60 text-red-300 border-red-700',
  'HIGH':             'bg-orange-900/60 text-orange-300 border-orange-700',
  'HIGH SEVERITY':    'bg-red-900/60 text-red-300 border-red-700',
  'MODERATE':         'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  'RAPID GROWTH':     'bg-purple-900/60 text-purple-300 border-purple-700',
  'IMPROVEMENT':      'bg-green-900/60 text-green-300 border-green-700',
  'STABLE':           'bg-slate-800 text-slate-300 border-slate-600',
  'LOW':              'bg-slate-800 text-slate-400 border-slate-600',
  'UNKNOWN':          'bg-slate-800 text-slate-500 border-slate-600',
};

function SeverityPill({ label }) {
  const cls = Object.entries(SEVERITY_COLORS).find(([k]) => label?.toUpperCase().includes(k))?.[1]
    || 'bg-slate-800 text-slate-400 border-slate-600';
  return (
    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${cls}`}>
      {label || 'N/A'}
    </span>
  );
}

function MetricCard({ label, value, unit, highlight }) {
  return (
    <div className="bg-[#070a10] border border-mc-border/40 rounded-lg p-3">
      <p className="text-mc-muted text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <p className={`font-mono font-bold text-lg ${highlight ? 'text-mc-primary' : 'text-mc-text'}`}>
        {value ?? '—'} <span className="text-xs font-normal text-mc-muted">{unit}</span>
      </p>
    </div>
  );
}

// ── Change Detection (CVA) Panel ─────────────────────────────────────────
function ChangePanel({ location, yearBefore, yearAfter }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState(null);

  const run = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/timelens/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, year_t1: +yearBefore, year_t2: +yearAfter }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Unknown error');
      setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <button onClick={run} disabled={loading || !location}
        className="w-full py-2.5 skeuo-button-primary rounded-lg font-heading text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
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

          {/* NDVI */}
          {data.ndvi_change && (
            <div className="bg-[#0a0d13] border border-mc-border/30 rounded-lg p-3 space-y-2">
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

          {/* Urban */}
          {data.urban_expansion && (
            <div className="bg-[#0a0d13] border border-mc-border/30 rounded-lg p-3 space-y-2">
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

          {/* Critical flags */}
          {data.critical_flags?.length > 0 && (
            <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3 space-y-1">
              <p className="text-red-400 text-[10px] font-mono uppercase tracking-widest">CRITICAL FLAGS</p>
              {data.critical_flags.map((f, i) => (
                <p key={i} className="text-red-300 text-xs font-mono">• {f}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Flood Analysis Panel ─────────────────────────────────────────────────
function FloodPanel({ location }) {
  const [floodStart, setFloodStart] = useState('');
  const [floodEnd,   setFloodEnd]   = useState('');
  const [baseYear,   setBaseYear]   = useState(2022);
  const [data,   setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const run = async () => {
    if (!floodStart || !floodEnd || !location) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/timelens/flood`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, flood_start: floodStart, flood_end: floodEnd, baseline_year: +baseYear }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Unknown error');
      setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
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
          {[2018,2019,2020,2021,2022,2023].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <button onClick={run} disabled={loading || !floodStart || !floodEnd || !location}
        className="w-full py-2.5 skeuo-button-primary rounded-lg font-heading text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
        {loading ? <Loader2 className="animate-spin" size={14} /> : <Droplets size={14} />}
        {loading ? 'RUNNING FLOOD ANALYSIS...' : 'DETECT FLOOD EXTENT'}
      </button>

      {error && <p className="text-red-400 text-xs font-mono bg-red-950/40 p-3 rounded">{error}</p>}

      {data && (
        <div className="space-y-3 animate-in fade-in">
          {/* NDWI Optical */}
          {data.ndwi_optical && !data.ndwi_optical.error && (
            <div className="bg-[#0a0d13] border border-blue-800/40 rounded-lg p-3 space-y-2">
              <p className="text-blue-400 text-[10px] font-mono uppercase tracking-widest">NDWI OPTICAL (Sentinel-2)</p>
              <div className="grid grid-cols-2 gap-2">
                <MetricCard label="Water Area" value={data.ndwi_optical.water_area_flood_km2} unit="km²" highlight />
                <MetricCard label="Incremental" value={data.ndwi_optical.incremental_inundation_km2} unit="km²" />
              </div>
              <SeverityPill label={data.ndwi_optical.inundation_severity} />
            </div>
          )}

          {/* SAR */}
          {data.sar_microwave && !data.sar_microwave.error && (
            <div className="bg-[#0a0d13] border border-cyan-800/40 rounded-lg p-3 space-y-2">
              <p className="text-cyan-400 text-[10px] font-mono uppercase tracking-widest">SAR MICROWAVE (Sentinel-1)</p>
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
  const [fireStart,    setFireStart]    = useState('');
  const [fireEnd,      setFireEnd]      = useState('');
  const [preFireStart, setPreFireStart] = useState('');
  const [preFireEnd,   setPreFireEnd]   = useState('');
  const [data,    setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const run = async () => {
    if (!fireStart || !fireEnd || !preFireStart || !preFireEnd || !location) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/timelens/wildfire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, fire_start: fireStart, fire_end: fireEnd, pre_fire_start: preFireStart, pre_fire_end: preFireEnd }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'Unknown error');
      setData(json);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
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

      <button onClick={run} disabled={loading || !fireStart || !location}
        className="w-full py-2.5 skeuo-button-primary rounded-lg font-heading text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
        {loading ? <Loader2 className="animate-spin" size={14} /> : <Flame size={14} />}
        {loading ? 'COMPUTING dNBR...' : 'MAP BURN SEVERITY'}
      </button>

      {error && <p className="text-red-400 text-xs font-mono bg-red-950/40 p-3 rounded">{error}</p>}

      {data && !data.error && (
        <div className="space-y-3 animate-in fade-in">
          <div className="bg-[#0a0d13] border border-orange-800/40 rounded-lg p-3 space-y-2">
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

  const [showConfig, setShowConfig]       = useState(!finalReport);
  const [showAssistant, setShowAssistant] = useState(true);
  const [activeTab, setActiveTab]         = useState('imagery'); // imagery | change | flood | wildfire
  const [locMode, setLocMode]             = useState('place');
  const [location, setLocation]           = useState('');
  const [lat, setLat]                     = useState('');
  const [lng, setLng]                     = useState('');
  const [yearBefore, setYearBefore]       = useState('2018');
  const [yearAfter,  setYearAfter]        = useState('2024');

  const [imgBefore, setImgBefore]           = useState('https://images.unsplash.com/photo-1594247545366-02e0c273ecb8?auto=format&fit=crop&q=80&w=1200');
  const [imgAfter,  setImgAfter]            = useState('https://images.unsplash.com/photo-1463116666993-9c8df6e08216?auto=format&fit=crop&q=80&w=1200');
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  const [resolvedLocation, setResolvedLocation] = useState('');
  
  const [mapCenter, setMapCenter] = useState([20, 0]);
  const [mapZoom, setMapZoom] = useState(3);

  const locStr = locMode === 'place' ? location : `${lat}, ${lng}`;

  const handleExecute = async () => {
    if (!locStr.trim()) return;
    setIsFetchingImages(true);
    try {
      const res  = await fetch(`${API}/api/timelens/imagery?location=${encodeURIComponent(locStr)}&yearBefore=${yearBefore}&yearAfter=${yearAfter}`);
      const data = await res.json();
      if (res.ok) {
        setImgBefore(data.url_before);
        setImgAfter(data.url_after);
        setResolvedLocation(data.location);
        if (data.bounds && data.bounds.length === 4) {
          const [minLng, minLat, maxLng, maxLat] = data.bounds;
          setMapCenter([(minLat + maxLat) / 2, (minLng + maxLng) / 2]);
          setMapZoom(11); // Set a good default zoom for areas
        }
      } else {
        console.warn('Failed to fetch satellite imagery:', data.detail);
      }
    } catch (e) {
      console.warn('Error connecting to backend API:', e);
    } finally {
      setIsFetchingImages(false);
      setShowConfig(false);
      // ⬆ NOTE: We do NOT auto-trigger executeDirective here.
      // The user must explicitly click "Run Full AI Analysis" below.
    }
  };

  // Separate function — only called when user explicitly clicks "Analyze" button
  const handleRunFullAnalysis = () => {
    if (!locStr.trim() || isExecuting) return;
    const query = `Compare satellite imagery of ${locStr} between ${yearBefore} and ${yearAfter}, analyze temporal changes and land use differences`;
    executeDirective(query);
  };

  const time_lens = finalReport?.official_report?.time_lens || {
    year_before: yearBefore,
    year_after:  yearAfter,
    brief: resolvedLocation
      ? `Live Earth Engine feed connected for ${resolvedLocation}. Analyzing temporal changes...`
      : 'Awaiting mission parameters to generate temporal analysis. Please configure scan targets.',
  };

  const TABS = [
    { id: 'imagery',  label: 'IMAGERY',  icon: Map      },
    { id: 'change',   label: 'CVA',      icon: BarChart2 },
    { id: 'flood',    label: 'FLOOD',    icon: Droplets  },
    { id: 'wildfire', label: 'WILDFIRE', icon: Flame     },
  ];

  return (
    <div className="absolute inset-0 z-40 bg-mc-bg flex flex-col animate-in fade-in duration-500 overflow-hidden">

      {/* Top Header */}
      <div className="h-16 border-b border-mc-border bg-mc-bg/90 backdrop-blur-sm flex items-center justify-between px-6 z-50 shrink-0">
        <div className="flex items-center gap-3">
          <Clock className="text-mc-secondary" size={24} />
          <h2 className="font-heading text-xl font-semibold text-mc-text tracking-wide">
            TIMELENS <span className="text-mc-muted font-light">COMPARISON</span>
          </h2>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-[#05070a] p-1 rounded-lg border border-mc-border/30">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 rounded-md font-mono text-xs flex items-center gap-1.5 transition-all ${
                activeTab === id
                  ? 'bg-mc-primary/20 text-mc-primary border border-mc-primary/40'
                  : 'text-mc-muted hover:text-mc-text'
              }`}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        <div className="flex gap-4 items-center">
          <span className="font-mono text-sm text-mc-primary font-bold">BEFORE: {yearBefore}</span>
          <span className="font-mono text-sm text-mc-danger font-bold">AFTER: {yearAfter}</span>
          <button onClick={() => setShowAssistant(!showAssistant)}
            className={`p-2 rounded transition-colors ${showAssistant ? 'text-mc-primary' : 'text-mc-muted hover:text-mc-text'}`}
            title="Toggle AI Assistant">
            <MessageSquare size={22} />
          </button>
          <button onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded transition-colors ${showConfig ? 'text-mc-primary' : 'text-mc-muted hover:text-mc-text'}`}
            title="Mission Parameters">
            <Settings2 size={22} />
          </button>
          <button onClick={onClose} className="text-mc-muted hover:text-mc-text p-2 rounded transition-colors">
            <X size={22} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex min-h-0">

        {/* Config Panel */}
        {showConfig && (
          <div className="absolute top-6 left-6 z-50 w-80 skeuo-panel p-5 max-h-[calc(100vh-200px)] overflow-y-auto animate-in fade-in slide-in-from-left-4">
            <div className="flex items-center gap-2 mb-5 border-b border-mc-border/50 pb-3">
              <Settings2 className="text-mc-secondary" size={18} />
              <h3 className="font-heading font-semibold text-mc-text tracking-widest text-xs">MISSION PARAMETERS</h3>
            </div>
            <div className="space-y-5 font-mono text-sm">
              {/* Location */}
              <div className="bg-[#0a0d13] p-3 rounded-lg border border-mc-border/30 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="text-mc-secondary" size={13} />
                  <span className="text-mc-secondary text-xs font-bold tracking-widest">SPATIAL TARGETING</span>
                </div>
                <div className="flex gap-1 p-1 bg-[#05070a] rounded-lg">
                  {['place', 'coords'].map(mode => (
                    <button key={mode} onClick={() => setLocMode(mode)}
                      className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 rounded-md transition-all text-xs ${locMode === mode ? 'skeuo-button text-mc-text' : 'text-mc-muted hover:text-mc-text'}`}>
                      {mode === 'place' ? <><MapPin size={12}/> Place Name</> : <><Target size={12}/> Coords</>}
                    </button>
                  ))}
                </div>
                {locMode === 'place'
                  ? <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Konaseema, India" className="w-full p-2 skeuo-input text-center text-sm" />
                  : <div className="flex flex-col gap-2">
                      <input type="text" value={lat} onChange={e => setLat(e.target.value)} placeholder="Latitude" className="w-full p-2 skeuo-input text-center text-sm" />
                      <input type="text" value={lng} onChange={e => setLng(e.target.value)} placeholder="Longitude" className="w-full p-2 skeuo-input text-center text-sm" />
                    </div>
                }
              </div>

              {/* Temporal */}
              <div className="bg-[#0a0d13] p-3 rounded-lg border border-mc-border/30">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="text-mc-secondary" size={13} />
                  <span className="text-mc-secondary text-xs font-bold tracking-widest">TEMPORAL SCAN</span>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-mc-muted text-[10px] mb-1 tracking-wider text-center">T-MINUS (BEFORE)</label>
                    <select value={yearBefore} onChange={e => setYearBefore(e.target.value)} className="w-full p-2 skeuo-input appearance-none text-center font-bold text-sm">
                      {[2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-mc-muted text-[10px] mb-1 tracking-wider text-center">T-PLUS (AFTER)</label>
                    <select value={yearAfter} onChange={e => setYearAfter(e.target.value)} className="w-full p-2 skeuo-input appearance-none text-center font-bold text-sm">
                      {[2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Execute */}
              <button onClick={handleExecute}
                disabled={isExecuting || isFetchingImages || (locMode === 'place' ? !location : (!lat || !lng))}
                className="w-full py-3 skeuo-button-primary rounded-lg font-heading font-bold tracking-widest flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                {(isExecuting || isFetchingImages) ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} fill="currentColor" />}
                {isFetchingImages ? 'FETCHING IMAGERY...' : isExecuting ? 'UPLINKING...' : 'INITIATE IMAGERY SCAN'}
              </button>
            </div>
          </div>
        )}

        {/* === IMAGERY TAB === */}
        {activeTab === 'imagery' && (
          <div className="relative w-full h-full">
            {/* Always show the compare slider — never black screen */}
            <ReactCompareSlider
              itemOne={
                imgBefore.includes('{z}') ? (
                  <MapContainer center={mapCenter} zoom={mapZoom} zoomControl={false} style={{ width: '100%', height: '100%' }}>
                    <TileLayer url={imgBefore} />
                    <MapSync center={mapCenter} zoom={mapZoom} onMove={(c, z) => { setMapCenter(c); setMapZoom(z); }} />
                  </MapContainer>
                ) : (
                  <ReactCompareSliderImage src={imgBefore} alt="Before" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                )
              }
              itemTwo={
                imgAfter.includes('{z}') ? (
                  <MapContainer center={mapCenter} zoom={mapZoom} zoomControl={false} style={{ width: '100%', height: '100%' }}>
                    <TileLayer url={imgAfter} />
                    <MapSync center={mapCenter} zoom={mapZoom} onMove={(c, z) => { setMapCenter(c); setMapZoom(z); }} />
                  </MapContainer>
                ) : (
                  <ReactCompareSliderImage src={imgAfter} alt="After" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                )
              }
              className="w-full h-full"
            />
            {/* Subtle loading overlay — doesn't hide the slider */}
            {isFetchingImages && (
              <div className="absolute inset-0 bg-mc-bg/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4 z-20">
                <Loader2 size={48} className="animate-spin text-mc-primary" />
                <p className="font-mono text-mc-text tracking-widest uppercase animate-pulse">Requesting Earth Engine Telemetry...</p>
              </div>
            )}
          </div>
        )}

        {/* === ANALYSIS TABS (CVA / Flood / Wildfire) === */}
        {activeTab !== 'imagery' && (
          <div className="w-full h-full flex items-start justify-center overflow-y-auto p-8 bg-mc-bg/80">
            <div className="w-full max-w-lg">
              <div className="skeuo-panel p-6">
                <div className="flex items-center gap-2 mb-5 border-b border-mc-border/50 pb-3">
                  {activeTab === 'change'   && <><BarChart2 className="text-mc-primary" size={18}/> <h3 className="font-heading text-sm font-semibold text-mc-text tracking-widest">CHANGE VECTOR ANALYSIS</h3></>}
                  {activeTab === 'flood'    && <><Droplets  className="text-blue-400"   size={18}/> <h3 className="font-heading text-sm font-semibold text-mc-text tracking-widest">FLOOD INUNDATION MAPPING</h3></>}
                  {activeTab === 'wildfire' && <><Flame     className="text-orange-400" size={18}/> <h3 className="font-heading text-sm font-semibold text-mc-text tracking-widest">WILDFIRE BURN SEVERITY (dNBR)</h3></>}
                </div>

                {!locStr.trim() && (
                  <p className="text-mc-muted text-sm font-mono text-center py-6">
                    Enter a location in Mission Parameters first.
                  </p>
                )}

                {locStr.trim() && activeTab === 'change'   && <ChangePanel   location={locStr} yearBefore={yearBefore} yearAfter={yearAfter} />}
                {locStr.trim() && activeTab === 'flood'    && <FloodPanel    location={locStr} />}
                {locStr.trim() && activeTab === 'wildfire' && <WildfirePanel location={locStr} />}
              </div>
            </div>
          </div>
        )}

        {/* Intelligence Brief — imagery tab only */}
        {activeTab === 'imagery' && (
          <div className="absolute bottom-8 left-8 bg-mc-panel/90 backdrop-blur-md border border-mc-border p-5 rounded-xl shadow-2xl max-w-sm z-10">
            <div className="flex items-center gap-2 mb-2">
              <Map className="text-mc-primary" size={16} />
              <h3 className="font-heading text-xs text-mc-text uppercase tracking-widest">Intelligence Brief</h3>
            </div>
            <p className="text-mc-muted text-xs font-body leading-relaxed mb-4">{time_lens.brief}</p>
            {/* Explicit trigger — user must click this to fire agents */}
            {resolvedLocation && (
              <button
                onClick={handleRunFullAnalysis}
                disabled={isExecuting}
                className="w-full py-2 bg-mc-primary/20 border border-mc-primary/50 text-mc-primary font-mono text-xs rounded-lg hover:bg-mc-primary/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isExecuting
                  ? <><Loader2 size={12} className="animate-spin" /> RUNNING AI ANALYSIS...</>
                  : <><Play size={12} fill="currentColor" /> RUN FULL AI ANALYSIS</>
                }
              </button>
            )}
          </div>
        )}

        {/* AI Assistant */}
        {showAssistant && (
          <div className="absolute top-6 right-6 z-50 w-72 h-[calc(100%-3rem)] skeuo-panel p-4 shadow-2xl animate-in slide-in-from-right-4 flex flex-col">
            <h3 className="font-heading font-semibold text-mc-primary tracking-widest text-xs border-b border-mc-border/50 pb-3 mb-3 flex justify-between items-center">
              AI ASSISTANT
              <button onClick={() => setShowAssistant(false)} className="text-mc-muted hover:text-mc-text transition-colors"><X size={14}/></button>
            </h3>
            <div className="flex-1 min-h-0">
              <AssistantChat />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
