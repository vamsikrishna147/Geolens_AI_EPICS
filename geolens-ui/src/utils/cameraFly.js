/**
 * GeoLens AI - Camera & Viewport Synchronization Utility
 * ========================================================
 * Computes adaptive 3D globe camera altitude and 2D map zoom levels
 * based on place category, bounding box extents, and location hierarchy.
 */

export function getAdaptiveCameraView(item) {
  const type = (item?.type || '').toLowerCase();
  const name = (item?.display_name || item?.short_name || '').toLowerCase();
  const bbox = item?.bbox;

  let altitude = 0.42;
  let zoom = 12;

  // 1. Calculate from bounding box if available
  if (Array.isArray(bbox) && bbox.length === 4) {
    let latSpan = 0;
    let lonSpan = 0;

    // Photon extent format: [minLon, maxLat, maxLon, minLat]
    // Nominatim format: [minLat, maxLat, minLon, maxLon]
    if (typeof bbox[0] === 'number') {
      lonSpan = Math.abs(Number(bbox[2]) - Number(bbox[0]));
      latSpan = Math.abs(Number(bbox[1]) - Number(bbox[3]));
    } else {
      const b = bbox.map(Number);
      latSpan = Math.abs(b[1] - b[0]);
      lonSpan = Math.abs(b[3] - b[2]);
    }

    const maxSpan = Math.max(latSpan, lonSpan);

    if (maxSpan > 15) {
      altitude = 1.95; // Global / Continental
      zoom = 4;
    } else if (maxSpan > 6) {
      altitude = 1.35; // Large Country
      zoom = 6;
    } else if (maxSpan > 2) {
      altitude = 0.95; // State / Province
      zoom = 8;
    } else if (maxSpan > 0.6) {
      altitude = 0.60; // District / County
      zoom = 10;
    } else if (maxSpan > 0.15) {
      altitude = 0.32; // City / Metro
      zoom = 12;
    } else {
      altitude = 0.14; // Neighborhood / Street / POI
      zoom = 15;
    }
    return { altitude, zoom };
  }

  // 2. Infer from OpenStreetMap place type
  if (type === 'country') {
    altitude = 1.95;
    zoom = 4;
  } else if (['state', 'province', 'region'].includes(type)) {
    altitude = 1.05;
    zoom = 7;
  } else if (['county', 'district', 'administrative'].includes(type)) {
    altitude = 0.65;
    zoom = 9;
  } else if (['city', 'town', 'municipality'].includes(type)) {
    altitude = 0.35;
    zoom = 12;
  } else if (['village', 'suburb', 'hamlet', 'neighbourhood'].includes(type)) {
    altitude = 0.22;
    zoom = 13;
  } else if (['street', 'road', 'building', 'poi', 'amenity'].includes(type)) {
    altitude = 0.14;
    zoom = 15;
  } else {
    // 3. Fallback name heuristics
    if (name.includes('country') || name.includes('republic') || name.includes('ocean')) {
      altitude = 1.95;
      zoom = 4;
    } else if (name.includes('state') || name.includes('province')) {
      altitude = 1.05;
      zoom = 7;
    } else if (name.includes('district') || name.includes('county')) {
      altitude = 0.65;
      zoom = 9;
    } else {
      altitude = 0.35;
      zoom = 12;
    }
  }

  return { altitude, zoom };
}

/**
 * Executes a smooth glide flight of the 3D globe camera and broadcasts
 * the target location to all active panels and views.
 */
export function flyToTargetLocation(item, durationMs = 1400) {
  if (!item || typeof item.lat !== 'number' || typeof item.lon !== 'number') return;

  const { altitude, zoom } = getAdaptiveCameraView(item);

  // Smoothly flight the 3D globe camera
  if (window.__globe && typeof window.__globe.pointOfView === 'function') {
    window.__globe.pointOfView({ lat: item.lat, lng: item.lon, altitude }, durationMs);
  }

  // Broadcast event across Mission Console, TimeLens, and HUD
  window.dispatchEvent(new CustomEvent('target-location-selected', {
    detail: {
      name: item.short_name || item.display_name?.split(',')[0],
      displayName: item.display_name,
      lat: item.lat,
      lon: item.lon,
      altitude,
      zoom,
      type: item.type,
      bbox: item.bbox,
    }
  }));
}
