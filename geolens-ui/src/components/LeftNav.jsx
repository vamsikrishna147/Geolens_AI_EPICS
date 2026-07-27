import React, { useState } from 'react';
import { Globe, Layers, Database, FolderGit2, FileText, History } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`group relative flex items-center p-3 rounded-lg transition-colors ${active ? 'skeuo-button text-mc-primary' : 'text-mc-muted hover:bg-mc-panel hover:text-mc-text'}`}
  >
    <Icon size={22} strokeWidth={1.5} />
    <span className="absolute left-14 skeuo-panel border border-mc-border px-3 py-1.5 rounded text-sm font-body font-medium text-mc-text opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
      {label}
    </span>
  </button>
);

export default function LeftNav({ activeTab, onTabChange }) {
  const { t } = useLanguage();

  return (
    <nav className="skeuo-panel p-2 flex flex-col gap-2 h-fit max-h-full overflow-y-auto overflow-x-hidden z-[100]">
      <NavItem icon={Globe} label={t('Mission Control')} active={activeTab === 'Mission Control'} onClick={() => onTabChange('Mission Control')} />
      <NavItem icon={Layers} label={t('Map Layers')} active={activeTab === 'Map Layers'} onClick={() => onTabChange('Map Layers')} />
      <NavItem icon={Database} label={t('Data & Validation')} active={activeTab === 'Data & Validation'} onClick={() => onTabChange('Data & Validation')} />
      <NavItem icon={FolderGit2} label={t('Workspace')} active={activeTab === 'Workspace'} onClick={() => onTabChange('Workspace')} />
      <div className="w-full h-px bg-mc-border my-2" />
      <NavItem icon={History} label={t('TimeLens Analysis')} active={activeTab === 'TimeLens Analysis'} onClick={() => onTabChange('TimeLens Analysis')} />
    </nav>
  );
}
