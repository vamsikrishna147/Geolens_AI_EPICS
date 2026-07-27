import React from 'react';

export default function Reports() {
  return (
    <div className="bg-bgPanel border-2 border-borderColor p-5 h-full flex flex-col">
      <div className="border-b-2 border-borderColor pb-2 mb-4 font-heading font-bold tracking-widest uppercase">
        ARCHIVED INTELLIGENCE REPORTS
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-black border border-borderColor p-4">
          <h4 className="font-heading text-radarOrange mb-2">0x9A4F - Konaseema Flood</h4>
          <p className="text-sm font-mono text-textMuted mb-4">Confidence: HIGH</p>
          <button className="border border-borderColor px-4 py-2 hover:bg-laserGreen hover:text-black uppercase font-mono text-sm">VIEW</button>
        </div>
        <div className="bg-black border border-borderColor p-4">
          <h4 className="font-heading text-radarOrange mb-2">0x8B22 - Amazon Deforest</h4>
          <p className="text-sm font-mono text-textMuted mb-4">Confidence: MED</p>
          <button className="border border-borderColor px-4 py-2 hover:bg-laserGreen hover:text-black uppercase font-mono text-sm">VIEW</button>
        </div>
      </div>
    </div>
  );
}
