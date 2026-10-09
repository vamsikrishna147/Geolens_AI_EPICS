import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Satellite, User, Settings, Monitor, Moon, Sun, LogOut, Globe, Mail, Briefcase, Database, Folder, ShieldAlert, ShieldCheck, Search, MapPin, Loader2, FileText } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { useMission } from '../context/MissionContext';
import { API_BASE_URL } from '../config/api';
import { flyToTargetLocation } from '../utils/cameraFly';

export default function TopBar() {
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { isExecuting, finalReport } = useMission();

  // Omnibar State
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  
  const settingsRef = useRef(null);
  const profileRef = useRef(null);
  const langRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) setShowSettings(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setShowProfile(false);
      if (langRef.current && !langRef.current.contains(event.target)) setShowLang(false);
      if (searchRef.current && !searchRef.current.contains(event.target)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K to focus omnibar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced geocoder autocomplete suggestions
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/geocoder/suggestions?q=${encodeURIComponent(searchQuery.trim())}&lang=${encodeURIComponent(language || 'en')}`);
        const data = await res.json();
        if (data && data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
          setShowSuggestions(true);
        } else {
          setSuggestions([]);
        }
      } catch (_) {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery, language]);

  // Handle location selection from omnibar
  const handleSelectPlace = (item) => {
    setSearchQuery(item.short_name || item.display_name);
    setShowSuggestions(false);
    setShowMobileSearch(false);

    // Adaptive Click-to-Fly with accurate altitude and coordinate sync
    flyToTargetLocation(item, 1400);
  };

  return (
    <header className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 bg-mc-bg/80 backdrop-blur-sm border-b border-mc-border/60 relative z-[100]">
      {/* Brand */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Satellite className="text-mc-primary" size={22} />
        <h1 className="font-heading text-lg sm:text-xl font-bold tracking-tight text-mc-text">
          GeoLens<span className="text-mc-primary font-light">AI</span>
        </h1>
        <div className="hidden md:block w-1 h-1 rounded-full bg-mc-border ml-2" />
      </div>

      {/* Center: Interactive Target Navigator & Mission Status Omnibar (User POV) */}
      <div className="hidden md:flex items-center justify-center flex-1 max-w-md lg:max-w-lg mx-3 lg:mx-6 relative" ref={searchRef}>
        {isExecuting ? (
          /* Live Mission Status Pill when running */
          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs shadow-sm w-full justify-center animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="font-semibold tracking-wider uppercase">Running Intelligence Pipeline...</span>
          </div>
        ) : finalReport ? (
          /* Report Ready Quick Jump Pill */
          <div className="flex items-center gap-2 w-full">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('show-report'))}
              className="flex-1 flex items-center justify-between px-3.5 py-1.5 rounded-lg bg-mc-panel border border-amber-500/40 text-amber-400 hover:text-white hover:bg-amber-500/20 text-xs font-mono font-semibold transition-all cursor-pointer shadow-sm group"
              title="Click to open the generated official intelligence assessment report"
            >
              <div className="flex items-center gap-2 truncate">
                <FileText size={13} className="text-amber-500 group-hover:scale-110 transition-transform shrink-0" />
                <span className="truncate">
                  REPORT READY: {finalReport.analysis_plan?.location || finalReport.official_report?.title || 'ASSESSMENT'}
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 group-hover:text-white shrink-0 ml-2">
                VIEW →
              </span>
            </button>
          </div>
        ) : (
          /* Global Target Search & Fly-To Jump Bar */
          <div className="w-full relative">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-mc-panel border border-mc-border hover:border-mc-primary/60 focus-within:border-mc-primary rounded-lg text-xs transition-all shadow-sm">
              <MapPin size={13} className="text-mc-primary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                placeholder="Jump to place or coordinates... (Ctrl+K)"
                className="w-full bg-transparent text-mc-text outline-none placeholder:text-mc-muted/60 font-body text-xs"
              />
              {isSearching && <Loader2 size={12} className="animate-spin text-mc-primary shrink-0" />}
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSuggestions([]); }}
                  className="text-mc-muted hover:text-white px-1 cursor-pointer text-xs"
                  title="Clear search"
                >
                  ✕
                </button>
              ) : (
                <kbd className="hidden lg:inline px-1.5 py-0.5 text-[9px] font-mono text-mc-muted bg-mc-bg/80 border border-mc-border/80 rounded">
                  Ctrl+K
                </kbd>
              )}
            </div>

            {/* Suggestions Popover */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 top-full mt-1.5 w-full bg-mc-panel/95 backdrop-blur-md border border-mc-border rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.7)] overflow-hidden z-[200] divide-y divide-mc-border/40 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[9px] font-mono text-mc-muted uppercase tracking-wider flex items-center justify-between bg-mc-bg/60">
                  <span>Locations Found ({suggestions.length})</span>
                  <span className="text-mc-primary font-bold">Fly 3D Camera</span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {suggestions.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPlace(item)}
                      className="w-full px-3 py-2 text-left hover:bg-mc-primary/15 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin size={12} className="text-mc-primary shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-body text-mc-text font-medium truncate">
                          {item.short_name || item.display_name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-mc-muted shrink-0">
                        {item.lat?.toFixed(2)}, {item.lon?.toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-4 text-mc-muted relative">
        {/* Mobile Omnibar Search Button */}
        <button
          type="button"
          onClick={() => setShowMobileSearch(true)}
          className="md:hidden flex items-center justify-center p-2 rounded-lg bg-mc-panel border border-mc-border text-mc-muted hover:text-mc-primary transition-colors cursor-pointer"
          title="Search Target Location"
          aria-label="Search Target Location"
        >
          <Search size={15} />
        </button>

        {/* Admin Portal Switcher */}
        <Link 
          to="/admin" 
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-mc-panel border border-mc-border hover:border-mc-primary text-[11px] font-mono text-mc-text hover:text-white transition-colors"
          title="Switch to Admin Intelligence Console"
        >
          <ShieldCheck size={14} className="text-mc-primary" />
          <span className="hidden sm:inline font-bold">ADMIN</span>
        </Link>
        {/* Language Dropdown */}
        <div className="relative" ref={langRef}>
          <button 
            onClick={() => setShowLang(!showLang)}
            className={`glow-pill px-3 py-1.5 rounded-lg text-[11px] cursor-pointer hover:text-mc-text transition-colors flex items-center gap-1 uppercase font-mono font-bold ${showLang ? 'text-mc-text' : ''}`}
          >
            <Globe size={18} /> {language}
          </button>
          
          {showLang && (
            <div className="absolute right-0 mt-4 w-40 dropdown-menu overflow-hidden py-1 z-50">
              <div className="px-3 py-2 text-[11px] font-mono text-mc-muted uppercase tracking-wider border-b border-mc-border mb-1">
                Language
              </div>
              <button onClick={() => { setLanguage('en'); setShowLang(false); }} className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${language === 'en' ? 'dropdown-item active' : 'dropdown-item'}`}>English</button>
              <button onClick={() => { setLanguage('hi'); setShowLang(false); }} className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${language === 'hi' ? 'dropdown-item active' : 'dropdown-item'}`}>हिंदी</button>
              <button onClick={() => { setLanguage('te'); setShowLang(false); }} className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${language === 'te' ? 'dropdown-item active' : 'dropdown-item'}`}>తెలుగు</button>
              <button onClick={() => { setLanguage('ta'); setShowLang(false); }} className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${language === 'ta' ? 'dropdown-item active' : 'dropdown-item'}`}>தமிழ்</button>
              <button onClick={() => { setLanguage('bn'); setShowLang(false); }} className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${language === 'bn' ? 'dropdown-item active' : 'dropdown-item'}`}>বাংলা</button>
            </div>
          )}
        </div>
        
        {/* Settings Dropdown */}
        <div className="relative" ref={settingsRef}>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`glow-pill p-2 rounded-lg cursor-pointer hover:text-mc-text transition-colors flex items-center justify-center ${showSettings ? 'text-mc-text' : ''}`}
          >
            <Settings size={18} />
          </button>
          
          {showSettings && (
            <div className="absolute right-0 mt-4 w-48 dropdown-menu overflow-hidden py-1 z-50">
              <div className="px-3 py-2 text-[11px] font-mono text-mc-muted uppercase tracking-wider border-b border-mc-border mb-1">
                Theme Setting
              </div>
              <button 
                onClick={() => setTheme('system')}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${theme === 'system' ? 'dropdown-item active' : 'dropdown-item'}`}
              >
                <Monitor size={14} /> System Default
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${theme === 'dark' ? 'dropdown-item active' : 'dropdown-item'}`}
              >
                <Moon size={14} /> Dark Mission
              </button>
              <button 
                onClick={() => setTheme('light')}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${theme === 'light' ? 'dropdown-item active' : 'dropdown-item'}`}
              >
                <Sun size={14} /> Light Mode
              </button>
            </div>
          )}
        </div>

        {/* Profile Dropdown / Dashboard */}
        <div className="relative" ref={profileRef}>
          <button 
            onClick={() => setShowProfile(!showProfile)}
            className="hover:text-mc-text transition-colors flex items-center gap-2"
          >
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${showProfile ? 'border-mc-primary bg-mc-primary/10 text-mc-primary' : 'border-mc-border bg-mc-panel'}`}>
              <User size={16} />
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-4 w-80 dropdown-menu overflow-hidden z-50">
              {/* Header */}
              <div className="p-5 border-b border-mc-border bg-mc-panel">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-mc-bg flex items-center justify-center text-white text-xl font-bold border border-mc-border">
                    VK
                  </div>
                  <div>
                    <h3 className="text-mc-text font-semibold text-lg font-heading">Vamsi Krishna</h3>
                    <p className="text-mc-primary text-[11px] font-mono flex items-center gap-1 mt-1">
                      <ShieldAlert size={14} /> GIS Commander
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-mc-muted">
                  <Mail size={14} /> vamsi.krishna@geolens.ai
                </div>
              </div>

              {/* Stats */}
              <div className="p-5 space-y-3 bg-mc-panel">
                <div className="flex justify-between items-center bg-mc-bg p-3 rounded-lg border border-mc-border">
                  <div className="flex items-center gap-2 text-sm text-mc-muted">
                    <Briefcase size={16} className="text-mc-secondary" /> Missions Completed
                  </div>
                  <span className="text-mc-text font-mono font-bold">47</span>
                </div>
                <div className="flex justify-between items-center bg-mc-bg p-3 rounded-lg border border-mc-border">
                  <div className="flex items-center gap-2 text-sm text-mc-muted">
                    <Folder size={16} className="text-mc-success" /> Active Projects
                  </div>
                  <span className="text-mc-text font-mono font-bold">3</span>
                </div>
                <div className="flex justify-between items-center bg-mc-bg p-3 rounded-lg border border-mc-border">
                  <div className="flex items-center gap-2 text-sm text-mc-muted">
                    <Database size={16} className="text-mc-warning" /> Data Processed
                  </div>
                  <span className="text-mc-text font-mono font-bold">2.4 TB</span>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-mc-border bg-mc-panel">
                <button className="w-full py-2 px-4 rounded-lg bg-mc-danger/10 text-mc-danger hover:bg-mc-danger hover:text-white border border-mc-danger/30 transition-colors flex items-center justify-center gap-2 font-mono text-[11px] uppercase tracking-wider">
                  <LogOut size={16} /> Terminate Session
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Mobile Search Modal Overlay */}
      {showMobileSearch && (
        <div className="md:hidden fixed inset-0 z-[200] bg-black/85 backdrop-blur-md p-4 flex flex-col animate-in fade-in">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-mc-muted" size={16} />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search country, city, coordinates..."
                className="w-full bg-mc-panel border border-mc-border focus:border-mc-primary rounded-xl pl-10 pr-9 py-2.5 text-sm text-mc-text placeholder:text-mc-muted/50 outline-none"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-mc-primary" size={16} />
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowMobileSearch(false)}
              className="px-3.5 py-2.5 rounded-xl bg-mc-panel border border-mc-border text-xs text-mc-muted hover:text-white cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {/* Mobile suggestions list */}
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPlace(item)}
                className="w-full p-3 rounded-xl bg-mc-panel/90 border border-mc-border/80 text-left flex items-center justify-between gap-2.5 hover:border-mc-primary/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MapPin size={15} className="text-mc-primary shrink-0" />
                  <div className="truncate">
                    <div className="text-xs font-semibold text-mc-text truncate">
                      {item.short_name || item.display_name}
                    </div>
                    {item.state || item.country ? (
                      <div className="text-[10px] text-mc-muted truncate">
                        {[item.state, item.country].filter(Boolean).join(', ')}
                      </div>
                    ) : null}
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-mc-primary shrink-0 uppercase px-2 py-0.5 rounded bg-mc-primary/10 border border-mc-primary/20">
                  {item.type || 'FLY'} →
                </span>
              </button>
            ))}
            {searchQuery.trim().length >= 2 && suggestions.length === 0 && !isSearching && (
              <div className="p-6 text-center text-xs text-mc-muted font-mono">
                No orbital coordinates found for "{searchQuery}"
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
