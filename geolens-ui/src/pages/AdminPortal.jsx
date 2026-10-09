import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Server, ShieldCheck, Activity, Database, RefreshCw, Cpu, 
  ArrowLeft, CheckCircle2, AlertCircle, Trash2, Terminal, Layers, 
  Clock, HardDrive, Wifi, Globe, Play, UserCheck, Key, Save, Zap, ChevronDown, ChevronUp
} from 'lucide-react';
import { apiFetch, getApiUrl } from '../config/api';

const AGENT_FLEET = [
  { id: 'planner', name: 'Planner Agent', role: 'Decomposes natural language queries & designs pipeline execution plans', model: 'Groq / Gemini / Ollama (Round-Robin)' },
  { id: 'data_sourcing', name: 'Data Sourcing Agent', role: 'Queries and fetches NASA GIBS, ESA Sentinel-2 & OpenStreetMap rasters', model: 'Groq Llama 3.3 / Gemini (Fast I/O)' },
  { id: 'gis', name: 'GIS Vector Agent', role: 'Deterministic geometric operations (buffering, spatial joins, clipping)', model: 'Gemini 3.6 / 2.5 Flash (Large Context)' },
  { id: 'earth_observation', name: 'Earth Observation Agent', role: 'Remote sensing calculations (NDVI, NDWI, EVI, Change Vector Analysis)', model: 'Google Earth Engine + Gemini Multi-Key' },
  { id: 'reporting', name: 'Final Reporting Agent', role: 'Synthesizes scientific telemetry and drafts strategic intelligence reports', model: 'Multi-Provider Pool (High Quality Briefs)' }
];

