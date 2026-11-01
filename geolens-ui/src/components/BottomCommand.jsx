import React, { useState } from 'react';
import { Loader2, X, ChevronUp, Maximize2, Minimize2, Layers } from 'lucide-react';
import { useMission } from '../context/MissionContext';
import { useLanguage } from '../context/LanguageContext';

export default function BottomCommand() {
  const [query, setQuery] = useState('');
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const { isExecuting, logs, executeDirective } = useMission();
  const { t } = useLanguage();

  const [showImageryModal, setShowImageryModal] = useState(false);

  React.useEffect(() => {
    if (isExecuting) setIsLogOpen(true);
  }, [isExecuting]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim() || isExecuting) return;
    executeDirective(query);
    setQuery('');
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 mb-1 relative z-50">
      
      {/* Minimized Log Bar */}
      {logs.length > 0 && !isLogOpen && (
        <div className="flex justify-center -mb-2 z-10">
          <button onClick={() => setIsLogOpen(true)} className="bg-mc-panel/90 backdrop-blur-sm px-5 py-1.5 rounded-t-xl rounded-b-none border border-mc-border border-b-0 flex items-center gap-2 hover:bg-mc-panel transition-colors cursor-pointer shadow-sm">
             <span className="w-1.5 h-1.5 rounded-full bg-mc-primary" />
             <span className="text-[10px] font-mono font-bold text-mc-text tracking-widest uppercase">{t('Mission Log')}</span>
             <ChevronUp size={14} className="text-mc-muted" />
          </button>
        </div>
      )}

      {/* Chatbot Output Area */}
      {logs.length > 0 && isLogOpen && (
        <div className={`bg-mc-panel/95 backdrop-blur-md flex flex-col font-mono text-[13px] border border-mc-border rounded-xl relative shadow-lg transition-all duration-200 border-t-2 border-t-mc-primary/60 ${isExpanded ? 'h-[55vh] max-h-[700px]' : 'max-h-56'}`}>
          <div className="px-4 py-2.5 bg-mc-panel border-b border-mc-border/60 flex items-center justify-between rounded-t-xl shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-mc-primary" />
              <span className="text-xs font-mono font-bold text-mc-primary tracking-widest uppercase">{t('Mission Log')}</span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsExpanded(!isExpanded)} 
                aria-label={isExpanded ? "Collapse Log" : "Expand Log"}
                className="text-mc-muted hover:text-mc-text p-1.5 rounded-lg transition-colors bg-mc-bg hover:bg-mc-border/30 cursor-pointer"
              >
                {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
              </button>
              <button 
                onClick={() => setIsLogOpen(false)} 
                aria-label="Close Mission Log"
                className="text-mc-muted hover:text-mc-danger p-1.5 rounded-lg transition-colors bg-mc-bg hover:bg-mc-border/30 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          </div>
          <div className="p-3 flex-1 overflow-auto flex flex-col gap-1.5 bg-mc-bg">
            {logs.map((log, i) => {
              const isError = log.includes('CRITICAL') || log.includes('Failed') || log.includes('SERVER OFFLINE');
              return (
                 <div key={i} className={`flex items-baseline gap-2 leading-relaxed text-[11px] font-mono ${isError ? 'text-mc-danger bg-mc-danger/10 px-2 py-1 rounded' : 'text-mc-text'}`}>
                    <span className="select-none text-[10px] text-mc-muted/60 font-mono shrink-0">[{new Date().toLocaleTimeString([], {hour12:false})}]</span>
                    <span className="whitespace-pre-wrap break-words">{log.replace(/^>\s*/, '').trim()}</span>
                 </div>
              );
            })}
            {isExecuting && (
              <div className="flex items-center gap-2 text-mc-secondary mt-2 bg-mc-primary/8 px-3 py-1.5 rounded-lg border border-mc-primary/15 shrink-0">
                <Loader2 size={13} className="animate-spin shrink-0 text-mc-primary" />
                <span className="tracking-wider text-xs font-mono">{t('Agent pipeline executing telemetry directive...')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Input Bar */}
      <form onSubmit={handleSubmit} className="relative group mt-1" data-tour="command-bar">
        <div className="relative bg-mc-panel border border-mc-border shadow-lg flex items-center p-2 rounded-xl">
          <div className="pl-3 sm:pl-4 pr-2 font-mono text-xs text-mc-primary font-bold select-none">
            &gt;
          </div>
          
          <input
            type="text"
            className="flex-1 min-w-0 bg-transparent border-none outline-none text-mc-text font-body text-sm sm:text-base py-2.5 sm:py-3 placeholder:text-mc-muted/50"
            placeholder={t("Enter geospatial directive or coordinates...")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {/* Quick AOI Imagery Selector Button */}
          <button
            type="button"
            onClick={() => setShowImageryModal(prev => !prev)}
            title="Quick AOI Imagery Search"
            aria-label="Quick AOI Imagery Search"
            className={`rounded-lg px-3 py-2 min-h-[42px] skeuo-button text-[11px] font-mono tracking-wider transition-colors mr-1.5 sm:mr-2 flex items-center gap-1.5 shrink-0 cursor-pointer ${
              showImageryModal 
                ? 'bg-mc-primary text-white shadow-sm' 
                : 'text-mc-muted hover:text-mc-primary'
            }`}
          >
            <Layers size={14} />
            <span className="hidden sm:inline font-semibold">AOI MAP</span>
          </button>
          
          <button 
            type="submit"
            className={`px-4 sm:px-5 py-2.5 sm:py-3 min-h-[42px] rounded-lg skeuo-button-primary font-mono text-[11px] tracking-wider font-semibold flex items-center gap-1.5 sm:gap-2 transition-all duration-300 shrink-0 cursor-pointer ${
              isExecuting 
              ? 'opacity-80' 
              : ''
            }`}
            disabled={isExecuting}
          >
            {isExecuting ? <Loader2 size={14} className="animate-spin" /> : null}
            <span className={isExecuting ? 'tracking-wider font-bold' : ''}>{t('EXECUTE')}</span>
          </button>

        </div>
      </form>

      {/* Satellite Imagery / Quick AOI Popup Modal */}
      {showImageryModal && (
        <div className="absolute bottom-[100%] right-0 mb-3 bg-mc-panel border border-mc-border rounded-xl p-4 shadow-xl w-80 max-w-[92vw] z-50 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-mc-primary font-mono text-xs tracking-wider uppercase font-bold flex items-center gap-2">
              <Layers size={14} /> Quick AOI Target
            </h3>
            <button 
              type="button"
              onClick={() => setShowImageryModal(false)} 
              aria-label="Close AOI Search"
              className="text-mc-muted hover:text-mc-danger p-1 rounded-lg hover:bg-mc-bg"
            >
              <X size={14} />
            </button>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            const loc = e.target.location.value;
            const yr = e.target.year.value;
            if (loc) {
              window.dispatchEvent(new CustomEvent('retrieve-imagery', { detail: { location: loc, year: yr } }));
              setShowImageryModal(false);
            }
          }} className="flex flex-col gap-2.5">
            <input 
              name="location" 
              type="text" 
              required 
              placeholder="Enter location (e.g. Konaseema, Assam)" 
              className="w-full bg-mc-bg border border-mc-border rounded-lg skeuo-input px-3 py-2 text-xs text-mc-text outline-none focus:border-mc-primary font-mono placeholder:text-mc-muted/60" 
            />
            <div className="flex gap-2">
              <input 
                name="year" 
                type="number" 
                defaultValue={2024} 
                min={2015}
                max={new Date().getFullYear()}
                placeholder="Year" 
                className="w-24 bg-mc-bg border border-mc-border rounded-lg skeuo-input px-3 py-2 text-xs text-mc-text outline-none focus:border-mc-primary font-mono" 
              />
              <button 
                type="submit" 
                className="flex-1 skeuo-button-primary py-2 rounded-lg font-mono text-xs tracking-wider uppercase font-semibold cursor-pointer"
              >
                Load Map
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
