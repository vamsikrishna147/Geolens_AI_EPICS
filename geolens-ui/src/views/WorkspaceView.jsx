import React, { useState, useEffect } from 'react';
import { FolderGit2, FileText, History, Clock, MapPin, Download, CheckCircle2, ChevronRight, Share2, Search, Filter, Loader2, AlertCircle } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';

export default function WorkspaceView({ onBack }) {
  const { t } = useLanguage();
  const [filter, setFilter] = useState('all');
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await axios.get('http://localhost:8000/api/history');
        // Map the backend data to match UI expectations
        const formatted = res.data.map(mission => ({
          id: mission.id,
          type: mission.status === 'completed' ? 'report' : mission.status === 'running' ? 'project' : 'history',
          title: mission.query || 'Untitled Analysis',
          date: new Date(mission.created_at).toLocaleString(),
          status: mission.status.charAt(0).toUpperCase() + mission.status.slice(1),
          format: mission.status === 'completed' ? 'JSON Report' : 'Raw Data'
        }));
        setMissions(formatted);
      } catch (err) {
        console.error("Failed to fetch history", err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  return (
    <div className="absolute inset-0 bg-mc-bg/95 backdrop-blur-xl z-40 flex animate-in fade-in zoom-in-95 duration-300">
      <div className="flex-1 max-w-7xl mx-auto h-full flex flex-col p-8">
        
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 mb-8">
          <div>
            <button onClick={onBack} className="text-mc-primary hover:text-mc-text font-mono text-sm mb-4 flex items-center gap-2 transition-colors">
              <ChevronRight size={16} className="rotate-180" /> BACK TO MISSION CONTROL
            </button>
            <h1 className="text-4xl font-heading font-bold text-mc-text tracking-wide">
              {t('Workspace')}
            </h1>
            <p className="text-mc-muted mt-2 text-lg font-light">
              Unified archive of all active projects, generated reports, and query history.
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-mc-panel border border-mc-border p-2 rounded-lg">
            <button onClick={() => setFilter('all')} className={`px-4 py-2 text-sm font-mono rounded transition-colors ${filter === 'all' ? 'bg-mc-primary text-white' : 'text-mc-muted hover:text-white'}`}>All</button>
            <button onClick={() => setFilter('project')} className={`px-4 py-2 text-sm font-mono rounded transition-colors ${filter === 'project' ? 'bg-mc-primary text-white' : 'text-mc-muted hover:text-white'}`}>Projects</button>
            <button onClick={() => setFilter('report')} className={`px-4 py-2 text-sm font-mono rounded transition-colors ${filter === 'report' ? 'bg-mc-primary text-white' : 'text-mc-muted hover:text-white'}`}>Reports</button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 bg-mc-panel border border-mc-border rounded-lg flex items-center px-4 py-3">
            <Search size={20} className="text-mc-muted mr-3" />
            <input 
              type="text" 
              placeholder="Search workspace..."
              className="bg-transparent border-none outline-none text-mc-text font-mono w-full placeholder:text-mc-muted"
            />
          </div>
          <button className="bg-mc-panel border border-mc-border text-mc-muted hover:text-mc-text px-6 py-3 rounded-lg flex items-center gap-2 font-mono transition-colors">
            <Filter size={20} /> Filter
          </button>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto pr-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center p-12 text-mc-primary animate-pulse">
              <Loader2 size={32} className="animate-spin" />
            </div>
          ) : missions.length === 0 ? (
            <div className="text-center p-12 text-mc-muted font-mono border border-dashed border-mc-border rounded-xl">
              <History size={48} className="mx-auto mb-4 opacity-50" />
              NO MISSION HISTORY FOUND
            </div>
          ) : missions.filter(item => filter === 'all' || item.type === filter).map(item => (
            <div key={item.id} className="bg-mc-panel border border-mc-border rounded-xl p-6 flex items-center justify-between group hover:border-mc-primary/50 transition-colors">
              <div className="flex items-center gap-6">
                <div className={`p-4 rounded-xl flex items-center justify-center ${
                  item.type === 'report' ? 'bg-blue-500/10 text-blue-400' :
                  item.type === 'project' ? 'bg-purple-500/10 text-purple-400' :
                  'bg-gray-500/10 text-gray-400'
                }`}>
                  {item.type === 'report' && <FileText size={28} />}
                  {item.type === 'project' && <FolderGit2 size={28} />}
                  {item.type === 'history' && <History size={28} />}
                </div>
                <div>
                  <h3 className="text-xl font-heading text-mc-text group-hover:text-mc-primary transition-colors">{item.title}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-mc-muted font-mono">
                    <span className="flex items-center gap-1"><Clock size={14} /> {item.date}</span>
                    <span className="flex items-center gap-1 text-mc-success"><CheckCircle2 size={14} /> {item.status}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-mc-muted px-3 py-1 bg-mc-bg rounded border border-mc-border mr-4">
                  {item.format}
                </span>
                <button className="p-3 bg-mc-bg border border-mc-border text-mc-muted hover:text-mc-text hover:border-mc-primary rounded-lg transition-all" title="Share">
                  <Share2 size={18} />
                </button>
                <button className="p-3 bg-mc-primary text-white hover:bg-mc-secondary rounded-lg transition-all" title="Download">
                  <Download size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
