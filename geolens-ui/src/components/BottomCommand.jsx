import React, { useState } from 'react';
import { Send, Command, Sparkles, Loader2, Plus, X, ChevronUp, Maximize2, Minimize2, Layers } from 'lucide-react';
import { useMission } from '../context/MissionContext';
import { useLanguage } from '../context/LanguageContext';

export default function BottomCommand() {
  const [query, setQuery] = useState('');
  const [isLogOpen, setIsLogOpen] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const { isExecuting, logs, executeDirective } = useMission();
  const { t } = useLanguage();

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
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-3 mb-1">
      
      {/* Minimized Log Bar */}
      {logs.length > 0 && !isLogOpen && (
        <div className="flex justify-center -mb-2 z-10">
          <button onClick={() => setIsLogOpen(true)} className="skeuo-panel px-6 py-1.5 rounded-t-lg rounded-b-none border-t-[3px] border-mc-primary flex items-center gap-2 hover:bg-mc-panel/80 transition-colors cursor-pointer shadow-[0_-5px_15px_rgba(0,0,0,0.1)] light-theme:shadow-none">
             <Command size={12} className="text-mc-primary" />
             <span className="text-[10px] font-bold text-mc-text tracking-widest uppercase">{t('Mission Log')}</span>
             <ChevronUp size={14} className="text-mc-muted" />
          </button>
        </div>
      )}

      {/* Chatbot Output Area */}
      {logs.length > 0 && isLogOpen && (
        <div className={`skeuo-panel flex flex-col font-mono text-sm border-t-[3px] border-mc-primary relative shadow-lg transition-all duration-300 ${isExpanded ? 'h-[60vh] max-h-[800px]' : 'max-h-64'}`}>
          <div className="px-4 py-3 bg-mc-panel border-b border-mc-border flex items-center justify-between rounded-t-lg shrink-0">
            <div className="flex items-center gap-2">
              <Command size={14} className="text-mc-primary" />
              <span className="text-xs font-bold text-mc-primary tracking-widest uppercase">{t('Mission Log')}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsExpanded(!isExpanded)} className="text-mc-muted hover:text-mc-text p-1.5 rounded-md transition-colors bg-mc-bg/50 hover:bg-mc-bg">
                {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button onClick={() => setIsLogOpen(false)} className="text-mc-muted hover:text-mc-danger p-1.5 rounded-md transition-colors bg-mc-bg/50 hover:bg-mc-bg">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="p-4 flex-1 overflow-auto flex flex-col gap-1.5">
            {logs.map((log, i) => {
              const isError = log.includes('CRITICAL') || log.includes('Failed');
              return (
                 <div key={i} className={`flex gap-3 leading-relaxed ${isError ? 'text-mc-danger bg-mc-danger/10 px-2 py-1 rounded' : log.startsWith('>') ? 'text-mc-primary' : 'text-mc-text'}`}>
                    <span className="opacity-40 select-none text-xs mt-0.5 shrink-0">[{new Date().toLocaleTimeString([], {hour12:false})}]</span>
                    <span className="whitespace-pre-wrap break-words">{log.replace('>', '').trim()}</span>
                 </div>
              );
            })}
            {isExecuting && (
              <div className="flex items-center gap-2 text-mc-secondary mt-3 bg-mc-primary/10 p-2.5 rounded-lg border border-mc-primary/20 animate-pulse shrink-0">
                <Loader2 size={14} className="animate-spin shrink-0" />
                <span className="tracking-wide">{t('AI Assistant is processing telemetry...')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Input */}
      <form onSubmit={handleSubmit} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-mc-primary to-mc-secondary rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
        <div className="relative skeuo-panel flex items-center p-2">
          
          <div className="pl-4 pr-3 text-mc-primary">
            <Sparkles size={20} />
          </div>
          
          <input
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-mc-text font-body text-lg py-3 placeholder:text-mc-muted/50"
            placeholder={t("Ask AI Assistant or enter a mission directive...")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          
          <button 
            type="submit"
            className={`px-6 py-3 rounded-lg flex items-center gap-2 font-mono text-sm transition-all duration-300 ${
              isExecuting 
              ? 'bg-mc-primary text-white border border-transparent shadow-[0_0_15px_rgba(47,129,247,0.5)] animate-pulse' 
              : 'skeuo-button text-mc-muted hover:text-mc-text'
            }`}
          >
            {isExecuting ? <Loader2 size={16} className="animate-spin" /> : <Command size={16} />}
            <span className={isExecuting ? 'tracking-wider font-bold' : ''}>{t('EXECUTE')}</span>
          </button>

        </div>
      </form>

      {/* Suggestions */}
      {!isExecuting && logs.length === 0 && (
        <div className="flex gap-2 justify-center text-xs font-mono text-mc-muted mt-2">
          <button onClick={() => setQuery("Compare Hyderabad urban growth 2018-2025")} className="px-3 py-1 rounded-full skeuo-button hover:text-mc-text transition-colors">
            {t('Compare Hyderabad urban growth')}
          </button>
          <button onClick={() => setQuery("Detect flood affected regions in Assam")} className="px-3 py-1 rounded-full skeuo-button hover:text-mc-text transition-colors">
            {t('Detect flood affected regions')}
          </button>
          <button onClick={() => document.getElementById('imagery-modal').classList.toggle('hidden')} className="px-3 py-1 rounded-full skeuo-button text-mc-primary hover:text-white hover:bg-mc-primary/20 border border-mc-primary transition-colors flex items-center gap-1">
            <Layers size={12} />
            {t('Retrieve Satellite Imagery')}
          </button>
        </div>
      )}

      {/* Satellite Imagery Popup Modal */}
      <div id="imagery-modal" className="hidden absolute bottom-[100%] right-0 mb-4 bg-[#11161F] border-2 border-mc-primary rounded-xl p-4 shadow-2xl w-72 z-50 animate-in fade-in slide-in-from-bottom-2">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-mc-primary font-mono text-sm tracking-wider uppercase font-bold flex items-center gap-2">
            <Layers size={14} /> Retrieve Imagery
          </h3>
          <button onClick={() => document.getElementById('imagery-modal').classList.add('hidden')} className="text-mc-muted hover:text-mc-danger">
            <X size={14} />
          </button>
        </div>
        <form onSubmit={(e) => {
          e.preventDefault();
          const loc = e.target.location.value;
          const yr = e.target.year.value;
          if(loc) {
             window.dispatchEvent(new CustomEvent('retrieve-imagery', { detail: { location: loc, year: yr } }));
             document.getElementById('imagery-modal').classList.add('hidden');
          }
        }} className="flex flex-col gap-3">
          <input name="location" type="text" required placeholder="Location or Coordinates" className="w-full bg-[#0A0D14] border border-mc-border rounded p-2 text-sm text-mc-text outline-none focus:border-mc-primary" />
          <input name="year" type="number" defaultValue={2024} placeholder="Year" className="w-full bg-[#0A0D14] border border-mc-border rounded p-2 text-sm text-mc-text outline-none focus:border-mc-primary" />
          <button type="submit" className="w-full bg-mc-primary text-white py-2 rounded-lg font-mono text-xs tracking-wider uppercase hover:bg-opacity-80 transition-colors">
            Fetch Maps
          </button>
        </form>
      </div>

    </div>
  );
}
