import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import GlobeBackground from './components/GlobeBackground';
import TopBar from './components/TopBar';
import LeftNav from './components/LeftNav';
import RightConsole from './components/RightConsole';
import BottomCommand from './components/BottomCommand';
import ScientificReport from './components/ScientificReport';
import TimeLensCompare from './components/TimeLensCompare';

// Premium Views
import MapLayersView from './views/MapLayersView';
import DataValidationView from './views/DataValidationView';
import WorkspaceView from './views/WorkspaceView';

function AppContent() {
  const [showReport, setShowReport] = useState(false);
  const [showTimeLens, setShowTimeLens] = useState(false);
  const [activeTab, setActiveTab] = useState('Mission Control');

  useEffect(() => {
    const handleShowReport = () => setShowReport(true);
    const handleShowTimeLens = () => setShowTimeLens(true);
    
    // Also listen to MissionContext resets to hide them
    const handleHideAll = () => {
      setShowReport(false);
      setShowTimeLens(false);
      setActiveTab('Mission Control');
    };

    window.addEventListener('show-report', handleShowReport);
    window.addEventListener('show-timelens', handleShowTimeLens);
    window.addEventListener('hide-modals', handleHideAll);

    return () => {
      window.removeEventListener('show-report', handleShowReport);
      window.removeEventListener('show-timelens', handleShowTimeLens);
      window.removeEventListener('hide-modals', handleHideAll);
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* 3D Earth Background */}
      <div className="absolute inset-0 z-0">
        <GlobeBackground />
      </div>

      {/* Premium Views Overlay */}
      {activeTab === 'Map Layers' && <MapLayersView onBack={() => setActiveTab('Mission Control')} />}
      {activeTab === 'Data & Validation' && <DataValidationView onBack={() => setActiveTab('Mission Control')} />}
      {activeTab === 'Workspace' && <WorkspaceView onBack={() => setActiveTab('Mission Control')} />}
      {activeTab === 'TimeLens Analysis' && (
        <TimeLensCompare onClose={() => setActiveTab('Mission Control')} />
      )}

      {/* Overlays for modal popups from commands */}
      {showReport && (
        <div className="absolute inset-0 z-50">
          <ScientificReport onClose={() => setShowReport(false)} />
        </div>
      )}
      
      {showTimeLens && activeTab !== 'TimeLens Analysis' && (
        <div className="absolute inset-0 z-50">
          <TimeLensCompare onClose={() => setShowTimeLens(false)} />
        </div>
      )}

      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between">
        
        {/* Top Header */}
        <div className="pointer-events-auto">
          <TopBar />
        </div>

        {/* Main Interface */}
        <div className="flex-1 min-h-0 flex justify-between items-stretch px-4 pb-2">
          
          {/* Left Navigation */}
          <div className="pointer-events-auto flex items-center z-[100]">
            <LeftNav activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          {/* Center */}
          <div className="flex-1" />

          {/* Right AI Mission Console (Only visible on Mission Control tab) */}
          <div className="pointer-events-auto flex items-center transition-opacity duration-300 z-50">
            {activeTab === 'Mission Control' && <RightConsole />}
          </div>
        </div>

        {/* Bottom Command (Only visible on Mission Control tab) */}
        <div className="pointer-events-auto w-full flex justify-center pb-4 transition-opacity duration-300 z-50">
          {activeTab === 'Mission Control' && <BottomCommand />}
        </div>

      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
