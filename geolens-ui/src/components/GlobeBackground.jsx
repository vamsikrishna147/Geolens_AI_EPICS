import React, { useEffect, useRef, useState } from 'react';
import Globe from 'globe.gl';
import { useMission } from '../context/MissionContext';
import { Globe as GlobeIcon, Eye, EyeOff } from 'lucide-react';

const COUNTRY_SATELLITES = {
  "United States of America": [
    { name: 'Landsat-9', color: '#6CCB5F', alt: 0.22, offset: 0 },
    { name: 'MODIS-Terra', color: '#F4B942', alt: 0.25, offset: 120 },
    { name: 'VIIRS-NPP', color: '#FF5C5C', alt: 0.20, offset: 240 }
  ],
  "India": [
    { name: 'Cartosat-3', color: '#FF9933', alt: 0.15, offset: 0 },
    { name: 'RISAT-1A', color: '#FFFFFF', alt: 0.18, offset: 120 },
    { name: 'Oceansat-3', color: '#138808', alt: 0.2, offset: 240 }
  ],
  "France": [
    { name: 'Sentinel-1A', color: '#2F81F7', alt: 0.15, offset: 0 },
    { name: 'Sentinel-2B', color: '#38D9FF', alt: 0.18, offset: 180 }
  ],
  "China": [
    { name: 'Gaofen-7', color: '#FF0000', alt: 0.16, offset: 0 },
    { name: 'Yaogan-35', color: '#FFD700', alt: 0.20, offset: 180 }
  ],
  "Japan": [
    { name: 'ALOS-2', color: '#CCCCCC', alt: 0.17, offset: 0 },
    { name: 'Himawari-9', color: '#FF0000', alt: 0.30, offset: 180 }
  ],
  "Russia": [
    { name: 'Resurs-P', color: '#0033A0', alt: 0.18, offset: 0 },
    { name: 'Meteor-M', color: '#D52B1E', alt: 0.22, offset: 180 }
  ]
};

function generateOrbitArcs(satellites) {
  if (!satellites) return [];
  return satellites.map((sat) => {
    const points = [];
    for (let i = 0; i < 360; i += 4) {
      const rad = (i + sat.offset) * (Math.PI / 180);
      const tilt = 30 + Math.random() * 20; 
      points.push({
        lat: Math.sin(rad) * (90 - tilt),
        lng: (i + sat.offset) % 360 - 180,
      });
    }
    return {
      startLat: points[0].lat,
      startLng: points[0].lng,
      endLat: points[points.length - 1].lat,
      endLng: points[points.length - 1].lng,
      color: sat.color,
      name: sat.name,
      alt: sat.alt,
    };
  });
}

