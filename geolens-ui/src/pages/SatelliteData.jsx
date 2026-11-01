import React from 'react';
import { Flame, Waves, Mountain, Satellite, ExternalLink } from 'lucide-react';

export default function SatelliteData() {
  return (
    <div className="p-6 flex flex-col gap-5 h-full font-body">
      <div className="flex items-center justify-between border-b border-mc-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Satellite size={20} className="text-mc-primary" />
          <h2 className="font-heading font-bold tracking-widest uppercase text-sm text-mc-text">
            Satellite Data Catalog
          </h2>
        </div>
        <span className="text-xs font-mono text-mc-muted">GEE & NASA EOSDIS FEEDS</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1">
        
        {/* FIRE DATA */}
        <div className="skeuo-panel p-5 flex flex-col justify-between hover:border-mc-primary/60 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mb-4 text-orange-400">
              <Flame size={20} />
            </div>
            <h3 className="font-heading text-base font-semibold text-mc-text mb-2">
              Thermal Anomaly (FIRMS)
            </h3>
            <p className="text-mc-muted text-xs leading-relaxed font-body">
              Near-real-time active fire anomalies derived from MODIS (Terra/Aqua) and VIIRS (Suomi-NPP / NOAA-20) 375m imagery.
            </p>
          </div>
          <button className="mt-5 w-full skeuo-button font-mono text-xs uppercase py-2.5 flex items-center justify-center gap-2 hover:text-mc-primary transition-colors">
            <span>Query Fire Catalog</span>
            <ExternalLink size={13} />
          </button>
        </div>

        {/* FLOOD DATA */}
        <div className="skeuo-panel p-5 flex flex-col justify-between hover:border-mc-primary/60 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 text-emerald-400">
              <Waves size={20} />
            </div>
            <h3 className="font-heading text-base font-semibold text-mc-text mb-2">
              Flood Extent (Sentinel-1 SAR)
            </h3>
            <p className="text-mc-muted text-xs leading-relaxed font-body">
              All-weather C-band synthetic aperture radar surface water delineation. Penetrates cloud cover to identify active inundation extent.
            </p>
          </div>
          <button className="mt-5 w-full skeuo-button font-mono text-xs uppercase py-2.5 flex items-center justify-center gap-2 hover:text-mc-primary transition-colors">
            <span>Query Radar Masks</span>
            <ExternalLink size={13} />
          </button>
        </div>

        {/* ELEVATION DATA */}
        <div className="skeuo-panel p-5 flex flex-col justify-between hover:border-mc-primary/60 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mb-4 text-sky-400">
              <Mountain size={20} />
            </div>
            <h3 className="font-heading text-base font-semibold text-mc-text mb-2">
              Topography (Copernicus DEM)
            </h3>
            <p className="text-mc-muted text-xs leading-relaxed font-body">
              Copernicus GLO-30 Digital Elevation Models providing 30m global terrain height for watershed modeling and slope calculation.
            </p>
          </div>
          <button className="mt-5 w-full skeuo-button font-mono text-xs uppercase py-2.5 flex items-center justify-center gap-2 hover:text-mc-primary transition-colors">
            <span>Inspect DEM Layers</span>
            <ExternalLink size={13} />
          </button>
        </div>

      </div>
    </div>
  );
}
