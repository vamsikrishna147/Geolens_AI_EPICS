import React, { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import GlobeBackground from './components/GlobeBackground';
import TopBar from './components/TopBar';
import LeftNav from './components/LeftNav';
import RightConsole from './components/RightConsole';
import BottomCommand from './components/BottomCommand';
import ScientificReport from './components/ScientificReport';
import TimeLensCompare from './components/TimeLensCompare';
import MapLayersView from './views/MapLayersView';
import WorkspaceView from './views/WorkspaceView';

// Tab IDs must match LeftNav TABS
const TAB_MISSION   = 'Mission Control';
const TAB_MAP       = 'Map & Analyzer';
const TAB_TIMELENS  = 'TimeLens';
const TAB_WORKSPACE = 'Workspace';

function AppContent() {
  const [activeTab,   setActiveTab]   = useState(TAB_MISSION);
  const [showReport,  setShowReport]  = useState(false);
  const [showTimeLens, setShowTimeLens] = useState(false);
  const [mapInitialParams, setMapInitialParams] = useState(null);

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

  const isMission = activeTab === TAB_MISSION;

  return (
    <div className="relative w-screen h-screen overflow-hidden">

      {/* ── 3D Globe Background (always visible) ── */}
      <div className="absolute inset-0 z-0">
        <GlobeBackground />
      </div>

      {/* ── Full-screen view overlays ── */}
      {activeTab === TAB_MAP && (
        <MapLayersView onBack={() => setActiveTab(TAB_MISSION)} initialParams={mapInitialParams} />
      )}
      {activeTab === TAB_TIMELENS && (
        <TimeLensCompare onClose={() => setActiveTab(TAB_MISSION)} />
      )}
      {activeTab === TAB_WORKSPACE && (
        <WorkspaceView onBack={() => setActiveTab(TAB_MISSION)} />
      )}

      {/* ── Modal overlays (triggered from right console) ── */}
      {showReport && (
        <div className="absolute inset-0 z-50">
          <ScientificReport onClose={() => setShowReport(false)} />
        </div>
      )}
      {showTimeLens && activeTab !== TAB_TIMELENS && (
        <div className="absolute inset-0 z-50">
          <TimeLensCompare onClose={() => setShowTimeLens(false)} />
        </div>
      )}

      {/* ── HUD Overlay (always on top of globe) ── */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">

        {/* Top bar */}
        <div className="pointer-events-auto shrink-0">
          <TopBar />
        </div>

        {/* Middle row: LeftNav + center (globe) + RightConsole */}
        <div className="flex-1 min-h-0 flex items-stretch px-4 py-2 gap-4">

          <div className="pointer-events-auto flex items-center z-[100] shrink-0">
            <LeftNav activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          {/* Globe lives here — centre is kept empty for the 3D earth */}
          <div className="flex-1" />

          <div className="pointer-events-auto flex items-center z-50 shrink-0">
            {isMission && <RightConsole />}
          </div>
        </div>

        {/* Bottom command bar */}
        <div className="pointer-events-auto flex justify-center pb-4 shrink-0 z-50">
          {isMission && <BottomCommand />}
        </div>

      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
