import React, { useState } from 'react';
import { Loader2, CheckCircle2, Circle, MessageSquare, Activity } from 'lucide-react';
import AssistantChat from './AssistantChat';
import { useMission } from '../context/MissionContext';
import { useLanguage } from '../context/LanguageContext';

const AgentStatus = ({ name, status }) => {
  const isRunning = status === 'running';
  const isCompleted = status === 'completed';
  const isIdle = status === 'idle';
  const isFailed = status === 'failed';

  return (
    <div className="flex items-center gap-3 p-2">
      {isRunning && <Loader2 size={16} className="text-mc-primary animate-spin" />}
      {isCompleted && <CheckCircle2 size={16} className="text-mc-success" />}
      {isIdle && <Circle size={16} className="text-mc-border" />}
      {isFailed && <Circle size={16} className="text-mc-danger fill-mc-danger" />}
      
      <div className="flex-1">
        <span className={`text-sm font-mono ${isRunning ? 'text-mc-primary' : isCompleted ? 'text-mc-text' : isFailed ? 'text-mc-danger' : 'text-mc-muted'}`}>
          {name}
        </span>
      </div>
      {isRunning && (
        <div className="h-1 w-12 bg-mc-border rounded overflow-hidden">
          <div className="h-full bg-mc-primary w-1/2 animate-pulse" />
        </div>
      )}
    </div>
  );
};

export default function RightConsole() {
  const { agents, logs } = useMission();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('telemetry');

  return (
    <aside className="w-80 skeuo-panel p-4 flex flex-col h-full overflow-hidden">
      
      {/* Premium Tab Selector */}
      <div className="flex mb-4 shrink-0 p-1 bg-[#0a0d13] rounded-lg shadow-inner">
        <button 
          onClick={() => setActiveTab('telemetry')}
          className={`flex-1 py-1.5 text-xs font-mono tracking-wider rounded transition-colors flex justify-center items-center gap-2 ${activeTab === 'telemetry' ? 'skeuo-button text-mc-primary' : 'text-mc-muted hover:text-mc-text'}`}
        >
          <Activity size={14} /> {t('TELEMETRY')}
        </button>
        <button 
          onClick={() => setActiveTab('assistant')}
          className={`flex-1 py-1.5 text-xs font-mono tracking-wider rounded transition-colors flex justify-center items-center gap-2 ${activeTab === 'assistant' ? 'skeuo-button text-mc-primary' : 'text-mc-muted hover:text-mc-text'}`}
        >
          <MessageSquare size={14} /> {t('ASSISTANT')}
        </button>
      </div>

      {activeTab === 'telemetry' ? (
        <div className="flex-1 overflow-y-auto flex flex-col pr-2 min-h-0">
          <div className="flex flex-col gap-1 shrink-0">
            <AgentStatus 
              name={t('1. REQUIREMENT ANALYSIS')} 
              status={agents.discovery === 'completed' ? 'completed' : (agents.planner === 'running' || agents.discovery === 'running') ? 'running' : (agents.planner === 'failed' || agents.discovery === 'failed') ? 'failed' : 'idle'} 
            />
            <div className="w-px h-3 bg-mc-border ml-3.5 my-1" />
            <AgentStatus 
              name={t('2. DATA ACQUISITION')} 
              status={agents.acquisition} 
            />
            <div className="w-px h-3 bg-mc-border ml-3.5 my-1" />
            <AgentStatus 
              name={t('3. GEOSPATIAL PROCESSING')} 
              status={agents.gis === 'completed' ? 'completed' : (agents.satellite === 'running' || agents.gis === 'running') ? 'running' : (agents.satellite === 'failed' || agents.gis === 'failed') ? 'failed' : 'idle'} 
            />
            <div className="w-px h-3 bg-mc-border ml-3.5 my-1" />
            <AgentStatus 
              name={t('4. INTELLIGENCE SYNTHESIS')} 
              status={agents.report} 
            />
          </div>

          <div className="mt-4 flex-1 min-h-[150px] p-3 bg-[#0a0d13] shadow-inner border border-mc-border/30 rounded-lg text-xs font-mono text-mc-muted leading-relaxed overflow-y-auto flex flex-col gap-2">
            {logs.length === 0 ? (
              <span className="text-mc-border italic">{t('Awaiting directive...')}</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className={log.includes('CRITICAL') ? 'text-mc-danger' : 'text-mc-primary'}>{log.startsWith('>') ? '>' : ''}</span>
                  <span className={log.includes('CRITICAL') ? 'text-mc-danger' : ''}>{log.replace('>', '').trim()}</span>
                </div>
              ))
            )}
          </div>

          {!agents.report && agents.planner === 'idle' && (
            <div className="flex flex-col gap-2 mt-4 shrink-0 animate-in fade-in slide-in-from-bottom-2">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('show-timelens'))}
                className="w-full skeuo-button text-mc-text font-mono text-xs py-3 rounded transition-colors flex items-center justify-center gap-2 border border-mc-border"
              >
                QUICK LAUNCH TIMELENS
              </button>
            </div>
          )}

          {agents.report === 'completed' && (
            <div className="flex flex-col gap-2 mt-4 shrink-0 animate-in fade-in slide-in-from-bottom-2 pb-2">
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('show-report'))}
                className="w-full bg-mc-primary hover:bg-mc-secondary text-white font-mono text-xs py-2 rounded transition-colors flex items-center justify-center gap-2"
              >
                {t('GENERATE OFFICIAL REPORT')}
              </button>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('show-timelens'))}
                className="w-full bg-mc-panel border border-mc-border hover:bg-mc-border text-mc-text font-mono text-xs py-2 rounded transition-colors flex items-center justify-center gap-2"
              >
                {t('OPEN TIMELENS COMPARISON')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <AssistantChat />
      )}
    </aside>
  );
}
