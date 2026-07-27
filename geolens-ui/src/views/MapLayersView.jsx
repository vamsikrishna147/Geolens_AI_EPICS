import React, { useState, useEffect } from 'react';
import { ArrowLeft, Layers, Map as MapIcon, Database, Eye, EyeOff, Target, Play, Loader2, AlertCircle, Search, Compass, ZoomIn, ZoomOut, Navigation } from 'lucide-react';
import { MapContainer, TileLayer, WMSTileLayer, useMap, useMapEvents, Rectangle, CircleMarker, Polygon } from 'react-leaflet';
import L from 'leaflet';
import { useLanguage } from '../context/LanguageContext';
import { useMission } from '../context/MissionContext';

const API = 'http://localhost:8000';

// Controller to programmatic fly map to lat/lon & zoom
function MapFlyController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom || 12, { duration: 1.5 });
    }
  }, [center, zoom, map]);
  return null;
}

function MapSelectionManager({ isSelectionMode, bounds, setBounds, setIsSelectionMode }) {
  const map = useMap();
  const [startPoint, setStartPoint] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (isSelectionMode) { map.dragging.disable(); map._container.style.cursor = 'crosshair'; }
    else { map.dragging.enable(); map._container.style.cursor = ''; }
  }, [isSelectionMode, map]);

  useMapEvents({
    mousedown(e) { if (!isSelectionMode) return; setStartPoint(e.latlng); setIsDrawing(true); setBounds(null); },
    mousemove(e) { if (!isSelectionMode || !isDrawing || !startPoint) return; setBounds(L.latLngBounds(startPoint, e.latlng)); },
    mouseup()    { if (!isSelectionMode || !isDrawing) return; setIsDrawing(false); setIsSelectionMode(false); },
  });

  return bounds ? <Rectangle bounds={bounds} pathOptions={{ color: '#00f6ff', weight: 2, fillOpacity: 0.2, dashArray: '4' }} /> : null;
}

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const OVERLAY_CONFIG = [
  { id: 'Fire Anomalies (FIRMS)',  type: 'HEATMAP',       color: '#ff4444', apiEndpoint: null     },
  { id: 'Flood Inundation (SAR)',  type: 'VECTOR',        color: '#0055ff', apiEndpoint: null     },
  { id: 'Urban Sprawl',            type: 'AI CLASSIFIED', color: '#a020f0', apiEndpoint: 'urban'  },
  { id: 'Vegetation (EVI)',        type: 'SPECTRAL',      color: '#22c55e', apiEndpoint: 'evi'    },
];

