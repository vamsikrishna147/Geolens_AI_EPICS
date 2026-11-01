import React, { useState, useEffect } from 'react';
import {
  FolderOpen, FileText, History, Clock,
  Download, CheckCircle2, ChevronRight,
  Share2, Search, Loader2,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useMission } from '../context/MissionContext';
import { API_BASE_URL } from '../config/api';

// ── Local session workspace ───────────────────────────────────────────
// Missions are now fetched from the backend's workspace/sessions/ directory
// with sessionStorage as a fast write cache.

const SESSION_KEY = 'geolens_workspace';
const API = API_BASE_URL;

function loadSessionMissions() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessionMission(entry) {
  const existing = loadSessionMissions();
  const updated  = [entry, ...existing.filter(m => m.id !== entry.id)];
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(updated));
}

// ── Icon helper ───────────────────────────────────────────────────────

function MissionIcon({ type }) {
  const base = 'p-2.5 sm:p-4 rounded-xl flex items-center justify-center shrink-0';
  if (type === 'completed') return <div className={`${base} bg-mc-success/10 text-mc-success`}><CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" /></div>;
  if (type === 'failed')    return <div className={`${base} bg-mc-danger/10 text-mc-danger`}><History className="w-5 h-5 sm:w-6 sm:h-6" /></div>;
  return                          <div className={`${base} bg-mc-primary/10 text-mc-primary`}><FileText className="w-5 h-5 sm:w-6 sm:h-6" /></div>;
}

// ── WorkspaceView ─────────────────────────────────────────────────────

export default function WorkspaceView({ onBack }) {
  const { t } = useLanguage();
  const { finalReport, isExecuting } = useMission();

  const [missions, setMissions] = useState([]);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);

  // Load from backend API (persistent) + merge with sessionStorage (fast cache)
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      const localMissions = loadSessionMissions();
      try {
        const res = await fetch(`${API}/api/workspace/sessions`);
        if (res.ok) {
          const data = await res.json();
          const backendMissions = (data.sessions || []).map(s => ({
            id: s.id,
            title: s.title,
            status: s.status || 'completed',
            date: s.date ? new Date(s.date * 1000).toLocaleString() : 'Unknown',
            data: null, // loaded on demand
          }));
          // Merge: backend sessions + local-only sessions (dedup by id)
          const backendIds = new Set(backendMissions.map(m => m.id));
          const merged = [
            ...backendMissions,
            ...localMissions.filter(m => !backendIds.has(m.id)),
          ];
          setMissions(merged);
        } else {
          setMissions(localMissions);
        }
      } catch {
        setMissions(localMissions);
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  // When a mission completes, save it to the workspace
  useEffect(() => {
    if (!finalReport) return;
    const report = finalReport.official_report || finalReport.analysis_plan;
    if (!report) return;

    const entry = {
      id:     Date.now().toString(),
      title:  report.title || finalReport.analysis_plan?.query_summary || 'Untitled Analysis',
      status: 'completed',
      date:   new Date().toLocaleString(),
      data:   finalReport,
    };
    saveSessionMission(entry);
    setMissions(prev => [entry, ...prev.filter(m => m.id !== entry.id)]);
  }, [finalReport]);

  const fetchItemData = async (item) => {
    if (item.data) return item.data;
    try {
      const res = await fetch(`${API}/api/workspace/sessions/${item.id}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Failed to fetch session data:", e);
    }
    return { error: "Data not available" };
  };

  const handleDownload = async (item) => {
    const dataToExport = await fetchItemData(item);
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `GeoLens_${item.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async (item) => {
    try {
      const dataToExport = await fetchItemData(item);
      await navigator.clipboard.writeText(JSON.stringify(dataToExport, null, 2));
      alert('Mission data copied to clipboard!');
    } catch {
      alert('Clipboard access denied.');
    }
  };

  const filtered = missions.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="absolute inset-0 bg-mc-bg z-40 flex animate-in fade-in zoom-in-95 duration-300 overflow-hidden">
      <div className="flex-1 max-w-5xl mx-auto h-full flex flex-col p-3 pl-14 sm:p-6 sm:pl-24 md:p-8 md:pl-28 pb-8">

        {/* Header */}
        <div className="shrink-0 mb-6 sm:mb-8">
          <button
            onClick={onBack}
            className="text-mc-primary hover:text-mc-text font-mono text-xs mb-3 flex items-center gap-1.5 transition-colors tracking-widest uppercase cursor-pointer"
          >
            <ChevronRight size={14} className="rotate-180" /> Back to Mission Control
          </button>
          <h1 className="text-2xl sm:text-4xl font-heading font-bold text-mc-text tracking-wide flex items-center gap-2.5 sm:gap-3">
            <FolderOpen className="text-mc-primary shrink-0" size={28} />
            {t('Workspace')}
          </h1>
          <p className="text-mc-muted mt-1.5 text-xs sm:text-sm font-light">
            Completed missions are saved here for the current session.
          </p>
        </div>

        {/* Search */}
        <div className="shrink-0 mb-4 sm:mb-6 flex items-center gap-2.5 sm:gap-3 bg-mc-panel border border-mc-border rounded-xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-inner">
          <Search size={16} className="text-mc-muted shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search missions..."
            className="bg-transparent border-none outline-none text-mc-text font-mono text-xs sm:text-sm w-full placeholder:text-mc-muted/50"
          />
        </div>

        {/* Mission list */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center p-16 text-mc-primary">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-mc-muted font-mono border border-dashed border-mc-border/50 rounded-2xl gap-4">
              <History size={40} className="opacity-30" />
              <p className="text-sm tracking-widest uppercase">
                {missions.length === 0 ? 'No missions yet — run a query first' : 'No results for your search'}
              </p>
            </div>
          ) : (
            filtered.map(item => (
              <div
                key={item.id}
                className="bg-mc-panel border border-mc-border rounded-2xl p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:border-mc-primary/40 transition-all duration-200 shadow-sm"
              >
                <div className="flex items-center gap-3.5 sm:gap-5 min-w-0">
                  <MissionIcon type={item.status} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-heading font-semibold text-mc-text group-hover:text-mc-primary transition-colors truncate">
                      {item.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-[11px] sm:text-xs text-mc-muted font-mono">
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {item.date}
                      </span>
                      <span className="flex items-center gap-1 text-mc-success font-semibold">
                        <CheckCircle2 size={12} /> {item.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto sm:ml-4">
                  <a
                    href={`${API}/api/report/pdf/${item.id}`}
                    download={`GeoLens_Report_${item.id}.pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-red-600/15 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 font-mono text-xs font-semibold shadow-sm"
                    title="Download Official PDF Report"
                  >
                    <Download size={13} />
                    <span>PDF</span>
                  </a>
                  <button
                    onClick={() => handleShare(item)}
                    className="p-2 sm:p-2.5 bg-mc-bg border border-mc-border text-mc-muted hover:text-mc-primary hover:border-mc-primary/40 rounded-lg transition-all cursor-pointer"
                    title="Copy to clipboard"
                  >
                    <Share2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDownload(item)}
                    className="p-2 sm:p-2.5 bg-mc-primary text-white hover:bg-mc-secondary rounded-lg transition-all shadow-sm cursor-pointer"
                    title="Download JSON"
                  >
                    <Download size={15} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}