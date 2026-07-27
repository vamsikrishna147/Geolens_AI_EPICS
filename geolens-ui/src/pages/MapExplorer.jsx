import React from 'react';
import MapLayersView from '../views/MapLayersView';

export default function MapExplorer() {
  return (
    <div className="w-full h-full relative overflow-hidden">
      <MapLayersView />
    </div>
  );
}
