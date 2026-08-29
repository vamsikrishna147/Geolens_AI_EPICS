import React, { useState, useCallback } from 'react';
import {
  Loader2, CheckCircle2, Circle, XCircle,
  MessageSquare, Activity, FileText, Clock,
} from 'lucide-react';
import AssistantChat from './AssistantChat';
import { useMission } from '../context/MissionContext';
import { useLanguage } from '../context/LanguageContext';

// ── 5-Phase pipeline definition ───────────────────────────────────────
// Each phase maps to one of the 5 agents in the crew.

const PHASES = [
  {
    label: '01  MISSION PLANNING',
    description: 'Parsing query & defining AOI',
    agent: 'planner',
    color: 'text-mc-primary',
  },
  {
    label: '02  DATA ACQUISITION',
    description: 'Fetching satellite datasets',
    agent: 'acquisition',
    color: 'text-blue-400',
  },
  {
    label: '03  GIS PROCESSING',
    description: 'Spatial ops & map generation',
    agent: 'gis',
    color: 'text-purple-400',
  },
  {
    label: '04  EARTH OBSERVATION',
    description: 'Spectral analysis & TimeLens',
    agent: 'satellite',
    color: 'text-mc-secondary',
  },
  {
    label: '05  INTELLIGENCE REPORT',
    description: 'Executive brief & analytics',
    agent: 'report',
    color: 'text-mc-success',
  },
];

// ── Phase Row ─────────────────────────────────────────────────────────

function PhaseRow({ phase, status, isLast }) {
  const isRunning   = status === 'running';
  const isCompleted = status === 'completed';
  const isFailed    = status === 'failed';
  const isIdle      = !isRunning && !isCompleted && !isFailed;

  return (
    <div className="flex gap-3">
      {/* Connector line column */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 18 }}>
        {/* Status icon */}
        <div className="shrink-0 mt-2">
          {isRunning   && <Loader2    size={15} className="text-mc-primary animate-spin" />}
          {isCompleted && <CheckCircle2 size={15} className="text-mc-success" />}
          {isFailed    && <XCircle    size={15} className="text-mc-danger" />}
          {isIdle      && <Circle     size={15} className="text-mc-border/60" />}
        </div>
        {/* Vertical connector */}
        {!isLast && (
          <div className={`flex-1 w-px mt-1 mb-0 transition-colors duration-500 ${isCompleted ? 'bg-mc-success/40' : 'bg-mc-border/30'}`} />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-4 transition-all duration-300 ${isLast ? '' : ''}`}>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-mono tracking-[0.15em] font-semibold uppercase transition-colors duration-300 ${
            isRunning   ? 'text-mc-primary' :
            isCompleted ? 'text-mc-text' :
            isFailed    ? 'text-mc-danger' :
                          'text-mc-border'
          }`}>
            {phase.label}
          </span>

          {/* Running pulse bar */}
          {isRunning && (
            <div className="h-1 w-12 bg-mc-border/30 rounded overflow-hidden shrink-0">
              <div className="h-full bg-mc-primary rounded animate-pulse" style={{ width: '60%' }} />
            </div>
          )}
        </div>

        {/* Description — only show when active or completed */}
        {(isRunning || isCompleted) && (
          <p className="text-[10px] font-mono text-mc-muted mt-0.5 leading-relaxed">
            {phase.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Console ──────────────────────────────────────────────────────

export default function RightConsole() {
  const { agents, finalReport } = useMission();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('telemetry');

  const allComplete = agents.report === 'completed';

  const openReport  = useCallback(() => window.dispatchEvent(new CustomEvent('show-report')),   []);
  const openTimeLens = useCallback(() => window.dispatchEvent(new CustomEvent('show-timelens')), []);

  return (
    <aside className="w-72 skeuo-panel flex flex-col h-full overflow-hidden">

      {/* Tab selector */}
      <div className="flex shrink-0 p-1.5 m-3 mb-2 bg-black/20 rounded-xl">
        <TabButton
          active={activeTab === 'telemetry'}
          onClick={() => setActiveTab('telemetry')}
          Icon={Activity}
          label={t('TELEMETRY')}
        />
        <TabButton
          active={activeTab === 'assistant'}
          onClick={() => setActiveTab('assistant')}
          Icon={MessageSquare}
          label={t('ASSISTANT')}
        />
      </div>

      {activeTab === 'telemetry' ? (
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0 px-3 pb-3">

          {/* Section header */}
          <p className="text-[9px] font-mono tracking-[0.2em] text-mc-muted uppercase mb-3 shrink-0">
            Agent Pipeline
          </p>

          {/* 5-phase tracker */}
          <div className="flex-1 shrink-0">
            {PHASES.map((phase, i) => (
              <PhaseRow
                key={phase.agent}
                phase={phase}
                status={agents[phase.agent] || 'idle'}
                isLast={i === PHASES.length - 1}
              />
            ))}
          </div>

          {/* Post-completion actions */}
          {allComplete && (
            <div className="flex flex-col gap-2 mt-4 animate-in fade-in slide-in-from-bottom-2 duration-300 shrink-0">
              <button
                onClick={openReport}
                className="w-full py-2.5 px-4 rounded-xl bg-mc-primary hover:bg-mc-secondary text-white font-mono text-xs tracking-wider font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_0_14px_rgba(47,129,247,0.3)] hover:shadow-[0_0_20px_rgba(47,129,247,0.45)]"
              >
                <FileText size={14} />
                {t('VIEW INTELLIGENCE REPORT')}
              </button>
              <button
                onClick={openTimeLens}
                className="w-full py-2.5 px-4 rounded-xl skeuo-button border border-mc-border hover:border-mc-primary/40 text-mc-text font-mono text-xs tracking-wider transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Clock size={14} />
                {t('OPEN TIMELENS')}
              </button>
            </div>
          )}

          {/* Quick launch when idle */}
          {!allComplete && agents.planner === 'idle' && (
            <div className="mt-4 shrink-0 animate-in fade-in duration-500">
              <button
                onClick={openTimeLens}
                className="w-full py-2.5 px-4 rounded-xl skeuo-button border border-mc-border/60 text-mc-muted hover:text-mc-text font-mono text-xs tracking-wider transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Clock size={14} />
                QUICK LAUNCH TIMELENS
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

function TabButton({ active, onClick, Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-1.5 text-[10px] font-mono tracking-widest rounded-lg transition-all duration-200 flex justify-center items-center gap-1.5 ${
        active ? 'skeuo-button text-mc-primary' : 'text-mc-muted hover:text-mc-text'
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}
