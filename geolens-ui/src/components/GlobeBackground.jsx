import React, { useEffect, useRef, useState, useMemo } from 'react';
import Globe from 'globe.gl';
import { useMission } from '../context/MissionContext';
import { 
  Globe as GlobeIcon, Eye, EyeOff, Satellite, X, 
  Search, Flame, CloudRain, Waves, Compass, FileText, Play, ChevronRight, Filter, ExternalLink
} from 'lucide-react';

const COUNTRY_SATELLITES = {
  "United States of America": [
    { name: 'Landsat-9', color: '#10B981', alt: 0.22, offset: 0 },
    { name: 'MODIS-Terra', color: '#F59E0B', alt: 0.25, offset: 120 },
    { name: 'VIIRS-Suomi', color: '#EF4444', alt: 0.20, offset: 240 }
  ],
  "United States": [
    { name: 'Landsat-9', color: '#10B981', alt: 0.22, offset: 0 },
    { name: 'MODIS-Terra', color: '#F59E0B', alt: 0.25, offset: 120 },
    { name: 'VIIRS-Suomi', color: '#EF4444', alt: 0.20, offset: 240 }
  ],
  "India": [
    { name: 'Cartosat-3', color: '#F97316', alt: 0.16, offset: 0 },
    { name: 'RISAT-1A (EOS-04)', color: '#3B82F6', alt: 0.20, offset: 120 },
    { name: 'Oceansat-3 (EOS-06)', color: '#10B981', alt: 0.24, offset: 240 }
  ],
  "France": [
    { name: 'Sentinel-1A (Radar)', color: '#3B82F6', alt: 0.18, offset: 0 },
    { name: 'Sentinel-2B (Optical)', color: '#06B6D4', alt: 0.22, offset: 180 },
    { name: 'SPOT-7', color: '#8B5CF6', alt: 0.25, offset: 90 }
  ],
  "China": [
    { name: 'Gaofen-7', color: '#EF4444', alt: 0.17, offset: 0 },
    { name: 'Yaogan-35', color: '#F59E0B', alt: 0.21, offset: 180 },
    { name: 'Fengyun-4B', color: '#EC4899', alt: 0.28, offset: 90 }
  ],
  "Japan": [
    { name: 'ALOS-2 (PALSAR)', color: '#E2E8F0', alt: 0.18, offset: 0 },
    { name: 'Himawari-9', color: '#EF4444', alt: 0.32, offset: 180 }
  ],
  "Russia": [
    { name: 'Resurs-P', color: '#3B82F6', alt: 0.19, offset: 0 },
    { name: 'Meteor-M', color: '#EF4444', alt: 0.23, offset: 180 }
  ],
  "Germany": [
    { name: 'TerraSAR-X', color: '#3B82F6', alt: 0.19, offset: 30 },
    { name: 'EnMAP (Hyperspectral)', color: '#10B981', alt: 0.23, offset: 210 }
  ],
  "United Kingdom": [
    { name: 'NovaSAR-1', color: '#8B5CF6', alt: 0.18, offset: 45 },
    { name: 'Carbonite-2', color: '#F59E0B', alt: 0.22, offset: 225 }
  ],
  "Canada": [
    { name: 'RADARSAT Constellation-1', color: '#EF4444', alt: 0.19, offset: 60 },
    { name: 'RADARSAT Constellation-2', color: '#3B82F6', alt: 0.22, offset: 240 }
  ],
  "Brazil": [
    { name: 'Amazonia-1', color: '#10B981', alt: 0.20, offset: 15 },
    { name: 'CBERS-4A', color: '#F59E0B', alt: 0.24, offset: 195 }
  ],
  "Australia": [
    { name: 'SpIRIT (Nanosat)', color: '#F97316', alt: 0.17, offset: 80 }
  ],
  "Israel": [
    { name: 'Ofeq-16', color: '#3B82F6', alt: 0.18, offset: 110 }
  ],
  "Italy": [
    { name: 'COSMO-SkyMed-2', color: '#06B6D4', alt: 0.21, offset: 135 },
    { name: 'PRISMA (Hyperspectral)', color: '#10B981', alt: 0.24, offset: 315 }
  ]
};

