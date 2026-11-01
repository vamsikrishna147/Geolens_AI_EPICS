import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Activity, X } from 'lucide-react';
import { useMission } from './context/MissionContext';
import GlobeBackground from './components/GlobeBackground';
import TopBar from './components/TopBar';
import LeftNav from './components/LeftNav';
import RightConsole from './components/RightConsole';
import BottomCommand from './components/BottomCommand';
import ScientificReport from './components/ScientificReport';
import TimeLensCompare from './components/TimeLensCompare';
import MapLayersView from './views/MapLayersView';
import WorkspaceView from './views/WorkspaceView';
import AdminPortal from './pages/AdminPortal';
import GovPapers from './pages/GovPapers';
import NotFound from './pages/NotFound';
import ErrorBoundary from './components/ErrorBoundary';

// Tab IDs must match LeftNav TABS
const TAB_MISSION   = 'Mission Control';
const TAB_MAP       = 'Map & Analyzer';
const TAB_TIMELENS  = 'TimeLens';
const TAB_WORKSPACE = 'Workspace';

function AppContent({ initialTab = TAB_MISSION, initialReport = false }) {
  const { executeDirective } = useMission();
  const [activeTab,   setActiveTab]   = useState(initialTab);
  const [showReport,  setShowReport]  = useState(initialReport);
  const [showTimeLens, setShowTimeLens] = useState(false);
  const [mapInitialParams, setMapInitialParams] = useState(null);
  const [showMobileConsole, setShowMobileConsole] = useState(false);

  // Listen for events fired by RightConsole post-mission buttons and BottomCommand
  React.useEffect(() => {
    const onReport   = () => setShowReport(true);
    const onTimeLens = () => setShowTimeLens(true);
    const onHideAll  = () => { setShowReport(false); setShowTimeLens(false); setActiveTab(TAB_MISSION); };
    
    const onRetrieveImagery = (e) => {
      setMapInitialParams(e.detail);
      setActiveTab(TAB_MAP);
    };

    window.addEventListener('show-report',   onReport);
    window.addEventListener('show-timelens', onTimeLens);
    window.addEventListener('hide-modals',   onHideAll);
    window.addEventListener('retrieve-imagery', onRetrieveImagery);

    return () => {
      window.removeEventListener('show-report',   onReport);
      window.removeEventListener('show-timelens', onTimeLens);
      window.removeEventListener('hide-modals',   onHideAll);
      window.removeEventListener('retrieve-imagery', onRetrieveImagery);
    };
  }, []);

  const handleTabChange = (newTab) => {
    setShowReport(false);
    setShowTimeLens(false);
    setActiveTab(newTab);
  };

  const isMission = activeTab === TAB_MISSION && !showTimeLens && !showReport;

  return (
    <div className="relative w-screen h-screen overflow-hidden">

      {/* ── Permanent Floating Navigation Widget (Draggable, overrides all pages & modals) ── */}
      <LeftNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* ── 3D Globe Background (always visible in background) ── */}
      <div className="absolute inset-0 z-0" data-tour="globe">
        <GlobeBackground />
      </div>

      {/* ── View Overlays (Context preserved in sessionStorage) ── */}
      {activeTab === TAB_MAP && (
        <div className="absolute inset-0 z-40">
          <MapLayersView onBack={() => handleTabChange(TAB_MISSION)} initialParams={mapInitialParams} />
        </div>
      )}

      {(activeTab === TAB_TIMELENS || showTimeLens) && (
        <div className="absolute inset-0 z-40">
          <TimeLensCompare onClose={() => handleTabChange(TAB_MISSION)} />
        </div>
      )}

      {activeTab === TAB_WORKSPACE && (
        <div className="absolute inset-0 z-40">
          <WorkspaceView onBack={() => handleTabChange(TAB_MISSION)} />
        </div>
      )}

      {/* ── Modal overlays (triggered from right console) ── */}
      {showReport && (
        <div className="absolute inset-0 z-[60]">
          <ScientificReport onClose={() => setShowReport(false)} />
        </div>
      )}

      {/* ── HUD Overlay (always on top of globe) ── */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">

        {/* Top bar */}
        <div className="pointer-events-auto shrink-0">
          <TopBar />
        </div>

        {/* Middle row: Spacer + Center (globe) + RightConsole */}
        <div className="flex-1 min-h-0 flex items-stretch px-2 sm:px-4 py-2 gap-2 sm:gap-4 relative">

          {/* Left spacing for the floating navigation widget */}
          <div className="w-16 shrink-0 hidden sm:block pointer-events-none" />

          {/* Globe lives here — centre is kept empty for the 3D earth */}
          <div className="flex-1" />

          {/* Mobile Console Toggle Button */}
          {isMission && (
            <div className="md:hidden pointer-events-auto absolute top-4 right-3 z-50">
              <button
                onClick={() => setShowMobileConsole(s => !s)}
                className="px-3 py-1.5 rounded-lg bg-mc-panel border border-mc-border text-mc-primary shadow-md flex items-center gap-1.5 font-mono text-xs cursor-pointer"
              >
                <Activity size={14} />
                <span>{showMobileConsole ? 'CLOSE' : 'CONSOLE'}</span>
              </button>
            </div>
          )}

          {/* RightConsole (desktop) */}
          <div className="pointer-events-auto hidden md:flex items-center z-50 shrink-0">
            {isMission && <RightConsole />}
          </div>
        </div>

        {/* Mobile Slide-over Console Drawer */}
        {isMission && showMobileConsole && (
          <div className="md:hidden fixed inset-0 z-[150] bg-black/70 flex justify-end animate-in fade-in">
            <div className="w-80 max-w-[88vw] h-full pointer-events-auto bg-mc-panel p-3 flex flex-col shadow-2xl border-l border-mc-border">
              <div className="flex justify-between items-center pb-2 mb-2 border-b border-mc-border">
                <span className="font-heading text-xs font-bold text-mc-text uppercase">Mission Intelligence</span>
                <button 
                  onClick={() => setShowMobileConsole(false)} 
                  className="text-mc-muted hover:text-white p-1 rounded bg-mc-bg border border-mc-border text-xs cursor-pointer"
                  title="Close Console"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <RightConsole />
              </div>
            </div>
          </div>
        )}

        {/* Bottom command bar */}
        <div className="pointer-events-auto flex justify-center pb-3 sm:pb-4 px-2 sm:px-4 shrink-0 z-50">
          {isMission && <BottomCommand />}
        </div>

      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<AppContent />} />
          <Route path="/map-explorer" element={<AppContent initialTab={TAB_MAP} />} />
          <Route path="/map" element={<AppContent initialTab={TAB_MAP} />} />
          <Route path="/timelens" element={<AppContent initialTab={TAB_TIMELENS} />} />
          <Route path="/workspace" element={<AppContent initialTab={TAB_WORKSPACE} />} />
          <Route path="/reports" element={<AppContent initialReport={true} />} />
          <Route path="/gov-papers" element={<div className="w-screen h-screen overflow-hidden"><GovPapers /></div>} />
          <Route path="/satellite-data" element={<AppContent initialTab={TAB_MAP} />} />
          <Route path="/admin" element={<AdminPortal />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
