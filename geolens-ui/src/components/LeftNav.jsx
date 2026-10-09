import React, { useState, useEffect, useRef } from 'react';
import { Globe, Map, FolderOpen, Clock, GripVertical } from 'lucide-react';
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
      className={`group relative w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
        active
          ? 'bg-mc-primary/15 text-mc-primary border border-mc-primary/30'
          : 'text-mc-muted hover:bg-mc-bg hover:text-mc-text border border-transparent'
      }`}
    >
      {/* Active indicator stripe */}
      {active && (
        <span className="absolute left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-mc-primary rounded-full" />
      )}

      <Icon size={21} strokeWidth={active ? 2.2 : 1.7} />

      {/* Tooltip */}
      <span className="absolute left-14 bg-mc-panel border border-mc-border px-3 py-1.5 rounded-lg text-[11px] font-body font-medium text-mc-text opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-[9999] shadow-lg">
        {label}
      </span>
    </button>
  );
}

export default function LeftNav({ activeTab, onTabChange }) {
  const { t } = useLanguage();

  // Draggable position state
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('geolens_dock_pos');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
    } catch (_) {}
    return { x: 18, y: 150 };
  });

  // Mobile collapsed state (allows user on small screens to fold the dock)
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 });

  const startDrag = (clientX, clientY) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      initialX: position.x,
      initialY: position.y,
    };
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return; // Left click only
    startDrag(e.clientX, e.clientY);
    e.preventDefault();
  };

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length > 0) {
      startDrag(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  useEffect(() => {
    const onMove = (clientX, clientY) => {
      if (!isDraggingRef.current) return;
      const dx = clientX - dragStartRef.current.mouseX;
      const dy = clientY - dragStartRef.current.mouseY;

      const maxX = Math.max(10, window.innerWidth - 65);
      const maxY = Math.max(60, window.innerHeight - 250);

      const newX = Math.max(10, Math.min(maxX, dragStartRef.current.initialX + dx));
      const newY = Math.max(60, Math.min(maxY, dragStartRef.current.initialY + dy));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseMove = (e) => onMove(e.clientX, e.clientY);
    const handleTouchMove = (e) => {
      if (isDraggingRef.current && e.touches && e.touches.length > 0) {
        onMove(e.touches[0].clientX, e.touches[0].clientY);
        if (e.cancelable) e.preventDefault();
      }
    };

    const endDrag = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        try {
          localStorage.setItem('geolens_dock_pos', JSON.stringify(position));
        } catch (_) {}
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', endDrag);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', endDrag);
    };
  }, [position]);

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        touchAction: 'none',
      }}
      className="pointer-events-auto select-none"
    >
      <nav
        className="glass-dock p-2 flex flex-col gap-1.5 h-fit shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-mc-border rounded-2xl transition-all"
        aria-label="Main navigation widget"
      >
        {/* Drag & Collapse Handle */}
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onDoubleClick={() => setIsCollapsed(c => !c)}
          className="flex items-center justify-between px-1 py-1 cursor-grab active:cursor-grabbing text-mc-muted hover:text-mc-primary transition-colors group"
          title="Drag dock or double tap to collapse"
        >
          <GripVertical size={14} className="opacity-50 group-hover:opacity-100" />
          <button 
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsCollapsed(c => !c); }}
            className="sm:hidden text-[9px] font-mono text-mc-muted hover:text-white px-1"
            title={isCollapsed ? 'Expand dock' : 'Collapse dock'}
          >
            {isCollapsed ? '+' : '−'}
          </button>
        </div>

        {!isCollapsed && (
          <>
            <div className="w-8 mx-auto h-px bg-mc-border/40 my-1" />

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
          </>
        )}
      </nav>
    </div>
  );
}