function generateSatellitePoints(satellites) {
  if (!satellites) return [];
  return satellites.map((sat) => {
    const rad = sat.offset * (Math.PI / 180);
    return {
      lat: Math.sin(rad) * 60,
      lng: sat.offset - 180,
      size: 1.2,
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
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [showEvents, setShowEvents] = useState(true);
  const { executeDirective } = useMission();
  const executeRef = useRef(executeDirective);

  useEffect(() => {
    executeRef.current = executeDirective;
  }, [executeDirective]);

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

      // Controls
      const controls = globe.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      controls.enableZoom = true;
      controls.enablePan = true;
      controls.minDistance = 120;
      controls.maxDistance = 600;

      // Fetch Country Polygons
      fetch('https://raw.githubusercontent.com/vasturiano/globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
        .then(res => res.json())
        .then(countries => {
          globe.polygonsData(countries.features)
            .polygonAltitude(0.01)
            .polygonCapColor(() => 'rgba(20, 20, 20, 0.2)')
            .polygonSideColor(() => 'rgba(0, 100, 255, 0.15)')
            .polygonStrokeColor(() => '#111')
            .onPolygonClick((polygon) => {
              const countryName = polygon.properties.ADMIN;
              setSelectedCountry(countryName);
            })
            .onPolygonHover(hoverD => {
              globe.polygonAltitude(d => d === hoverD ? 0.06 : 0.01)
                   .polygonCapColor(d => d === hoverD ? 'rgba(47, 129, 247, 0.4)' : 'rgba(20, 20, 20, 0.2)');
            });
        });

      // Fetch Live EONET Events
      fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=1000')
        .then(res => res.json())
        .then(data => {
           const events = data.events.map(ev => {
             if (!ev.geometry || !ev.geometry.length) return null;
             const coords = ev.geometry[0].coordinates; 
             // Geometry can be a Polygon (array of arrays) or Point (array of 2)
             const lng = Array.isArray(coords[0]) ? coords[0][0] : coords[0];
             const lat = Array.isArray(coords[0]) ? coords[0][1] : coords[1];
             if (typeof lng !== 'number' || typeof lat !== 'number') return null;

             const category = ev.categories[0]?.id || 'unknown';
             let color = '#FFCC00'; // Default Warning Yellow
             if (category === 'wildfires') color = '#FF3300';
             else if (category === 'volcanoes') color = '#FF9900';
             else if (category === 'severeStorms') color = '#00CCFF';
             else if (category === 'seaLakeIce') color = '#FFFFFF';

             return { lat, lng, title: ev.title, category, color };
           }).filter(Boolean);

           eventsData.current = events;
           
           globe
             .htmlElementsData(events)
             .htmlElement(d => {
                const el = document.createElement('div');
                el.innerHTML = `
                  <div class="relative flex items-center justify-center cursor-pointer group" style="width: 20px; height: 20px; pointer-events: auto;">
                    <div class="relative rounded-full w-2.5 h-2.5 border border-[#111] shadow-[0_0_5px_rgba(0,0,0,0.5)]" style="background-color: ${d.color};"></div>
                    <div class="absolute left-6 whitespace-nowrap bg-[#0a0d13]/90 text-mc-text font-mono text-[10px] px-2 py-1 rounded border border-mc-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl">
                      ${d.title}
                    </div>
                  </div>
                `;
                el.onclick = () => {
                  if (executeRef.current) {
                    executeRef.current(`Analyze the ${d.title} at coordinates ${d.lat.toFixed(4)}, ${d.lng.toFixed(4)}. Check severity, location, and potential regional impact.`);
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

  // Update satellites when a country is selected
  useEffect(() => {
    if (!globeInstance.current) return;
    
    const globe = globeInstance.current;
    
    if (selectedCountry && COUNTRY_SATELLITES[selectedCountry]) {
      const sats = COUNTRY_SATELLITES[selectedCountry];
      const orbitArcs = generateOrbitArcs(sats);
      const satPoints = generateSatellitePoints(sats);
      
      globe.arcsData(orbitArcs)
        .arcColor('color')
        .arcAltitude('alt')
        .arcStroke(0.3)
        .arcDashLength(0.4)
        .arcDashGap(0.2)
        .arcDashAnimateTime(() => Math.random() * 4000 + 2000);

      globe.pointsData(satPoints)
        .pointAltitude('alt')
        .pointColor('color')
        .pointRadius('size')
        .pointResolution(12)
        .labelsData(satPoints)
        .labelLat('lat')
        .labelLng('lng')
        .labelAltitude(d => d.alt + 0.03)
        .labelText('name')
        .labelSize(0.8)
        .labelColor('color')
        .labelDotRadius(0.4)
        .labelResolution(2);
        
      // Optionally stop auto-rotation so they can look at the country
      globe.controls().autoRotate = false;
    } else {
      // Clear satellites if country has none or clicked off
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
        style={{ backgroundColor: '#05070A' }}
      />
      
      {/* Toggle Button and Legend for Global Events */}
      <div className="absolute top-24 left-24 z-50 pointer-events-auto flex flex-col gap-2">
        <button 
          onClick={() => setShowEvents(!showEvents)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest border transition-all shadow-xl backdrop-blur-md ${
            showEvents 
            ? 'bg-mc-primary/20 border-mc-primary text-mc-text' 
            : 'bg-mc-panel/50 border-mc-border text-mc-muted hover:text-mc-text'
          }`}
        >
          <GlobeIcon size={14} />
          NASA EONET EVENTS
          {showEvents ? <Eye size={14} className="ml-2" /> : <EyeOff size={14} className="ml-2" />}
        </button>
        
        {showEvents && (
          <div className="bg-mc-panel/80 border border-mc-border rounded-lg p-3 backdrop-blur-md flex flex-col gap-2 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FF4500] shadow-[0_0_8px_#FF4500]"></div>
              <span className="font-mono text-[10px] text-mc-text tracking-widest">WILDFIRES / VOLCANOES</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#00FFFF] shadow-[0_0_8px_#00FFFF]"></div>
              <span className="font-mono text-[10px] text-mc-text tracking-widest">ICEBERGS / STORMS</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
