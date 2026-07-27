import React, { useState } from 'react';
import { Send, Command, Sparkles, Loader2, Plus, X, ChevronUp } from 'lucide-react';
import { useMission } from '../context/MissionContext';
import { useLanguage } from '../context/LanguageContext';

export default function BottomCommand() {
  const [query, setQuery] = useState('');
  const [isLogOpen, setIsLogOpen] = useState(true);
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
        <div className="skeuo-panel p-4 max-h-48 overflow-y-auto font-mono text-sm border-t-[3px] border-mc-primary relative shadow-lg">
          <div className="sticky -top-4 -mx-4 -mt-4 px-4 pt-4 bg-mc-panel/95 backdrop-blur pb-2 mb-3 border-b border-mc-border flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <Command size={14} className="text-mc-primary" />
              <span className="text-xs font-bold text-mc-primary tracking-widest uppercase">{t('Mission Log')}</span>
            </div>
            <button onClick={() => setIsLogOpen(false)} className="text-mc-muted hover:text-mc-text p-1 rounded-md transition-colors bg-mc-bg/50 hover:bg-mc-bg">
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {logs.map((log, i) => {
              const isError = log.includes('CRITICAL') || log.includes('Failed');
              return (
                 <div key={i} className={`flex gap-3 leading-relaxed ${isError ? 'text-mc-danger bg-mc-danger/10 px-2 py-1 rounded' : log.startsWith('>') ? 'text-mc-primary' : 'text-mc-text'}`}>
                    <span className="opacity-40 select-none text-xs mt-0.5">[{new Date().toLocaleTimeString([], {hour12:false})}]</span>
                    <span>{log.replace('>', '').trim()}</span>
                 </div>
              );
            })}
            {isExecuting && (
              <div className="flex items-center gap-2 text-mc-secondary mt-3 bg-mc-primary/10 p-2.5 rounded-lg border border-mc-primary/20 animate-pulse">
                <Loader2 size={14} className="animate-spin" />
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
        </div>
      )}
    </div>
  );
}
