import React from 'react';
import { Flame, Waves, Mountain } from 'lucide-react';

export default function SatelliteData() {
  return (
    <div className="p-5 flex flex-col gap-5 h-full">
      <div className="flex items-center gap-2 border-b-2 border-borderColor pb-2 font-heading font-bold tracking-widest uppercase text-xl">
        <Satellite size={24}/> SATELLITE DATA ARCHIVE
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1">
        
        {/* FIRE DATA */}
        <div className="bg-black border-2 border-radarOrange p-5 shadow-[6px_6px_0px_#FF4500] hover:-translate-y-1 transition-transform flex flex-col justify-between">
          <div>
            <h2 className="font-heading text-2xl font-black text-radarOrange flex items-center gap-2 uppercase mb-4">
              <Flame size={28} /> Fire Anomaly (FIRMS)
            </h2>
            <p className="text-textMuted text-sm leading-relaxed font-mono">
              Access real-time active fire anomaly data from MODIS and VIIRS instruments. Essential for tracking rapid-onset thermal events.
            </p>
          </div>
          <button className="mt-5 w-full bg-radarOrange text-white border-2 border-black font-heading text-lg font-extrabold uppercase p-3 hover:bg-white hover:text-black transition-colors">
            BROWSE FIRE DATA
          </button>
        </div>

        {/* FLOOD DATA */}
        <div className="bg-black border-2 border-laserGreen p-5 shadow-[6px_6px_0px_#00FF00] hover:-translate-y-1 transition-transform flex flex-col justify-between">
          <div>
            <h2 className="font-heading text-2xl font-black text-laserGreen flex items-center gap-2 uppercase mb-4">
              <Waves size={28} /> Flood Extent (SAR)
            </h2>
            <p className="text-textMuted text-sm leading-relaxed font-mono">
              Access Sentinel-1 Synthetic Aperture Radar (SAR) water extent masks. Penetrates cloud cover to map inundation globally.
            </p>
          </div>
          <button className="mt-5 w-full bg-laserGreen text-black border-2 border-black font-heading text-lg font-extrabold uppercase p-3 hover:bg-white transition-colors">
            BROWSE FLOOD DATA
          </button>
        </div>

        {/* ELEVATION DATA */}
        <div className="bg-black border-2 border-[#00b8ff] p-5 shadow-[6px_6px_0px_#00b8ff] hover:-translate-y-1 transition-transform flex flex-col justify-between">
          <div>
            <h2 className="font-heading text-2xl font-black text-[#00b8ff] flex items-center gap-2 uppercase mb-4">
              <Mountain size={28} /> Elevation (DEM)
            </h2>
            <p className="text-textMuted text-sm leading-relaxed font-mono">
              Access Copernicus 30m Digital Elevation Models (DEM) for topographic analysis, slope calculation, and hydrologic routing.
            </p>
          </div>
          <button className="mt-5 w-full bg-[#00b8ff] text-black border-2 border-black font-heading text-lg font-extrabold uppercase p-3 hover:bg-white transition-colors">
            BROWSE DEM DATA
          </button>
        </div>

      </div>
    </div>
  );
}

// Ensure Satellite icon is imported if used in header
import { Satellite } from 'lucide-react';
