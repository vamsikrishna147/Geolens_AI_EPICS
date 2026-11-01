import React from 'react';
import { FileText, ShieldAlert } from 'lucide-react';

export default function Reports() {
  return (
    <div className="skeuo-panel p-6 h-full flex flex-col font-body">
      <div className="border-b border-mc-border/60 pb-3 mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-mc-primary" />
          <h2 className="font-heading font-bold text-sm tracking-widest uppercase text-mc-text">
            Archived Intelligence Reports
          </h2>
        </div>
        <span className="text-xs font-mono text-mc-muted">2 RECORDS FOUND</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-mc-bg border border-mc-border rounded-xl p-4 flex flex-col justify-between hover:border-mc-primary/60 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-mc-muted uppercase">0x9A4F</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-red-500/10 text-red-400 border border-red-500/30">HIGH</span>
            </div>
            <h4 className="font-heading font-semibold text-mc-text text-sm mb-1">Konaseema Inundation Assessment</h4>
            <p className="text-xs font-body text-mc-muted leading-relaxed">
              Multi-temporal SAR water delineation mapping localized flooding along Godavari delta channels.
            </p>
          </div>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('show-report'))}
            className="mt-4 skeuo-button text-xs font-mono py-2 px-3 text-center uppercase tracking-wider hover:text-mc-primary"
          >
            Open Report →
          </button>
        </div>

        <div className="bg-mc-bg border border-mc-border rounded-xl p-4 flex flex-col justify-between hover:border-mc-primary/60 transition-colors">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-mc-muted uppercase">0x8B22</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">MEDIUM</span>
            </div>
            <h4 className="font-heading font-semibold text-mc-text text-sm mb-1">Amazon Canopy Depletion</h4>
            <p className="text-xs font-body text-mc-muted leading-relaxed">
              Optical NDVI vegetation degradation monitoring across southern Pará logging corridors.
            </p>
          </div>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('show-report'))}
            className="mt-4 skeuo-button text-xs font-mono py-2 px-3 text-center uppercase tracking-wider hover:text-mc-primary"
          >
            Open Report →
          </button>
        </div>
      </div>
    </div>
  );
}
