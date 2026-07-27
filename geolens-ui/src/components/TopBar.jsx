import React, { useState, useRef, useEffect } from 'react';
import { Activity, Satellite, User, Settings, Monitor, Moon, Sun, LogOut, Globe, Mail, Briefcase, Database, Folder, ShieldAlert } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export default function TopBar() {
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLang, setShowLang] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  
  const settingsRef = useRef(null);
  const profileRef = useRef(null);
  const langRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) setShowSettings(false);
      if (profileRef.current && !profileRef.current.contains(event.target)) setShowProfile(false);
      if (langRef.current && !langRef.current.contains(event.target)) setShowLang(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="flex justify-between items-center px-6 py-4 bg-mc-bg/80 backdrop-blur-sm border-b border-mc-border relative z-[100]">
      {/* Brand */}
      <div className="flex items-center gap-3">
        <Satellite className="text-mc-primary" size={24} />
        <h1 className="font-heading text-xl font-semibold tracking-wider text-mc-text">
          GeoLens<span className="text-mc-muted font-light">AI</span>
        </h1>
      </div>

      {/* Center Status */}
      <div className="flex items-center gap-6 text-sm font-mono text-mc-muted">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-mc-success animate-pulse-ring"></div>
          <span>{t('SYSTEM ONLINE')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-mc-primary" />
          <span>{t('REGION: GLOBAL')}</span>
        </div>
        <div className="flex items-center gap-2 text-mc-secondary">
          <span>{t('SOURCES: NASA, ESA, OSM')}</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4 text-mc-muted relative">
        {/* Language Dropdown */}
        <div className="relative" ref={langRef}>
          <button 
            onClick={() => setShowLang(!showLang)}
            className={`hover:text-mc-text transition-colors flex items-center gap-1 uppercase text-xs font-mono font-bold ${showLang ? 'text-mc-text' : ''}`}
          >
            <Globe size={18} /> {language}
          </button>
          
          {showLang && (
            <div className="absolute right-0 mt-4 w-40 bg-mc-panel border border-mc-border rounded-lg shadow-xl overflow-hidden py-1 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 text-xs font-mono text-mc-muted uppercase tracking-wider border-b border-mc-border">
                Language
              </div>
              <button onClick={() => { setLanguage('en'); setShowLang(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-mc-primary/20 ${language === 'en' ? 'text-mc-text bg-mc-primary/10' : 'text-mc-muted'}`}>English</button>
              <button onClick={() => { setLanguage('hi'); setShowLang(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-mc-primary/20 ${language === 'hi' ? 'text-mc-text bg-mc-primary/10' : 'text-mc-muted'}`}>हिंदी</button>
              <button onClick={() => { setLanguage('te'); setShowLang(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-mc-primary/20 ${language === 'te' ? 'text-mc-text bg-mc-primary/10' : 'text-mc-muted'}`}>తెలుగు</button>
              <button onClick={() => { setLanguage('ta'); setShowLang(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-mc-primary/20 ${language === 'ta' ? 'text-mc-text bg-mc-primary/10' : 'text-mc-muted'}`}>தமிழ்</button>
              <button onClick={() => { setLanguage('bn'); setShowLang(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-mc-primary/20 ${language === 'bn' ? 'text-mc-text bg-mc-primary/10' : 'text-mc-muted'}`}>বাংলা</button>
            </div>
          )}
        </div>
        
        {/* Settings Dropdown */}
        <div className="relative" ref={settingsRef}>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`hover:text-mc-text transition-colors ${showSettings ? 'text-mc-text' : ''}`}
          >
            <Settings size={18} />
          </button>
          
          {showSettings && (
            <div className="absolute right-0 mt-4 w-48 bg-mc-panel border border-mc-border rounded-lg shadow-xl overflow-hidden py-1 animate-in fade-in slide-in-from-top-2">
              <div className="px-3 py-2 text-xs font-mono text-mc-muted uppercase tracking-wider border-b border-mc-border">
                Theme Setting
              </div>
              <button 
                onClick={() => setTheme('system')}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-mc-primary/20 flex items-center gap-2 ${theme === 'system' ? 'text-mc-text bg-mc-primary/10' : 'text-mc-muted hover:text-mc-text'}`}
              >
                <Monitor size={14} /> System Default
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-mc-primary/20 flex items-center gap-2 ${theme === 'dark' ? 'text-mc-text bg-mc-primary/10' : 'text-mc-muted hover:text-mc-text'}`}
              >
                <Moon size={14} /> Dark Mission
              </button>
              <button 
                onClick={() => setTheme('light')}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-mc-primary/20 flex items-center gap-2 ${theme === 'light' ? 'text-mc-text bg-mc-primary/10' : 'text-mc-muted hover:text-mc-text'}`}
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
            <div className={`w-8 h-8 rounded border flex items-center justify-center transition-colors ${showProfile ? 'border-mc-primary bg-mc-primary/10 text-mc-primary' : 'border-mc-border bg-mc-panel'}`}>
              <User size={16} />
            </div>
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-4 w-80 bg-mc-panel skeuo-panel border border-mc-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
              {/* Header */}
              <div className="p-5 border-b border-mc-border bg-mc-bg/10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-mc-primary to-mc-secondary flex items-center justify-center text-white text-xl font-bold border-2 border-mc-border shadow-inner">
                    VK
                  </div>
                  <div>
                    <h3 className="text-mc-text font-semibold text-lg">Vamsi Krishna</h3>
                    <p className="text-mc-primary text-sm font-mono flex items-center gap-1">
                      <ShieldAlert size={14} /> GIS Commander
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-mc-muted">
                  <Mail size={14} /> vamsi.krishna@geolens.ai
                </div>
              </div>

              {/* Stats */}
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center bg-mc-bg/10 p-3 rounded-lg border border-mc-border/50">
                  <div className="flex items-center gap-2 text-sm text-mc-muted">
                    <Briefcase size={16} className="text-mc-secondary" /> Missions Completed
                  </div>
                  <span className="text-mc-text font-mono font-bold">47</span>
                </div>
                <div className="flex justify-between items-center bg-mc-bg/10 p-3 rounded-lg border border-mc-border/50">
                  <div className="flex items-center gap-2 text-sm text-mc-muted">
                    <Folder size={16} className="text-mc-success" /> Active Projects
                  </div>
                  <span className="text-mc-text font-mono font-bold">3</span>
                </div>
                <div className="flex justify-between items-center bg-mc-bg/10 p-3 rounded-lg border border-mc-border/50">
                  <div className="flex items-center gap-2 text-sm text-mc-muted">
                    <Database size={16} className="text-mc-warning" /> Data Processed
                  </div>
                  <span className="text-mc-text font-mono font-bold">2.4 TB</span>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-mc-border bg-mc-bg/20">
                <button className="w-full py-2 px-4 rounded-lg bg-mc-danger/10 text-mc-danger hover:bg-mc-danger hover:text-white border border-mc-danger/30 transition-all flex items-center justify-center gap-2 font-mono text-sm uppercase tracking-wider">
                  <LogOut size={16} /> Terminate Session
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
