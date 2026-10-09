import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Satellite, Compass, ArrowLeft, Globe, Map, Clock, ShieldAlert } from 'lucide-react';

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="w-screen h-screen bg-mc-bg text-mc-text flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
      {/* Background Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle, #F59E0B 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      {/* Decorative Radar Sweep Rings */}
      <div className="absolute w-[500px] h-[500px] rounded-full border border-mc-border/30 pointer-events-none animate-pulse" />
      <div className="absolute w-[320px] h-[320px] rounded-full border border-amber-500/10 pointer-events-none" />

      {/* Central Tactical Error Card */}
      <div className="relative z-10 max-w-lg w-full bg-mc-panel/95 backdrop-blur-md border border-mc-border rounded-2xl p-8 shadow-2xl text-center space-y-6">
        
        {/* Top Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-[11px] tracking-wider uppercase">
          <ShieldAlert size={14} className="text-amber-500" />
          <span>Sector Not Found · Error 404</span>
        </div>

        {/* Tactical Telemetry Badge & Number */}
        <div className="space-y-2">
          <h1 className="font-mono text-7xl sm:text-8xl font-black text-amber-500 tracking-tighter">
            404
          </h1>
          <h2 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-mc-text uppercase">
            Orbital Telemetry Lost
          </h2>
          <p className="font-body text-xs sm:text-sm text-mc-muted leading-relaxed max-w-sm mx-auto">
            The requested coordinate sector or navigation endpoint does not exist within the active GeoLens Earth observation envelope.
          </p>
        </div>

        {/* Target Path Monospace Box */}
        <div className="bg-mc-bg/90 border border-mc-border/80 rounded-xl p-3 font-mono text-xs flex items-center justify-between text-mc-muted">
          <span className="text-[10px] uppercase tracking-wider text-mc-secondary">Target Sector:</span>
          <span className="text-amber-400 font-semibold truncate ml-2">
            {location.pathname || 'unknown'}
          </span>
        </div>

        {/* Navigation Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Link
            to="/"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl skeuo-button-primary font-mono text-xs tracking-wider font-semibold transition-all shadow-md group cursor-pointer"
          >
            <Globe size={15} className="group-hover:rotate-45 transition-transform" />
            <span>MISSION CONTROL</span>
          </Link>

          <Link
            to="/timelens"
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl skeuo-button font-mono text-xs tracking-wider transition-all cursor-pointer text-mc-text hover:text-white"
          >
            <Clock size={15} className="text-amber-500" />
            <span>LAUNCH TIMELENS</span>
          </Link>
        </div>

        {/* Quick Links Footer */}
        <div className="border-t border-mc-border/60 pt-4 flex justify-center items-center gap-4 text-xs font-mono text-mc-muted">
          <Link to="/map-explorer" className="hover:text-amber-400 transition-colors flex items-center gap-1">
            <Map size={12} /> Map & Analyzer
          </Link>
          <span>·</span>
          <Link to="/admin" className="hover:text-amber-400 transition-colors flex items-center gap-1">
            <Compass size={12} /> Admin Console
          </Link>
        </div>

      </div>

      {/* Bottom Telemetry Footer */}
      <div className="relative z-10 mt-8 font-mono text-[10px] text-mc-muted tracking-widest uppercase">
        GEOLENS AI OS // SEC_404_TELEMETRY_UNREACHABLE
      </div>
    </div>
  );
}
