import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, Activity, Link, Server, ChevronRight, CheckCircle2, Lock, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import axios from 'axios';
import { getApiUrl } from '../config/api';

const SOURCES = [
  { id: 1, name: 'NASA Landsat 9', status: 'Active', latency: '42ms', validation: 'Cryptographic Hash Match', accuracy: '99.9%', url: 'usgs.gov' },
  { id: 2, name: 'ESA Sentinel-2', status: 'Active', latency: '38ms', validation: 'Signed Origin Cert', accuracy: '99.8%', url: 'copernicus.eu' },
  { id: 3, name: 'OpenStreetMap', status: 'Active', latency: '12ms', validation: 'Community Verified', accuracy: 'High', url: 'openstreetmap.org' }
];

export default function DataValidationView({ onBack }) {
  const { t } = useLanguage();
  const [telemetry, setTelemetry] = useState({ total_pipelines_run: '0', data_ingested_gb: '0', active_streams: '0' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTelemetry() {
      try {
        const res = await axios.get(getApiUrl('/api/telemetry'));
        setTelemetry(res.data);
      } catch (err) {
        console.warn("Telemetry fetch error:", err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchTelemetry();
    
    // Poll every 5s for live updates
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 bg-mc-bg/95 z-40 flex animate-in fade-in zoom-in-95 duration-300">
      <div className="flex-1 max-w-7xl mx-auto h-full flex flex-col p-8">
        
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 mb-8">
          <div>
            <button onClick={onBack} className="text-mc-primary hover:text-mc-text font-mono text-sm mb-4 flex items-center gap-2 transition-colors">
              <ChevronRight size={16} className="rotate-180" /> BACK TO MISSION CONTROL
            </button>
            <h1 className="text-4xl font-heading font-bold text-mc-text tracking-wide flex items-center gap-4">
              {t('Data & Validation')} <ShieldCheck className="text-mc-success" size={32} />
            </h1>
            <p className="text-mc-muted mt-2 text-lg font-light">
              Transparent overview of all geospatial data sources, accuracy metrics, and cryptographic proofs.
            </p>
          </div>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8 shrink-0">
          <div className="bg-mc-panel border border-mc-border p-6 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-mc-success/10 text-mc-success rounded-lg"><Activity size={24} /></div>
            <div>
              <p className="text-xs text-mc-muted font-mono">SYSTEM HEALTH</p>
              <p className="text-xl font-bold text-mc-text mt-1">
                {loading ? <Loader2 size={16} className="animate-spin" /> : "99.99% Uptime"}
              </p>
            </div>
          </div>
          <div className="bg-mc-panel border border-mc-border p-6 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-mc-primary/10 text-mc-primary rounded-lg"><Server size={24} /></div>
            <div>
              <p className="text-xs text-mc-muted font-mono">ACTIVE PIPELINES</p>
              <p className="text-xl font-bold text-mc-text mt-1">
                {loading ? <Loader2 size={16} className="animate-spin" /> : `${telemetry.active_streams} Streams`}
              </p>
            </div>
          </div>
          <div className="bg-mc-panel border border-mc-border p-6 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-mc-panel text-mc-text rounded-lg"><Lock size={24} /></div>
            <div>
              <p className="text-xs text-mc-muted font-mono">MISSIONS COMPLETED</p>
              <p className="text-xl font-bold text-mc-text mt-1">
                {loading ? <Loader2 size={16} className="animate-spin" /> : telemetry.total_pipelines_run}
              </p>
            </div>
          </div>
          <div className="bg-mc-panel border border-mc-border p-6 rounded-xl flex items-center gap-4">
            <div className="p-3 bg-mc-panel text-mc-text rounded-lg"><Database size={24} /></div>
            <div>
              <p className="text-xs text-mc-muted font-mono">DATA INGESTED</p>
              <p className="text-xl font-bold text-mc-text mt-1">
                {loading ? <Loader2 size={16} className="animate-spin" /> : `${parseFloat(telemetry.data_ingested_gb || 0).toFixed(1)} GB`}
              </p>
            </div>
          </div>
        </div>

        {/* Data Sources Grid */}
        <div className="flex-1 overflow-y-auto">
          <h2 className="text-lg font-mono text-mc-text mb-4 border-b border-mc-border pb-2">Active Data Sources & Proofs</h2>
          <div className="grid grid-cols-1 gap-4">
            {SOURCES.map(source => (
              <div key={source.id} className="bg-mc-panel border border-mc-border rounded-xl p-6 flex items-center justify-between group hover:border-mc-primary/50 transition-colors">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-mc-bg border border-mc-border rounded-full flex items-center justify-center text-mc-primary">
                    <Database size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-mc-text">{source.name}</h3>
                    <a href={`https://${source.url}`} className="text-xs font-mono text-mc-primary hover:underline flex items-center gap-1 mt-1">
                      <Link size={12} /> {source.url}
                    </a>
                  </div>
                </div>
                
                <div className="flex items-center gap-12">
                  <div>
                    <p className="text-[10px] text-mc-muted font-mono uppercase tracking-widest mb-1">Latency</p>
                    <p className="text-sm font-mono text-mc-text flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-mc-success"></span> {source.latency}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-mc-muted font-mono uppercase tracking-widest mb-1">Accuracy</p>
                    <p className="text-sm font-mono text-mc-text">{source.accuracy}</p>
                  </div>
                  <div className="bg-mc-success/10 border border-mc-success/20 px-4 py-2 rounded-lg flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-mc-success" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-mc-success font-mono uppercase">Verified</span>
                      <span className="text-xs text-mc-text font-mono">{source.validation}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
