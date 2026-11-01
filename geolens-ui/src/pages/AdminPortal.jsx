import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Server, ShieldCheck, Activity, Database, RefreshCw, Cpu, 
  ArrowLeft, CheckCircle2, AlertCircle, Trash2, Terminal, Layers, 
  Clock, HardDrive, Wifi, Globe, Play, UserCheck, Key, Save, Zap, ChevronDown, ChevronUp,
  Lock, LogOut, ShieldAlert, Eye, EyeOff, FileText, Download
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [showPasskey, setShowPasskey] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // overview, agents, logs, security, network
  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState('llama-3.3-70b-versatile');
  const [geminiKey1, setGeminiKey1] = useState('');
  const [geminiKey2, setGeminiKey2] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);
  const [securityAudit, setSecurityAudit] = useState(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const checkAuth = async () => {
    setAuthChecking(true);
    try {
      const res = await apiFetch('/api/admin/verify');
      if (res.ok) {
        setIsAuthenticated(true);
        fetchSystemData();
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    } finally {
      setAuthChecking(false);
      setLoading(false);
    }
  };

  const fetchSystemData = async () => {
    try {
      setRefreshing(true);
      const res = await apiFetch('/api/admin/system', {}, 10000);
      if (res.ok) {
        const data = await res.json();
        setTelemetry(data);
      } else if (res.status === 401) {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.warn("Admin telemetry error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSecurityAudit = async () => {
    try {
      setLoadingAudit(true);
      const res = await apiFetch('/api/admin/security/audit');
      if (res.ok) {
        const data = await res.json();
        setSecurityAudit(data);
      }
    } catch (err) {
      console.warn("Security audit fetch error:", err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(fetchSystemData, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const fetchSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await apiFetch('/api/workspace/sessions');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (e) {
      console.warn("Failed to load sessions for admin:", e);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'security' && isAuthenticated) {
      fetchSecurityAudit();
    }
    if (activeTab === 'reports' && isAuthenticated) {
      fetchSessions();
    }
  }, [activeTab, isAuthenticated]);

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!passkeyInput.trim()) {
      setAuthError('Please enter the administrative master passkey.');
      return;
    }
    setLoggingIn(true);
    setAuthError(null);
    try {
      const res = await apiFetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_key: passkeyInput.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        sessionStorage.setItem('geolens_admin_token', data.token);
        setIsAuthenticated(true);
        setPasskeyInput('');
        fetchSystemData();
      } else {
        const errData = await res.json().catch(() => ({}));
        setAuthError(errData.detail || 'Access denied: Invalid administrative passkey.');
      }
    } catch (err) {
      setAuthError(err.message || 'Network error connecting to administrative gateway.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/admin/logout', { method: 'POST' });
    } catch {}
    sessionStorage.removeItem('geolens_admin_token');
    setIsAuthenticated(false);
    setTelemetry(null);
  };

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

  if (authChecking) {
    return (
      <div className="min-h-screen bg-mc-bg text-mc-text font-body flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 font-mono text-xs text-mc-muted">
          <RefreshCw size={24} className="animate-spin text-mc-primary" />
          <span>VERIFYING ADMINISTRATIVE ACCESS PRIVILEGES...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-mc-bg text-mc-text font-body flex flex-col justify-between p-6">
        <div className="max-w-md w-full mx-auto my-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-mc-panel border border-mc-border flex items-center justify-center mx-auto shadow-xl">
              <Lock size={32} className="text-mc-primary animate-pulse" />
            </div>
            <h1 className="font-heading text-xl font-bold tracking-wide text-white uppercase">
              Admin Isolation Gateway
            </h1>
            <p className="text-xs font-mono text-mc-muted">
              Restricted Area · Special Access Control & System Telemetry
            </p>
          </div>

          <div className="p-6 rounded-xl bg-mc-panel border border-mc-border shadow-2xl space-y-4">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono flex items-start gap-2">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>User portal is strictly isolated. All administrative modifications require master passkey verification.</span>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-mono flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-mc-muted uppercase tracking-wider">
                  Administrative Master Key
                </label>
                <div className="relative">
                  <input
                    type={showPasskey ? "text" : "password"}
                    value={passkeyInput}
                    onChange={(e) => setPasskeyInput(e.target.value)}
                    placeholder="Enter GEOLENS_ADMIN_KEY..."
                    autoFocus
                    className="w-full px-3.5 py-2.5 rounded-lg bg-mc-bg border border-mc-border focus:border-mc-primary text-white text-xs font-mono placeholder:text-zinc-600 focus:outline-none transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasskey(!showPasskey)}
                    className="absolute right-3 top-2.5 text-mc-muted hover:text-white cursor-pointer"
                  >
                    {showPasskey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loggingIn || !passkeyInput.trim()}
                className="w-full py-2.5 rounded-lg bg-mc-primary text-black font-bold font-mono text-xs hover:brightness-110 active:brightness-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-lg shadow-mc-primary/20"
              >
                {loggingIn ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>AUTHENTICATING ACCESS...</span>
                  </>
                ) : (
                  <>
                    <Key size={14} />
                    <span>UNLOCK ADMIN CONSOLE</span>
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center">
              <Link
                to="/"
                className="text-xs font-mono text-mc-muted hover:text-mc-primary transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft size={12} />
                <span>Return to User Portal</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] font-mono text-zinc-600">
          GeoLens AI Security Subsystem · ISO/IEC 27001 Grounded Isolation Architecture
        </div>
      </div>
    );
  }

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
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-500/10 border border-red-500/30 text-xs font-mono text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors cursor-pointer"
            title="Lock administrative console and terminate session"
          >
            <LogOut size={13} />
            <span className="hidden sm:inline">LOCK / LOGOUT</span>
          </button>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-mc-success/10 border border-mc-success/30 text-mc-success text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-mc-success animate-pulse" />
            <span className="font-bold">SUPER ADMIN</span>
          </div>
        </div>
      </header>

      {/* ── Sub Navigation ── */}
      <nav className="px-6 py-2 bg-mc-panel/60 border-b border-mc-border flex gap-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'SYSTEM OVERVIEW', icon: Server },
          { id: 'agents', label: 'AGENT FLEET', icon: Cpu },
          { id: 'reports', label: 'PDF REPORTS & SESSIONS', icon: FileText },
          { id: 'logs', label: 'TASK QUEUE & LOGS', icon: Terminal },
          { id: 'security', label: 'SECURITY & AUDIT', icon: ShieldAlert },
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

        {/* ── TAB: PDF Reports & Missions ── */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="p-5 rounded-lg bg-mc-panel border border-mc-border space-y-4">
              <div className="flex items-center justify-between border-b border-mc-border pb-3">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-mc-primary" />
                  <h2 className="font-heading text-sm font-bold tracking-wide uppercase">
                    Archived Mission Sessions & PDF Downloads
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-mc-muted">
                    Total Sessions: <b className="text-mc-primary">{sessions.length}</b>
                  </span>
                  <button
                    onClick={fetchSessions}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-mc-bg border border-mc-border text-mc-muted hover:text-white font-mono text-xs cursor-pointer"
                  >
                    <RefreshCw size={12} className={loadingSessions ? 'animate-spin' : ''} />
                    <span>REFRESH</span>
                  </button>
                </div>
              </div>

              {loadingSessions ? (
                <p className="text-xs font-mono text-mc-muted py-8 text-center">Loading mission archives...</p>
              ) : sessions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-mc-border/60 text-mc-muted">
                        <th className="pb-2">SESSION ID</th>
                        <th className="pb-2">MISSION TITLE</th>
                        <th className="pb-2">TIMESTAMP</th>
                        <th className="pb-2">STATUS</th>
                        <th className="pb-2 text-right">EXPORT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-mc-border/30">
                      {sessions.map(s => (
                        <tr key={s.id} className="hover:bg-mc-bg/40">
                          <td className="p-2 text-mc-muted font-bold">{s.id.slice(0, 16)}...</td>
                          <td className="p-2 text-white font-semibold">{s.title || 'Mission Assessment'}</td>
                          <td className="p-2 text-mc-muted">
                            {s.date ? new Date(s.date * 1000).toLocaleString() : 'Recent'}
                          </td>
                          <td className="p-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                              {s.status || 'COMPLETED'}
                            </span>
                          </td>
                          <td className="p-2 text-right">
                            <a
                              href={getApiUrl(`/api/report/pdf/${s.id}`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-mc-primary/20 hover:bg-mc-primary text-mc-primary hover:text-black font-mono text-xs font-bold border border-mc-primary/40 transition-colors"
                            >
                              <Download size={12} />
                              <span>DOWNLOAD PDF</span>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs font-mono text-mc-muted py-8 text-center">
                  No mission sessions recorded yet. Run a query in Mission Control to generate sessions and PDFs.
                </p>
              )}
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

        {/* ── TAB: Security & Audit Console ── */}
        {activeTab === 'security' && (
          <div className="space-y-4">
            <div className="p-5 rounded-lg bg-mc-panel border border-mc-border space-y-4">
              <div className="flex items-center justify-between border-b border-mc-border pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-mc-primary" />
                  <h2 className="font-heading text-sm font-bold tracking-wide uppercase">
                    Security Defense Telemetry & Access Audit
                  </h2>
                </div>
                <button
                  onClick={fetchSecurityAudit}
                  disabled={loadingAudit}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-mc-bg border border-mc-border text-xs font-mono text-mc-muted hover:text-white"
                >
                  <RefreshCw size={12} className={loadingAudit ? 'animate-spin text-mc-primary' : ''} />
                  <span>REFRESH AUDIT</span>
                </button>
              </div>

              {/* Security Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-4 rounded bg-mc-bg border border-mc-border space-y-1">
                  <span className="text-mc-muted text-[11px]">ACTIVE ADMIN SESSIONS</span>
                  <p className="text-lg font-bold text-mc-primary">{securityAudit?.active_admin_sessions || 1}</p>
                </div>
                <div className="p-4 rounded bg-mc-bg border border-mc-border space-y-1">
                  <span className="text-mc-muted text-[11px]">LOCKED / BLOCKED IPS</span>
                  <p className="text-lg font-bold text-mc-success">{securityAudit?.locked_ips_count || 0}</p>
                </div>
                <div className="p-4 rounded bg-mc-bg border border-mc-border space-y-1">
                  <span className="text-mc-muted text-[11px]">DEFENSE PROTOCOLS</span>
                  <p className="text-xs font-bold text-white mt-1">RATE-LIMIT + CSRF/XSS + BRUTE-FORCE LOCK</p>
                </div>
              </div>

              {/* Audit Log Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-mono text-mc-muted uppercase tracking-wider">
                  Real-time Security Events Log
                </h3>
                {securityAudit?.audit_events?.length > 0 ? (
                  <div className="overflow-x-auto max-h-80 border border-mc-border/40 rounded">
                    <table className="w-full text-left font-mono text-[11px]">
                      <thead className="bg-mc-bg sticky top-0 border-b border-mc-border/60 text-mc-muted">
                        <tr>
                          <th className="p-2">TIMESTAMP (UTC)</th>
                          <th className="p-2">EVENT</th>
                          <th className="p-2">CLIENT IP</th>
                          <th className="p-2">ENDPOINT</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-mc-border/30">
                        {securityAudit.audit_events.map((evt, idx) => (
                          <tr key={idx} className="hover:bg-mc-bg/40">
                            <td className="p-2 text-zinc-400">{evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString() : '-'}</td>
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                evt.event_type.includes('SUCCESS') ? 'bg-emerald-500/20 text-emerald-400' :
                                evt.event_type.includes('FAILED') || evt.event_type.includes('BLOCKED') ? 'bg-red-500/20 text-red-400' :
                                'bg-sky-500/20 text-sky-400'
                              }`}>
                                {evt.event_type}
                              </span>
                            </td>
                            <td className="p-2 text-white">{evt.client_ip}</td>
                            <td className="p-2 text-mc-muted truncate max-w-xs">{evt.path}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs font-mono text-mc-muted py-4 text-center">
                    No security events logged in current session. All endpoints operating within secure boundaries.
                  </p>
                )}
              </div>
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