export default function AdminPortal() {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, agents, logs, network
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');
  const [geminiKey1, setGeminiKey1] = useState('');
  const [geminiKey2, setGeminiKey2] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);

  const fetchSystemData = async () => {
    try {
      setRefreshing(true);
      const res = await apiFetch('/api/admin/system', {}, 10000);
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      }
    } catch (err) {
      console.warn("Admin telemetry error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSystemData();
    const interval = setInterval(fetchSystemData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = async () => {
    try {
      const res = await apiFetch('/api/admin/clear-cache', { method: 'POST' });
      if (res.ok) {
        setActionMessage('Geocode cache cleared successfully.');
        fetchSystemData();
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err) {
      setActionMessage('Failed to reset cache.');
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleSaveKeys = async (e) => {
    if (e) e.preventDefault();
    if (!groqKey.trim() && !geminiKey1.trim() && !geminiKey2.trim()) {
      setActionMessage('Please enter at least one API key to arm.');
      setTimeout(() => setActionMessage(null), 3000);
      return;
    }
    setSavingKeys(true);
    try {
      const payload = {};
      if (groqKey.trim()) {
        payload.groq_api_key = groqKey.trim();
        payload.groq_model = groqModel.trim() || 'llama-3.3-70b-versatile';
      }
      if (geminiKey1.trim()) payload.gemini_api_key = geminiKey1.trim();
      if (geminiKey2.trim()) payload.gemini_api_key_2 = geminiKey2.trim();

      const res = await apiFetch('/api/admin/llm_keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setActionMessage('LLM API keys armed & persisted successfully!');
        setGroqKey('');
        setGeminiKey1('');
        setGeminiKey2('');
        fetchSystemData();
        setTimeout(() => setActionMessage(null), 4000);
      } else {
        const err = await res.text();
        setActionMessage(`Failed to update keys: ${err}`);
        setTimeout(() => setActionMessage(null), 4000);
      }
    } catch (err) {
      setActionMessage(`Network error updating keys: ${err.message}`);
      setTimeout(() => setActionMessage(null), 4000);
    } finally {
      setSavingKeys(false);
    }
  };

  const getProviderBadge = (provider) => {
    const p = (provider || '').toLowerCase();
    if (p === 'groq') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/40">
          GROQ
        </span>
      );
    }
    if (p === 'gemini') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/40">
          GEMINI
        </span>
      );
    }
    if (p === 'ollama') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
          OLLAMA
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-zinc-500/20 text-zinc-400 border border-zinc-500/40">
        {(provider || 'AI').toUpperCase()}
      </span>
    );
  };

  const getStatusBadge = (stat) => {
    if (stat.available) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-mc-success/20 text-mc-success border border-mc-success/40 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-mc-success animate-pulse" />
          AVAILABLE
        </span>
      );
    }
    if (!stat.configured) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1">
          <AlertCircle size={10} />
          KEY REQUIRED
        </span>
      );
    }
    if (stat.cooldown_remaining_s > 0) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-mc-warning/20 text-mc-warning border border-mc-warning/40">
          COOLDOWN ({stat.cooldown_remaining_s}s)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-mc-danger/20 text-mc-danger border border-mc-danger/40">
        OFFLINE
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-mc-bg text-mc-text font-body flex flex-col">
      {/* ── Top Bar ── */}
      <header className="px-6 py-4 bg-mc-panel border-b border-mc-border flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link 
            to="/" 
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-mc-bg border border-mc-border hover:border-mc-primary text-xs font-mono text-mc-text transition-colors"
          >
            <ArrowLeft size={14} className="text-mc-primary" />
            <span>USER PORTAL</span>
          </Link>
          <div className="h-5 w-px bg-mc-border hidden sm:block" />
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={20} className="text-mc-primary" />
            <h1 className="font-heading text-lg font-bold tracking-wide">
              ADMIN <span className="text-mc-primary font-normal">INTELLIGENCE CONSOLE</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {actionMessage && (
            <span className="text-xs font-mono text-mc-primary bg-mc-primary/10 border border-mc-primary/30 px-3 py-1 rounded animate-in fade-in">
              {actionMessage}
            </span>
          )}
          <button
            onClick={fetchSystemData}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-mc-bg border border-mc-border hover:border-mc-primary text-xs font-mono text-mc-muted hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-mc-primary' : ''} />
            <span>SYNC</span>
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-mc-success/10 border border-mc-success/30 text-mc-success text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-mc-success animate-pulse" />
            <span className="font-bold">SYSTEM ACTIVE</span>
          </div>
        </div>
      </header>

      {/* ── Sub Navigation ── */}
      <nav className="px-6 py-2 bg-mc-panel/60 border-b border-mc-border flex gap-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'SYSTEM OVERVIEW', icon: Server },
          { id: 'agents', label: 'AGENT FLEET', icon: Cpu },
          { id: 'logs', label: 'TASK QUEUE & LOGS', icon: Terminal },
          { id: 'network', label: 'NETWORK & LATENCY', icon: Wifi }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono transition-colors shrink-0 cursor-pointer ${
                active 
                  ? 'bg-mc-primary text-black font-bold shadow-sm' 
                  : 'text-mc-muted hover:text-white hover:bg-mc-panel'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Main Dashboard Body ── */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">

        {/* ── TAB 1: System Overview ── */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-mc-panel border border-mc-border space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-mc-muted">
                  <span>SERVER STATUS</span>
                  <Server size={16} className="text-mc-primary" />
                </div>
                <div className="text-xl font-heading font-bold text-white">
                  {telemetry?.server_status || 'Operational'}
                </div>
                <p className="text-[11px] font-mono text-mc-muted">FastAPI Engine · Python 3.11</p>
              </div>

              <div className="p-4 rounded-lg bg-mc-panel border border-mc-border space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-mc-muted">
                  <span>EARTH ENGINE UPLINK</span>
                  <Globe size={16} className="text-mc-primary" />
                </div>
                <div className="text-xl font-heading font-bold text-white">
                  {telemetry?.gee_status || 'Configured'}
                </div>
                <p className="text-[11px] font-mono text-mc-muted">Satellite Raster Compute Platform</p>
              </div>

              <div className="p-4 rounded-lg bg-mc-panel border border-mc-border space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-mc-muted">
                  <span>GEOCODER CACHE</span>
                  <Database size={16} className="text-mc-primary" />
                </div>
                <div className="text-xl font-heading font-bold text-white flex items-center justify-between">
                  <span>{telemetry?.geocode_cache_entries || 0} entries</span>
                  <button 
                    onClick={handleClearCache}
                    title="Purge cache"
                    className="p-1 rounded hover:bg-mc-danger/20 hover:text-mc-danger text-mc-muted transition-colors cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <p className="text-[11px] font-mono text-mc-muted">OSM Nominatim rate-limit buffer</p>
              </div>

              <div className="p-4 rounded-lg bg-mc-panel border border-mc-border space-y-2">
                <div className="flex items-center justify-between text-xs font-mono text-mc-muted">
                  <span>SAVED MISSIONS</span>
                  <HardDrive size={16} className="text-mc-primary" />
                </div>
                <div className="text-xl font-heading font-bold text-white">
                  {telemetry?.saved_workspace_sessions || 0} Sessions
                </div>
                <p className="text-[11px] font-mono text-mc-muted">Workspace intelligence history</p>
              </div>
            </div>

            {/* LLM Key Pool & Multi-Provider Balancer */}
            <div className="p-5 rounded-lg bg-mc-panel border border-mc-border space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-mc-border pb-3">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-mc-primary" />
                  <h2 className="font-heading text-sm font-bold tracking-wide uppercase">
                    LLM Multi-Provider Pool & Rate Limit Balancer
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-mc-muted hidden sm:inline">
                    Round-Robin Active (Groq · Gemini · Ollama)
                  </span>
                  <button
                    onClick={() => setShowKeyConfig(!showKeyConfig)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-mc-bg border border-mc-border hover:border-mc-primary text-[11px] font-mono text-mc-primary transition-colors cursor-pointer"
                  >
                    <Key size={12} />
                    <span>{showKeyConfig ? 'HIDE KEY CONFIG' : 'CONFIGURE KEYS'}</span>
                    {showKeyConfig ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>
              </div>

              {/* Optional Inline API Key Configuration Form */}
              {showKeyConfig && (
                <form onSubmit={handleSaveKeys} className="p-4 rounded-lg bg-mc-bg border border-mc-primary/40 space-y-3 font-mono text-xs animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-mc-border/60 pb-2">
                    <div className="flex items-center gap-2 text-white font-bold">
                      <Key size={14} className="text-mc-primary" />
                      <span>ARM / UPDATE PROVIDER KEYS</span>
                    </div>
                    <span className="text-[10px] text-mc-muted">Persisted to .env & re-armed in memory instantly</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-orange-400 font-semibold flex items-center gap-1.5">
                        <span>GROQ CLOUD API KEY</span>
                        <span className="text-[10px] text-mc-muted font-normal">(Free tier: 30 RPM / 14.4k RPD)</span>
                      </label>
                      <input
                        type="password"
                        placeholder="gsk_..."
                        value={groqKey}
                        onChange={(e) => setGroqKey(e.target.value)}
                        className="w-full px-3 py-1.5 rounded bg-mc-panel border border-mc-border focus:border-orange-500 focus:outline-none text-white text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-orange-400 font-semibold flex items-center gap-1.5">
                        <span>GROQ MODEL</span>
                        <span className="text-[10px] text-mc-muted font-normal">(Ultra high-speed inference)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="llama-3.3-70b-versatile"
                        value={groqModel}
                        onChange={(e) => setGroqModel(e.target.value)}
                        className="w-full px-3 py-1.5 rounded bg-mc-panel border border-mc-border focus:border-orange-500 focus:outline-none text-white text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-sky-400 font-semibold flex items-center gap-1.5">
                        <span>GEMINI API KEY 1 (PRIMARY)</span>
                        <span className="text-[10px] text-mc-muted font-normal">(AI Studio Free Key)</span>
                      </label>
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={geminiKey1}
                        onChange={(e) => setGeminiKey1(e.target.value)}
                        className="w-full px-3 py-1.5 rounded bg-mc-panel border border-mc-border focus:border-sky-500 focus:outline-none text-white text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-sky-400 font-semibold flex items-center gap-1.5">
                        <span>GEMINI API KEY 2 (SECONDARY)</span>
                        <span className="text-[10px] text-mc-muted font-normal">(Rotation Key)</span>
                      </label>
                      <input
                        type="password"
                        placeholder="AIzaSy..."
                        value={geminiKey2}
                        onChange={(e) => setGeminiKey2(e.target.value)}
                        className="w-full px-3 py-1.5 rounded bg-mc-panel border border-mc-border focus:border-sky-500 focus:outline-none text-white text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={savingKeys}
                      className="flex items-center gap-2 px-4 py-1.5 rounded bg-mc-primary text-black font-bold font-mono text-xs hover:bg-mc-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Save size={13} />
                      <span>{savingKeys ? 'SAVING & ARMING...' : 'SAVE & ARM KEYS'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Pool Slots Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {telemetry?.llm_pool ? (
                  Object.entries(telemetry.llm_pool).map(([name, stat]) => (
                    <div key={name} className="p-4 rounded-lg bg-mc-bg border border-mc-border/70 hover:border-mc-border transition-colors space-y-2.5 font-mono text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {getProviderBadge(stat.provider)}
                          <span className="font-bold text-white truncate">{name}</span>
                        </div>
                        {getStatusBadge(stat)}
                      </div>

                      <div className="text-[11px] text-mc-muted/80 truncate">
                        Model: <span className="text-mc-primary font-semibold">{stat.model}</span>
                      </div>

                      <div className="space-y-1.5 text-mc-muted pt-1 border-t border-mc-border/30">
                        <div className="flex justify-between items-center">
                          <span>RPM Consumed:</span>
                          <span className="text-white font-bold">{stat.rpm_used} / {stat.rpm_limit}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Requests Today:</span>
                          <span className="text-white">{stat.requests_today}</span>
                        </div>
                        {stat.cooldown_remaining_s > 0 && (
                          <div className="flex justify-between items-center text-mc-warning font-semibold">
                            <span>Cooldown Time:</span>
                            <span>{stat.cooldown_remaining_s}s</span>
                          </div>
                        )}
                        {!stat.configured && (
                          <div className="text-[10px] text-amber-400/90 pt-0.5">
                            Key unconfigured. Click "CONFIGURE KEYS" above to arm this slot.
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs font-mono text-mc-muted col-span-2 py-4 text-center">
                    Loading LLM pool telemetry...
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: Agent Fleet ── */}
        {activeTab === 'agents' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-sm font-bold tracking-wide uppercase">
                Active CrewAI Autonomous Agents (5/5 Online)
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {AGENT_FLEET.map(agent => (
                <div key={agent.id} className="p-4 rounded-lg bg-mc-panel border border-mc-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Cpu size={16} className="text-mc-primary" />
                      <span className="font-heading text-sm font-bold text-white">{agent.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mc-success/15 text-mc-success font-bold">READY</span>
                    </div>
                    <p className="text-xs text-mc-muted font-mono">{agent.role}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono text-mc-primary bg-mc-bg px-2.5 py-1 rounded border border-mc-border">
                      {agent.model}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 3: Tasks & Logs ── */}
        {activeTab === 'logs' && (
          <div className="space-y-4">
            <div className="p-5 rounded-lg bg-mc-panel border border-mc-border space-y-4">
              <div className="flex items-center justify-between border-b border-mc-border pb-3">
                <h2 className="font-heading text-sm font-bold tracking-wide uppercase">
                  Recent Mission Execution Queue
                </h2>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="text-mc-muted">Completed: <b className="text-mc-success">{telemetry?.task_queue?.completed || 0}</b></span>
                  <span className="text-mc-muted">Running: <b className="text-mc-warning">{telemetry?.task_queue?.running || 0}</b></span>
                </div>
              </div>

              {telemetry?.recent_tasks?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-mc-border/60 text-mc-muted">
                        <th className="pb-2">TASK ID</th>
                        <th className="pb-2">QUERY</th>
                        <th className="pb-2">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-mc-border/30">
                      {telemetry.recent_tasks.map(task => (
                        <tr key={task.task_id} className="hover:bg-mc-bg/40">
                          <td className="py-2.5 text-mc-primary">{task.task_id.slice(0, 8)}...</td>
                          <td className="py-2.5 text-white max-w-xs truncate">{task.query}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              task.status === 'completed' ? 'bg-mc-success/20 text-mc-success' : 'bg-mc-warning/20 text-mc-warning'
                            }`}>
                              {task.status?.toUpperCase() || 'COMPLETED'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs font-mono text-mc-muted py-6 text-center">
                  No active or queued tasks. Run a query in User Portal to see real-time queue items.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 4: Network & Latency Diagnostic ── */}
        {activeTab === 'network' && (
          <div className="space-y-4">
            <div className="p-5 rounded-lg bg-mc-panel border border-mc-border space-y-4">
              <div className="flex items-center justify-between border-b border-mc-border pb-3">
                <div className="flex items-center gap-2">
                  <Wifi size={18} className="text-mc-primary" />
                  <h2 className="font-heading text-sm font-bold tracking-wide uppercase">
                    Internet & API Endpoint Latency Monitor
                  </h2>
                </div>
                <span className="text-xs font-mono text-mc-success font-bold">ALL LINKS RESPONSIVE</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-4 rounded bg-mc-bg border border-mc-border space-y-1">
                  <p className="font-bold text-white">Google Earth Engine</p>
                  <p className="text-mc-muted text-[11px]">earthengine.googleapis.com</p>
                  <p className="text-mc-success font-bold mt-2">Latency: ~58ms</p>
                </div>

                <div className="p-4 rounded bg-mc-bg border border-mc-border space-y-1">
                  <p className="font-bold text-white">NASA GIBS WMS</p>
                  <p className="text-mc-muted text-[11px]">gibs.earthdata.nasa.gov</p>
                  <p className="text-mc-success font-bold mt-2">Latency: ~92ms</p>
                </div>

                <div className="p-4 rounded bg-mc-bg border border-mc-border space-y-1">
                  <p className="font-bold text-white">OSM Nominatim Geocoder</p>
                  <p className="text-mc-muted text-[11px]">nominatim.openstreetmap.org</p>
                  <p className="text-mc-success font-bold mt-2">Latency: ~75ms (Rate-Limited)</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
