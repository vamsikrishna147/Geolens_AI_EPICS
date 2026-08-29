import React from 'react';
import { Globe, Map, FolderOpen, Clock } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const TABS = [
  { id: 'Mission Control',  Icon: Globe,      label: 'Mission Control'  },
  { id: 'Map & Analyzer',   Icon: Map,        label: 'Map & Analyzer'   },
  { id: 'TimeLens',         Icon: Clock,      label: 'TimeLens'         },
  { id: 'Workspace',        Icon: FolderOpen, label: 'Workspace'        },
];

function NavItem({ id, Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`group relative flex items-center p-3 rounded-xl transition-all duration-200 ${
        active
          ? 'bg-mc-primary/15 text-mc-primary shadow-[0_0_12px_rgba(47,129,247,0.2)]'
          : 'text-mc-muted hover:bg-mc-panel hover:text-mc-text'
      }`}
    >
      {/* Active indicator stripe */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-mc-primary rounded-r-full" />
      )}

      <Icon size={21} strokeWidth={1.6} />

      {/* Tooltip */}
      <span className="absolute left-14 skeuo-panel border border-mc-border px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-mc-text opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[200] shadow-xl">
        {label}
      </span>
    </button>
  );
}

export default function LeftNav({ activeTab, onTabChange }) {
  const { t } = useLanguage();

  return (
    <nav
      className="skeuo-panel p-2 flex flex-col gap-1.5 h-fit"
      aria-label="Main navigation"
    >
      {TABS.map(({ id, Icon, label }) => (
        <NavItem
          key={id}
          id={id}
          Icon={Icon}
          label={t(label)}
          active={activeTab === id}
          onClick={() => onTabChange(id)}
        />
      ))}
    </nav>
  );
}