function generateOrbitArcs(satellites) {
  if (!satellites) return [];
  const arcs = [];
  satellites.forEach((sat, sIdx) => {
    const tilt = 35 + (sIdx * 15) % 40;
    const baseLng = sat.offset || 0;
    arcs.push({
      startLat: -tilt,
      startLng: (baseLng - 90 + 360) % 360 - 180,
      endLat: tilt,
      endLng: baseLng % 360 - 180,
      color: sat.color,
      name: sat.name,
      alt: sat.alt
    });
    arcs.push({
      startLat: tilt,
      startLng: baseLng % 360 - 180,
      endLat: -tilt,
      endLng: (baseLng + 90) % 360 - 180,
      color: sat.color,
      name: sat.name,
      alt: sat.alt
    });
  });
  return arcs;
}

function generateSatellitePoints(satellites, countryLat = 20, countryLng = 78) {
  if (!satellites) return [];
  return satellites.map((sat, idx) => {
    const angle = (idx * (360 / satellites.length) + (sat.offset || 0)) * (Math.PI / 180);
    const spread = 20 + idx * 10;
    return {
      lat: Math.max(-75, Math.min(75, countryLat + Math.sin(angle) * spread)),
      lng: ((countryLng + Math.cos(angle) * spread + 180) % 360) - 180,
      size: 1.4,
      color: sat.color,
      name: sat.name,
      alt: sat.alt + 0.02,
    };
  });
}