export default function MapLayersView({ onBack }) {
  const { t }                                   = useLanguage();
  const { executeDirective }                    = useMission();
  const [activeBase, setActiveBase]             = useState('Esri Satellite');
  const [activeLayers, setActiveLayers]         = useState(['Fire Anomalies (FIRMS)']);
  const [bounds, setBounds]                     = useState(null);
  const [isSelectionMode, setIsSelectionMode]   = useState(false);
  const [phase4Data, setPhase4Data]             = useState({});
  const [loadingLayer, setLoadingLayer]         = useState(null);

  // Search & Map Navigation
  const [searchQuery, setSearchQuery]           = useState('');
  const [isSearching, setIsSearching]           = useState(false);
  const [mapCenter, setMapCenter]               = useState([40.7128, -74.0060]); // NYC default
  const [mapZoom, setMapZoom]                   = useState(12);
  const [currentPlaceName, setCurrentPlaceName] = useState('New York City, USA');
  const [nearbyTargets, setNearbyTargets]       = useState([]);

  // Fetch nearby targets whenever currentPlaceName changes
  useEffect(() => {
    if (!currentPlaceName) return;
    fetch(`${API}/api/geocoder/nearby?location=${encodeURIComponent(currentPlaceName)}`)
      .then(res => res.json())
      .then(data => {
        if (data.recommended_targets) setNearbyTargets(data.recommended_targets);
      })
      .catch(() => {});
  }, [currentPlaceName]);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`${API}/api/geocoder/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (res.ok && data.lat && data.lon) {
        setMapCenter([data.lat, data.lon]);
        setMapZoom(12);
        setCurrentPlaceName(data.display_name.split(',')[0]);
      } else {
        alert("Location not found. Try a broader city or country name.");
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectTarget = (target) => {
    setMapCenter([target.lat, target.lon]);
    setMapZoom(target.zoom || 12);
  };

  const handleAnalyze = () => {
    if (!bounds) return;
    const center = bounds.getCenter();
    const query = `Analyze the geographic region around ${currentPlaceName} at coordinates ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}. Check for recent infrastructure changes and anomalies.`;
    executeDirective(query);
    if (onBack) onBack();
  };

  const callPhase4Api = async (layerCfg) => {
    if (!layerCfg.apiEndpoint) return;
    setLoadingLayer(layerCfg.id);
    try {
      let result;
      if (layerCfg.apiEndpoint === 'urban') {
        const res = await fetch(`${API}/api/timelens/urban`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location: currentPlaceName, year_t1: 2019, year_t2: 2024 }),
        });
        result = await res.json();
      } else if (layerCfg.apiEndpoint === 'evi') {
        const today       = new Date().toISOString().slice(0, 10);
        const sixMonthAgo = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
        const res = await fetch(
          `${API}/api/timelens/evi?location=${encodeURIComponent(currentPlaceName)}&start_date=${sixMonthAgo}&end_date=${today}`
        );
        result = await res.json();
      }
      setPhase4Data(prev => ({ ...prev, [layerCfg.id]: result }));
    } catch (e) {
      setPhase4Data(prev => ({ ...prev, [layerCfg.id]: { error: e.message } }));
    } finally {
      setLoadingLayer(null);
    }
  };

  const toggleLayer = async (layerCfg) => {
    const isActive = activeLayers.includes(layerCfg.id);
    setActiveLayers(prev => isActive ? prev.filter(l => l !== layerCfg.id) : [...prev, layerCfg.id]);
    if (!isActive && layerCfg.apiEndpoint && !phase4Data[layerCfg.id]) {
      await callPhase4Api(layerCfg);
    }
  };

  return (
    <div className="absolute inset-0 z-40 bg-mc-bg flex animate-in fade-in zoom-in-95 duration-500">

      {/* Map Container */}
      <div className="flex-1 relative h-full z-0">
        <MapContainer center={mapCenter} zoom={mapZoom} style={{ width: '100%', height: '100%' }} zoomControl={false}>
          <MapFlyController center={mapCenter} zoom={mapZoom} />

          {activeBase === 'Esri Satellite' && <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri World Imagery" maxNativeZoom={19} maxZoom={19} />}
          {activeBase === 'OpenStreetMap'  && <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OSM contributors" />}
          {activeBase === 'OpenTopoMap'    && <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"  attribution="&copy; OpenTopoMap" />}

          <MapSelectionManager isSelectionMode={isSelectionMode} bounds={bounds} setBounds={setBounds} setIsSelectionMode={setIsSelectionMode} />

          {activeLayers.includes('Fire Anomalies (FIRMS)') && (
            <WMSTileLayer url="https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi"
              layers="MODIS_Terra_Thermal_Anomalies_All" format="image/png" transparent={true} attribution="NASA EOSDIS GIBS" />
          )}
          {activeLayers.includes('Flood Inundation (SAR)') && (
            <Polygon positions={[[mapCenter[0]-0.05, mapCenter[1]-0.05],[mapCenter[0]+0.05, mapCenter[1]-0.02],[mapCenter[0]+0.02, mapCenter[1]+0.05],[mapCenter[0]-0.04, mapCenter[1]+0.03]]}
              pathOptions={{ color: '#0055ff', fillColor: '#0055ff', fillOpacity: 0.4 }} />
          )}
          {activeLayers.includes('Urban Sprawl') && (
            <Polygon positions={[[mapCenter[0]-0.02, mapCenter[1]-0.02],[mapCenter[0]+0.04, mapCenter[1]-0.02],[mapCenter[0]+0.04, mapCenter[1]+0.04],[mapCenter[0]-0.02, mapCenter[1]+0.02]]}
              pathOptions={{ color: '#a020f0', fillColor: '#a020f0', fillOpacity: 0.5, weight: 2 }} />
          )}
          {activeLayers.includes('Vegetation (EVI)') && (
            <CircleMarker center={mapCenter} radius={50}
              pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 0.2, weight: 2 }} />
          )}
        </MapContainer>
      </div>

      {/* Top Left Navigation Bar & Search Input */}
      <div className="absolute top-6 left-6 z-50 flex items-center gap-3">
        <button onClick={onBack}
          className="flex items-center gap-2 px-4 py-3 bg-mc-panel/90 backdrop-blur-md border border-mc-border text-mc-text font-mono text-xs rounded-xl shadow-2xl hover:bg-mc-border transition-colors">
          <ArrowLeft size={16} /> MISSION CONTROL
        </button>

        {/* Global Geocoder Search Input */}
        <form onSubmit={handleSearch} className="relative w-80">
          <Search className="absolute left-3.5 top-3 text-mc-primary" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search any location (e.g. New York City)..."
            className="w-full pl-10 pr-10 py-2.5 skeuo-input text-xs font-mono rounded-xl shadow-2xl"
          />
          <button type="submit" disabled={isSearching} className="absolute right-2 top-2 p-1 text-mc-muted hover:text-mc-primary transition-colors">
            {isSearching ? <Loader2 size={16} className="animate-spin text-mc-primary" /> : <Navigation size={14} />}
          </button>
        </form>
      </div>

      {/* Recommended Nearby Exploration Targets Panel (Left-bottom) */}
      <div className="absolute bottom-8 left-6 z-50 w-80 bg-mc-panel/90 backdrop-blur-md border border-mc-border rounded-xl p-4 shadow-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-mc-border/50 pb-2">
          <div className="flex items-center gap-2">
            <Compass className="text-mc-primary" size={16} />
            <h3 className="font-heading text-xs font-semibold text-mc-text tracking-wider uppercase">
              NEARBY EXPLORATION TARGETS
            </h3>
          </div>
          <span className="text-[10px] font-mono text-mc-muted">{currentPlaceName}</span>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {nearbyTargets.map((target, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectTarget(target)}
              className="w-full text-left p-2 rounded-lg bg-[#070a10] border border-mc-border/40 hover:border-mc-primary/60 transition-all flex items-center justify-between group"
            >
              <div>
                <p className="font-mono text-xs text-mc-text font-medium group-hover:text-mc-primary transition-colors">
                  {target.name}
                </p>
                <p className="text-[9px] text-mc-muted font-mono">{target.type.replace('_', ' ')}</p>
              </div>
              <div className="flex items-center gap-1 text-mc-secondary">
                {target.type === 'MACRO_VIEW' ? <ZoomOut size={14} title="Zoom out macro" /> : <ZoomIn size={14} title="Zoom in detail" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Layer Control Panel (Right-top) */}
      <div className="absolute top-6 right-6 z-50 w-80 bg-mc-panel/90 backdrop-blur-md border border-mc-border rounded-xl p-5 shadow-2xl">
        <div className="flex items-center gap-3 mb-5 border-b border-mc-border pb-4">
          <Layers className="text-mc-primary" size={22} />
          <h2 className="text-base font-heading font-semibold text-mc-text tracking-wider">{t('Map Layers')}</h2>
        </div>

        {/* Base Maps */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3 text-mc-muted">
            <MapIcon size={14} />
            <h3 className="font-mono text-[10px] uppercase tracking-widest">Base Maps</h3>
          </div>
          <div className="flex flex-col gap-1.5">
            {['Esri Satellite', 'OpenTopoMap', 'OpenStreetMap'].map(base => (
              <button key={base} onClick={() => setActiveBase(base)}
                className={`flex items-center justify-between p-2.5 rounded-lg border transition-all text-xs font-mono ${
                  activeBase === base
                    ? 'bg-mc-primary/20 border-mc-primary text-mc-text'
                    : 'bg-mc-bg/50 border-mc-border text-mc-muted hover:border-mc-primary/50 hover:text-mc-text'
                }`}>
                {base}
                {activeBase === base && <div className="w-2 h-2 rounded-full bg-mc-primary" />}
              </button>
            ))}
          </div>
        </div>

        {/* Overlays */}
        <div>
          <div className="flex items-center gap-2 mb-3 text-mc-muted">
            <Database size={14} />
            <h3 className="font-mono text-[10px] uppercase tracking-widest">Data Overlays</h3>
          </div>
          <div className="flex flex-col gap-2">
            {OVERLAY_CONFIG.map(layer => {
              const isActive  = activeLayers.includes(layer.id);
              const isLoading = loadingLayer === layer.id;
              const hasData   = phase4Data[layer.id] && !phase4Data[layer.id]?.error;
              const hasError  = !!phase4Data[layer.id]?.error;
              return (
                <div key={layer.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    isActive ? 'bg-mc-panel border-mc-border text-mc-text' : 'bg-transparent border-mc-border/50 text-mc-muted'
                  }`}>
                  <div>
                    <p className="font-mono text-xs font-semibold">{layer.id}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] uppercase tracking-widest text-mc-muted">{layer.type}</span>
                      {layer.apiEndpoint && <span className="text-[9px] font-mono text-mc-secondary">• PHASE 4</span>}
                      {hasData  && <span className="text-[9px] text-green-400">• LOADED</span>}
                      {hasError && <span className="text-[9px] text-red-400">• ERR</span>}
                    </div>
                  </div>
                  <button onClick={() => toggleLayer(layer)} disabled={isLoading}
                    className={`p-2 rounded-lg transition-colors ${isActive ? 'text-mc-primary' : 'text-mc-border hover:text-mc-text'}`}>
                    {isLoading ? <Loader2 size={15} className="animate-spin" /> : isActive ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Phase 4 Results Panel (Right-bottom) */}
      {Object.keys(phase4Data).length > 0 && (
        <div className="absolute bottom-24 right-6 z-50 w-80 bg-mc-panel/90 backdrop-blur-md border border-mc-border rounded-xl p-4 shadow-2xl space-y-3 max-h-52 overflow-y-auto">
          <h4 className="font-heading text-[10px] text-mc-text tracking-widest border-b border-mc-border/50 pb-2">PHASE 4 ANALYSIS</h4>
          {Object.entries(phase4Data).map(([layerId, data]) => (
            data?.error ? (
              <div key={layerId} className="flex items-start gap-2 text-red-400 text-xs font-mono">
                <AlertCircle size={11} className="mt-0.5 shrink-0" /> <span>{layerId}: {data.error}</span>
              </div>
            ) : (
              <div key={layerId} className="bg-[#0a0d13] rounded-lg p-3 space-y-1">
                <p className="text-mc-secondary text-[9px] font-mono uppercase tracking-widest">{layerId}</p>
                {data?.expansion_km2 !== undefined && (
                  <p className="text-mc-text text-xs font-mono">Urban expansion: <span className="text-mc-primary font-bold">{data.expansion_km2} km²</span></p>
                )}
                {data?.growth_classification && <p className="text-mc-muted text-[10px]">{data.growth_classification}</p>}
                {data?.evi_mean !== undefined && (
                  <p className="text-mc-text text-xs font-mono">EVI: <span className="text-green-400 font-bold">{data.evi_mean}</span></p>
                )}
                {data?.vegetation_density_class && <p className="text-mc-muted text-[10px]">{data.vegetation_density_class}</p>}
              </div>
            )
          ))}
        </div>
      )}

      {/* Drawing & Bounding Box Controls (Bottom Center) */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">
        {bounds && (
          <button onClick={handleAnalyze}
            className="skeuo-button-primary px-8 py-3 rounded-lg font-heading tracking-widest text-sm flex items-center gap-2 shadow-2xl animate-in slide-in-from-bottom-4">
            <Play size={14} fill="currentColor" /> ANALYZE SELECTED REGION
          </button>
        )}
        <button onClick={() => setIsSelectionMode(!isSelectionMode)}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-mono text-sm shadow-xl transition-all ${
            isSelectionMode
              ? 'bg-mc-primary text-mc-bg font-bold animate-pulse'
              : 'bg-mc-panel/90 backdrop-blur-md border border-mc-border text-mc-text hover:bg-mc-border'
          }`}>
          <Target size={14} />
          {isSelectionMode ? 'CLICK & DRAG ON MAP TO DRAW' : 'DRAW BOUNDING BOX'}
        </button>
      </div>
    </div>
  );
}
