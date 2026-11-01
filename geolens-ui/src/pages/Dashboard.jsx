import React, { useState } from 'react';
import { Terminal, Zap, Loader2 } from 'lucide-react';
import { useMission } from '../context/MissionContext';

export default function Dashboard() {
  const [query, setQuery] = useState('');
  const { isExecuting, logs, executeDirective } = useMission();
  
  const handleExecute = (e) => {
    e.preventDefault();
    if (!query.trim() || isExecuting) return;
    executeDirective(query);
  };

  const setMacro = (text) => setQuery(text);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 h-full p-4 font-body">
      <section className="flex flex-col gap-4 overflow-hidden">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Query Box */}
          <form onSubmit={handleExecute} className="flex-1 skeuo-panel p-5 flex flex-col gap-3">
            <div className="flex justify-between items-center border-b border-mc-border/60 pb-2 mb-1">
              <span className="font-heading font-semibold text-xs tracking-wider flex items-center gap-2 text-mc-text uppercase">
                <Terminal size={15} className="text-mc-primary" /> Command Input
              </span>
            </div>
            <textarea 
              className="skeuo-input p-3 h-28 text-sm focus:outline-none resize-none font-mono placeholder:text-mc-muted/50"
              placeholder="Enter geospatial intelligence query..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button 
              type="submit" 
              disabled={isExecuting}
              className="skeuo-button-primary font-mono text-xs uppercase py-3 px-4 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isExecuting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>EXECUTING PIPELINE...</span>
                </>
              ) : 'EXECUTE DIRECTIVE'}
            </button>
          </form>

          {/* Quick Actions */}
          <div className="w-full md:w-64 skeuo-panel p-5 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 border-b border-mc-border/60 pb-2 mb-1 font-heading font-semibold text-xs tracking-wider uppercase text-mc-text">
              <Zap size={15} className="text-mc-primary"/> Quick Directives
            </div>
            <button onClick={() => setMacro('Deploy emergency flood scan using Sentinel-1 SAR')} className="skeuo-button text-left p-2.5 text-xs font-mono transition-colors cursor-pointer">
              [+] FLOOD SCAN
            </button>
            <button onClick={() => setMacro('Calculate NDVI for agricultural anomaly detection')} className="skeuo-button text-left p-2.5 text-xs font-mono transition-colors cursor-pointer">
              [+] VEGETATION NDVI
            </button>
            <button onClick={() => setMacro('Detect thermal anomalies from MODIS/VIIRS fire detections')} className="skeuo-button text-left p-2.5 text-xs font-mono transition-colors cursor-pointer">
              [+] THERMAL SCAN
            </button>
          </div>
        </div>

        {/* Console output */}
        <div className="flex-1 skeuo-panel p-4 flex flex-col min-h-[220px]">
          <div className="text-xs font-mono text-mc-muted uppercase tracking-wider mb-2 border-b border-mc-border/50 pb-1">
            Telemetry Stream
          </div>
          <div className="flex-1 bg-mc-bg rounded-lg p-3 font-mono text-xs overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <div className="text-mc-muted/60 text-xs">Waiting for mission directive...</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="text-mc-text/90">
                  <span className="text-mc-muted/60 mr-2">[{new Date().toLocaleTimeString([], {hour12:false})}]</span>
                  <span className={log.includes('CRITICAL') ? 'text-mc-danger' : ''}>{log.replace(/^>\s*/, '')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