export default function GlobeBackground() {
  const globeEl = useRef(null);
  const globeInstance = useRef(null);
  const eventsData = useRef([]);
  const [eventsCount, setEventsCount] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const selectedCountryRef = useRef(null);
  const [showEvents, setShowEvents] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const selectedEventRef = useRef(null);
  const setSelectedEventRef = useRef(null);
  const [eonetSearch, setEonetSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showEventDrawer, setShowEventDrawer] = useState(false);
  const [allEvents, setAllEvents] = useState([]);
  const { executeDirective } = useMission();
  const executeRef = useRef(executeDirective);

  useEffect(() => {
    executeRef.current = executeDirective;
    setSelectedEventRef.current = setSelectedEvent;
  }, [executeDirective]);

  useEffect(() => {
    selectedEventRef.current = selectedEvent;
  }, [selectedEvent]);

  const handleLaunchReport = (ev) => {
    if (!ev) return;
    if (executeRef.current) {
      executeRef.current(`Emergency disaster assessment for ${ev.title} at coordinates ${ev.lat.toFixed(4)}, ${ev.lng.toFixed(4)}. Check severity, affected area in km², and immediate risk.`);
    }
  };

  const handleOpenTimeLens = (ev) => {
    if (!ev) return;
    try {
      const currentYear = new Date().getFullYear();
      sessionStorage.setItem('geolens_timelens_search', `${ev.title} (${ev.lat.toFixed(4)}, ${ev.lng.toFixed(4)})`);
      sessionStorage.setItem('geolens_timelens_year_before', String(currentYear - 2));
      sessionStorage.setItem('geolens_timelens_year_after', String(currentYear));
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('show-timelens'));
  };

  const handleFlyToEvent = (ev) => {
    setSelectedEvent(ev);
    if (globeInstance.current) {
      globeInstance.current.pointOfView({ lat: ev.lat, lng: ev.lng, altitude: 0.65 }, 1200);
    }
  };

  const filteredEvents = useMemo(() => {
    return allEvents.filter(ev => {
      const matchCat = categoryFilter === 'all' || ev.category.toLowerCase() === categoryFilter.toLowerCase();
      const matchSearch = !eonetSearch.trim() || ev.title.toLowerCase().includes(eonetSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allEvents, categoryFilter, eonetSearch]);

  // Keep selectedCountryRef in sync
  useEffect(() => {
    selectedCountryRef.current = selectedCountry;
    if (globeInstance.current && globeInstance.current.polygonsData().length > 0) {
      // Re-evaluate polygon styles to update active glow and altitude immediately
      globeInstance.current
        .polygonAltitude(globeInstance.current.polygonAltitude())
        .polygonCapColor(globeInstance.current.polygonCapColor())
        .polygonSideColor(globeInstance.current.polygonSideColor());
    }
  }, [selectedCountry]);

  // Toggle NASA EONET events dynamically
  useEffect(() => {
    if (globeInstance.current) {
      globeInstance.current.htmlElementsData(showEvents ? eventsData.current : []);
    }
  }, [showEvents]);

  useEffect(() => {
    if (!globeEl.current) return;

    try {
      const globe = Globe()(globeEl.current)
        .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
        .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
        .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
        .showAtmosphere(true)
        .atmosphereColor('#1a3a5c')
        .atmosphereAltitude(0.2)
        .pointOfView({ lat: 20, lng: 78, altitude: 2.2 }, 0);

      globeInstance.current = globe;
      window.__globe = globe;

      // Controls
      const controls = globe.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      controls.enableZoom = true;
      controls.enablePan = true;
      controls.minDistance = 120;
      controls.maxDistance = 600;

      // ── 1. Fetch Country Polygons (Clean Crisp Elevation) ──────────────
      fetch('/data/countries.geojson')
        .then(res => res.json())
        .then(countries => {
          if (!countries?.features) return;
          globe
            .polygonsData(countries.features)
            .polygonAltitude(d => {
              const name = d.properties?.ADMIN || d.properties?.NAME;
              if (selectedCountryRef.current && name === selectedCountryRef.current) {
                return 0.05; // Raised when selected
              }
              return 0.005;
            })
            .polygonCapColor(d => {
              const name = d.properties?.ADMIN || d.properties?.NAME;
              if (selectedCountryRef.current && name === selectedCountryRef.current) {
                return 'rgba(217, 119, 6, 0.35)'; // Solid amber fill
              }
              return 'rgba(24, 24, 27, 0.04)'; // Stealth subtle
            })
            .polygonSideColor(d => {
              const name = d.properties?.ADMIN || d.properties?.NAME;
              if (selectedCountryRef.current && name === selectedCountryRef.current) {
                return 'rgba(217, 119, 6, 0.5)';
              }
              return 'rgba(217, 119, 6, 0.12)';
            })
            .polygonStrokeColor(() => 'rgba(217, 119, 6, 0.35)')
            .onPolygonClick((polygon) => {
              const countryName = polygon?.properties?.ADMIN || polygon?.properties?.NAME;
              if (countryName) {
                setSelectedCountry(prev => prev === countryName ? null : countryName);
              }
            })
            .onPolygonHover(hoverD => {
              globe
                .polygonAltitude(d => {
                  if (d === hoverD) return 0.04; // Crisp elevation on hover
                  const name = d.properties?.ADMIN || d.properties?.NAME;
                  if (selectedCountryRef.current && name === selectedCountryRef.current) {
                    return 0.05;
                  }
                  return 0.005;
                })
                .polygonCapColor(d => {
                  if (d === hoverD) return 'rgba(217, 119, 6, 0.3)'; // Solid hover color, no glow
                  const name = d.properties?.ADMIN || d.properties?.NAME;
                  if (selectedCountryRef.current && name === selectedCountryRef.current) {
                    return 'rgba(217, 119, 6, 0.35)';
                  }
                  return 'rgba(24, 24, 27, 0.04)';
                })
                .polygonSideColor(d => {
                  if (d === hoverD) return 'rgba(217, 119, 6, 0.45)';
                  const name = d.properties?.ADMIN || d.properties?.NAME;
                  if (selectedCountryRef.current && name === selectedCountryRef.current) {
                    return 'rgba(217, 119, 6, 0.5)';
                  }
                  return 'rgba(217, 119, 6, 0.12)';
                });
            });
        })
        .catch(err => console.warn('Country polygons failed to load:', err));

      // ── 2. Fetch Live NASA EONET Events (Crisp Solid Dots, Zero Glow) ────
      fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=500')
        .then(res => res.json())
        .then(data => {
          if (!data?.events) return;
          const rawEvents = data.events.map(ev => {
            try {
              if (!ev?.geometry?.length) return null;
              const geom = ev.geometry[ev.geometry.length - 1];
              const coords = geom.coordinates;
              if (!coords) return null;
              const lng = Array.isArray(coords[0]) ? coords[0][0] : coords[0];
              const lat = Array.isArray(coords[0]) ? coords[0][1] : coords[1];
              if (typeof lng !== 'number' || typeof lat !== 'number') return null;

              const category = ev.categories?.[0]?.id || 'unknown';
              let color = '#F59E0B'; // Amber default
              if (category === 'wildfires') color = '#EF4444'; // Red
              if (category === 'severeStorms') color = '#06B6D4'; // Cyan
              if (category === 'floods') color = '#3B82F6'; // Blue
              if (category === 'volcanoes') color = '#F97316'; // Orange
              if (category === 'seaLakeIce') color = '#E2E8F0'; // Ice white

              return { id: ev.id, title: ev.title, lat, lng, color, category };
            } catch { return null; }
          }).filter(Boolean);

          // Spatial deduplication: prevent dense clustering into blurry blobs
          const seenGrid = new Set();
          const events = [];
          for (const ev of rawEvents) {
            // Bucket to ~1.2 degrees (~130 km) grid to ensure distinct, clean markers
            const gridKey = `${ev.category}_${Math.round(ev.lat / 1.2)}_${Math.round(ev.lng / 1.2)}`;
            if (!seenGrid.has(gridKey)) {
              seenGrid.add(gridKey);
              events.push(ev);
            }
            if (events.length >= 120) break;
          }

          eventsData.current = events;
          setEventsCount(events.length);
          setAllEvents(events);

          globe
            .htmlElementsData(showEvents ? events : [])
            .htmlElement(d => {
              const el = document.createElement('div');
              el.className = 'eonet-marker group relative cursor-pointer';
              el.style.width = '12px';
              el.style.height = '12px';
              el.style.display = 'flex';
              el.style.alignItems = 'center';
              el.style.justifyContent = 'center';
              el.style.pointerEvents = 'auto';

              // Clean solid dot — ZERO glow, crisp border
              el.innerHTML = `
                <div style="width: 5.5px; height: 5.5px; border-radius: 50%; background-color: ${d.color}; border: 1px solid rgba(0,0,0,0.8); transition: transform 0.15s ease;" class="group-hover:scale-150"></div>
                <div class="absolute left-4 whitespace-nowrap bg-mc-panel text-mc-text font-mono text-[10px] px-2.5 py-1 rounded-md border border-mc-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                  ${d.title}
                </div>
              `;
              el.onclick = () => {
                if (selectedEventRef.current && selectedEventRef.current.id === d.id) {
                  // already selected
                } else if (setSelectedEventRef.current) {
                  setSelectedEventRef.current(d);
                }
                if (globeInstance.current) {
                  globeInstance.current.pointOfView({ lat: d.lat, lng: d.lng, altitude: 0.65 }, 1000);
                }
              };
              return el;
            });
        })
        .catch(err => console.error("Failed to fetch EONET data", err));

      // Resize
      const handleResize = () => {
        if (globeInstance.current) {
          globeInstance.current.width(window.innerWidth);
          globeInstance.current.height(window.innerHeight);
        }
      };
      handleResize();
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        if (globeInstance.current && globeInstance.current._destructor) {
          globeInstance.current._destructor();
        }
      };
    } catch (err) {
      console.error("Globe.gl rendering error:", err);
    }
  }, []);

  // ── 3. Deployed Satellite Constellation when a Country is Selected ─────
  useEffect(() => {
    if (!globeInstance.current) return;
    const globe = globeInstance.current;

    if (selectedCountry) {
      const sats = COUNTRY_SATELLITES[selectedCountry] || [
        { name: `${selectedCountry.split(' ')[0]}-EO-1 (Optical)`, color: '#F59E0B', alt: 0.18, offset: 0 },
        { name: `${selectedCountry.split(' ')[0]}-SAR-2 (Radar)`, color: '#3B82F6', alt: 0.22, offset: 180 },
        { name: `${selectedCountry.split(' ')[0]}-Met-3 (Weather)`, color: '#10B981', alt: 0.28, offset: 90 },
      ];

      const orbitArcs = generateOrbitArcs(sats);
      const satPoints = generateSatellitePoints(sats);

      globe.arcsData(orbitArcs)
        .arcColor('color')
        .arcAltitude('alt')
        .arcStroke(0.35)
        .arcDashLength(0.4)
        .arcDashGap(0.2)
        .arcDashAnimateTime(() => Math.random() * 3000 + 2000);

      globe.pointsData(satPoints)
        .pointAltitude('alt')
        .pointColor('color')
        .pointRadius('size')
        .pointResolution(16)
        .labelsData(satPoints)
        .labelLat('lat')
        .labelLng('lng')
        .labelAltitude(d => d.alt + 0.03)
        .labelText('name')
        .labelSize(0.85)
        .labelColor('color')
        .labelDotRadius(0.4)
        .labelResolution(2);

      globe.controls().autoRotate = false;
    } else {
      globe.arcsData([]);
      globe.pointsData([]);
      globe.labelsData([]);
      globe.controls().autoRotate = true;
    }
  }, [selectedCountry]);

  return (
    <>
      <div
        ref={globeEl}
        className="absolute top-0 left-0 w-full h-full z-0 cursor-crosshair"
        style={{ backgroundColor: 'var(--color-mc-bg)' }}
      />

      {/* ── Top-Left HUD: NASA EONET Realtime Event Monitor & Fleet Drawer ── */}
      <div className="absolute top-20 left-20 z-50 pointer-events-auto flex flex-col gap-2.5 max-w-md w-80 sm:w-96 select-none">
        
        {/* Toggle Button & Crisis Drawer Trigger */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowEvents(!showEvents)}
            className={`flex-1 flex items-center justify-between px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest border transition-all cursor-pointer shadow-sm ${
              showEvents
                ? 'bg-mc-panel border-mc-primary/40 text-mc-primary'
                : 'bg-mc-panel/80 border-mc-border text-mc-muted hover:text-mc-text'
            }`}
            title="Toggle active NASA Earth Observatory natural event markers"
          >
            <div className="flex items-center gap-2">
              <GlobeIcon size={14} className="text-mc-primary" />
              <span>NASA EONET EVENTS {eventsCount > 0 ? `(${eventsCount})` : ''}</span>
            </div>
            {showEvents ? <Eye size={14} className="text-mc-primary" /> : <EyeOff size={14} className="text-mc-muted" />}
          </button>

          {showEvents && (
            <button
              onClick={() => setShowEventDrawer(d => !d)}
              className={`px-3 py-2 rounded-lg font-mono text-[10px] font-bold border transition-all cursor-pointer shadow-sm flex items-center gap-1 ${
                showEventDrawer
                  ? 'bg-mc-primary text-black border-mc-primary'
                  : 'bg-mc-panel border-mc-border text-mc-muted hover:text-white'
              }`}
              title="Open Fast Disaster Search & Crisis Feed"
            >
              <Search size={12} />
              <span>FEED</span>
            </button>
          )}
        </div>

        {/* ── 1. ACTIVE SELECTED DISASTER INCIDENT CARD (1-Click Action) ── */}
        {selectedEvent && (
          <div className="bg-mc-panel/95 backdrop-blur-md border-2 border-red-500/60 rounded-xl p-3.5 shadow-2xl font-mono text-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start justify-between gap-2 border-b border-mc-border/60 pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedEvent.color }} />
                <span className="text-[10px] font-bold tracking-widest uppercase text-red-400">
                  CRITICAL EVENT SELECTED
                </span>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-mc-muted hover:text-white p-0.5 rounded cursor-pointer transition-colors"
                title="Deselect event"
              >
                <X size={14} />
              </button>
            </div>

            <div className="font-heading font-bold text-sm text-white leading-snug">
              {selectedEvent.title}
            </div>

            <div className="flex items-center gap-3 text-[10px] text-mc-muted mt-1.5 mb-3">
              <span className="px-1.5 py-0.5 rounded bg-mc-bg border border-mc-border uppercase">
                {selectedEvent.category}
              </span>
              <span>{selectedEvent.lat.toFixed(4)}°, {selectedEvent.lng.toFixed(4)}°</span>
            </div>

            {/* 1-Click Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-mc-border/40">
              <button
                onClick={() => handleLaunchReport(selectedEvent)}
                className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-[10px] tracking-wider uppercase flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-md"
                title="Launch 5-agent mission assessment report immediately"
              >
                <FileText size={13} />
                <span>1-CLICK REPORT</span>
              </button>
              <button
                onClick={() => handleOpenTimeLens(selectedEvent)}
                className="flex-1 px-3 py-2 bg-mc-panel hover:bg-mc-primary hover:text-black text-mc-primary border border-mc-primary/40 font-bold rounded-lg text-[10px] tracking-wider uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                title="Inspect this coordinate in TimeLens satellite imagery"
              >
                <Satellite size={13} />
                <span>TIMELENS</span>
              </button>
            </div>
          </div>
        )}

        {/* ── 2. REALTIME DISASTER FEED & FAST SEARCH DRAWER ── */}
        {showEvents && showEventDrawer && (
          <div className="bg-mc-panel/95 backdrop-blur-md border border-mc-border rounded-xl p-3 flex flex-col gap-2.5 shadow-2xl animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-mc-muted border-b border-mc-border/50 pb-1.5">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Flame size={12} className="text-red-400" /> LIVE DISASTER FEED
              </span>
              <span className="text-mc-primary font-bold">{filteredEvents.length} Active</span>
            </div>

            {/* Fast Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-mc-muted" />
              <input
                type="text"
                value={eonetSearch}
                onChange={e => setEonetSearch(e.target.value)}
                placeholder="Fast search events (e.g. fire, storm, flood)..."
                className="w-full pl-8 pr-7 py-1.5 bg-mc-bg/90 border border-mc-border rounded-lg text-xs font-mono text-mc-text outline-none focus:border-mc-primary placeholder:text-mc-muted/60"
              />
              {eonetSearch && (
                <button
                  onClick={() => setEonetSearch('')}
                  className="absolute right-2 top-2 text-mc-muted hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap gap-1">
              {[
                { id: 'all', label: 'ALL' },
                { id: 'wildfires', label: '🔥 Wildfire' },
                { id: 'severeStorms', label: '🌀 Storm' },
                { id: 'floods', label: '🌊 Flood' },
                { id: 'volcanoes', label: '🌋 Volcano' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase transition-all cursor-pointer ${
                    categoryFilter === cat.id
                      ? 'bg-mc-primary text-black font-bold'
                      : 'bg-mc-bg text-mc-muted hover:text-white border border-mc-border/60'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Scrollable Event List */}
            <div className="max-h-52 overflow-y-auto divide-y divide-mc-border/20 pr-1">
              {filteredEvents.length === 0 ? (
                <div className="py-4 text-center text-xs font-mono text-mc-muted">
                  No active events match "{eonetSearch}"
                </div>
              ) : (
                filteredEvents.map(ev => (
                  <div
                    key={ev.id}
                    className="py-1.5 px-1.5 hover:bg-mc-bg/60 rounded-lg transition-colors group flex items-center justify-between gap-2"
                  >
                    <div
                      onClick={() => handleFlyToEvent(ev)}
                      className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                      title="Click to fly camera to this event"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-mono font-bold text-mc-text truncate group-hover:text-mc-primary">
                          {ev.title}
                        </p>
                        <p className="text-[9px] font-mono text-mc-muted">
                          {ev.lat.toFixed(2)}°, {ev.lng.toFixed(2)}°
                        </p>
                      </div>
                    </div>

                    {/* Inline Quick Action Buttons */}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 shrink-0">
                      <button
                        onClick={() => handleLaunchReport(ev)}
                        className="px-1.5 py-1 rounded bg-red-950/70 hover:bg-red-900 border border-red-500/40 text-red-300 text-[9px] font-mono font-bold flex items-center gap-0.5 cursor-pointer"
                        title="1-Click Assessment Report"
                      >
                        <FileText size={10} />
                        <span>RPT</span>
                      </button>
                      <button
                        onClick={() => handleOpenTimeLens(ev)}
                        className="px-1.5 py-1 rounded bg-mc-panel hover:bg-mc-primary hover:text-black border border-mc-border text-mc-muted text-[9px] font-mono flex items-center gap-0.5 cursor-pointer"
                        title="Open in TimeLens"
                      >
                        <Satellite size={10} />
                        <span>TL</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── 3. NASA EONET LEGEND (Compact) ── */}
        {showEvents && !showEventDrawer && !selectedEvent && (
          <div className="bg-mc-panel/95 backdrop-blur-md border border-mc-border rounded-xl p-3 flex flex-col gap-1.5 shadow-lg animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-wider text-mc-muted border-b border-mc-border/50 pb-1 mb-0.5">
              <span>Live Natural Events</span>
              <span className="text-mc-primary">NASA GSFC</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-mc-text">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
                <span className="truncate">Wildfires</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#06B6D4]" />
                <span className="truncate">Cyclones</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                <span className="truncate">Floods</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#F97316]" />
                <span className="truncate">Volcanoes</span>
              </div>
            </div>
          </div>
        )}

        {/* Selected Country Satellite Fleet HUD Card */}
        {selectedCountry && (
          <div className="bg-mc-panel/95 backdrop-blur-md border border-mc-primary/40 rounded-xl p-3.5 shadow-xl font-mono text-xs animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] text-mc-primary font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <Satellite size={13} /> DEPLOYED SATELLITE FLEET
                </div>
                <div className="font-heading font-bold text-sm text-mc-text mt-0.5">
                  {selectedCountry}
                </div>
              </div>
              <button
                onClick={() => setSelectedCountry(null)}
                className="p-1 rounded-lg hover:bg-mc-border/50 text-mc-muted hover:text-white cursor-pointer transition-colors"
                title="Deselect country and clear orbits"
              >
                <X size={14} />
              </button>
            </div>

            <div className="text-[11px] text-mc-muted mt-2 flex flex-wrap gap-1.5">
              {(COUNTRY_SATELLITES[selectedCountry] || [
                { name: `${selectedCountry.split(' ')[0]}-EO-1 (Optical)`, color: '#F59E0B' },
                { name: `${selectedCountry.split(' ')[0]}-SAR-2 (Radar)`, color: '#3B82F6' },
                { name: `${selectedCountry.split(' ')[0]}-Met-3 (Weather)`, color: '#10B981' }
              ]).map(s => (
                <span
                  key={s.name}
                  className="px-2 py-0.5 rounded-md bg-mc-bg border border-mc-border text-mc-text text-[10px] flex items-center gap-1.5 shadow-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
              ))}
            </div>
            <div className="text-[9px] text-mc-muted/70 mt-2 font-mono">
              Click globe background or ✕ to resume rotation
            </div>
          </div>
        )}
      </div>
    </>
  );
}
