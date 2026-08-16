import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Box, Typography, IconButton } from '@mui/material';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import CloseIcon from '@mui/icons-material/Close';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import NearMeIcon from '@mui/icons-material/NearMe';

// CARTO Voyager High-DPI Style (Google Maps-like vector street design, road hierarchy, POIs)
const CARTO_VOYAGER_STYLE = {
  version: 8,
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: 'carto-voyager-layer',
      type: 'raster',
      source: 'carto-voyager',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

const BENGALURU_LNG_LAT = [77.5946, 12.9716]; // [lng, lat] Central Bengaluru

/* ── Robust Coordinate Converter ── */
export function toLngLat(coord) {
  if (!coord) return null;
  if (Array.isArray(coord) && coord.length >= 2) {
    if (coord[0] < 50 && coord[1] > 50) return [Number(coord[1]), Number(coord[0])];
    return [Number(coord[0]), Number(coord[1])];
  }
  const lat = coord.latitude ?? coord.location_lat ?? coord.lat;
  const lng = coord.longitude ?? coord.location_lng ?? coord.lng;
  if (lat != null && lng != null) {
    return [Number(lng), Number(lat)];
  }
  return null;
}

/* ── Great-Circle Haversine Distance (in meters) ── */
export function calculateDistanceMeters(coord1, coord2) {
  if (!coord1 || !coord2) return 0;
  const R = 6371e3;
  const φ1 = (coord1[1] * Math.PI) / 180;
  const φ2 = (coord2[1] * Math.PI) / 180;
  const Δφ = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const Δλ = ((coord2[0] - coord1[0]) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ── Geographic Heading / Bearing Calculator ── */
export function calculateBearing(coord1, coord2) {
  if (!coord1 || !coord2) return 0;
  const lon1 = (coord1[0] * Math.PI) / 180;
  const lat1 = (coord1[1] * Math.PI) / 180;
  const lon2 = (coord2[0] * Math.PI) / 180;
  const lat2 = (coord2[1] * Math.PI) / 180;

  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/* ── DOM Element Creators for MapLibre Markers ── */
function createAmbulanceDomElement(amb) {
  const wrapper = document.createElement('div');
  wrapper.className = `maplibre-ambulance-wrapper amb-node-${amb.id}`;
  wrapper.style.cursor = 'pointer';

  const status = amb.status || 'AVAILABLE';
  const moving = ['EN_ROUTE', 'TRANSPORTING'].includes(status);
  const isStale = amb.last_ping && (Date.now() - amb.last_ping > 30000);

  const color = isStale
    ? '#94A3B8'
    : status === 'EN_ROUTE'
    ? '#F97316'
    : status === 'TRANSPORTING'
    ? '#3B82F6'
    : status === 'ON_SCENE'
    ? '#EF4444'
    : '#10B981';

  const callsign = amb.call_sign || amb.vehicle_number || amb.id || 'AMB';

  const inner = document.createElement('div');
  inner.style.display = 'flex';
  inner.style.flexDirection = 'column';
  inner.style.alignItems = 'center';
  inner.style.pointerEvents = 'auto';

  inner.innerHTML = `
    <!-- Dynamic Live Status & Callsign Badge -->
    <div class="amb-live-badge" style="
      background:#0F172A;color:#FFFFFF;padding:2.5px 8px;border-radius:12px;
      font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.35);
      margin-bottom:-4px;z-index:10;border:1.5px solid #FFFFFF;letter-spacing:0.3px;font-family:'Inter',sans-serif;
    ">
      ${callsign} ${isStale ? '⚠️ OFFLINE' : (moving ? '• EN ROUTE' : '• STANDBY')}
    </div>

    <!-- Google Pin Circle with Drop-Shadow & Rotatable Vehicle Icon -->
    <div style="
      position:relative;width:38px;height:38px;border-radius:50%;
      background:${color};border:3px solid #FFFFFF;
      box-shadow:0 4px 14px rgba(0,0,0,0.38);
      display:flex;align-items:center;justify-content:center;
      transition:all 0.3s ease;
    ">
      ${moving ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:0.6;animation:amb-pulse 1.2s infinite"></div>` : ''}
      <div class="vehicle-icon-rotator" style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;transition:transform 0.15s linear;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="6" width="14" height="11" rx="2" fill="white"/>
          <path d="M17 9l4 2v6h-4V9z" fill="white"/>
          <circle cx="7.5" cy="17.5" r="2.5" fill="#0F172A"/>
          <circle cx="17.5" cy="17.5" r="2.5" fill="#0F172A"/>
          <path d="M10 8.5v6M7 11.5h6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
    </div>

    <!-- Pointer -->
    <div style="
      width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
      border-top:8px solid #FFFFFF;margin-top:-2px;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.2));
    "></div>
  `;
  wrapper.appendChild(inner);
  return wrapper;
}

function createIncidentDomElement(inc) {
  const wrapper = document.createElement('div');
  wrapper.className = 'maplibre-incident-wrapper';
  wrapper.style.cursor = 'pointer';

  const sev = inc.severity || 'HIGH';
  const color = sev === 'CRITICAL' ? '#EF4444' : sev === 'HIGH' ? '#F97316' : '#F59E0B';
  const size = sev === 'CRITICAL' ? 42 : 36;

  const inner = document.createElement('div');
  inner.style.display = 'flex';
  inner.style.flexDirection = 'column';
  inner.style.alignItems = 'center';
  inner.style.pointerEvents = 'auto';

  inner.innerHTML = `
    <!-- Severity Banner -->
    <div style="
      background:${color};color:#FFFFFF;padding:2px 7px;border-radius:10px;
      font-size:9.5px;font-weight:800;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,0.3);
      margin-bottom:-4px;z-index:10;border:1.5px solid #FFFFFF;letter-spacing:0.4px;font-family:'Inter',sans-serif;
    ">
      ${sev} 🚨
    </div>

    <!-- Pin Body -->
    <div style="
      position:relative;width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:3px solid #FFFFFF;
      box-shadow:0 4px 16px rgba(239,68,68,0.45);
      display:flex;align-items:center;justify-content:center;
    ">
      <div style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:0.25;animation:inc-pulse 1.2s infinite"></div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 2L2 22h20L12 2z" fill="white"/>
        <line x1="12" y1="9" x2="12" y2="14" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
        <circle cx="12" cy="18" r="1.2" fill="${color}"/>
      </svg>
    </div>

    <!-- Tip -->
    <div style="
      width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
      border-top:8px solid #FFFFFF;margin-top:-2px;
    "></div>
  `;
  wrapper.appendChild(inner);
  return wrapper;
}

function createHospitalDomElement(h) {
  const wrapper = document.createElement('div');
  wrapper.className = 'maplibre-hospital-wrapper';
  wrapper.style.cursor = 'pointer';

  const beds = h.available_beds ?? 12;
  const icu = h.icu_beds_available ?? 4;
  const color = beds > 10 ? '#2563EB' : beds > 3 ? '#F59E0B' : '#EF4444';

  const inner = document.createElement('div');
  inner.style.display = 'flex';
  inner.style.flexDirection = 'column';
  inner.style.alignItems = 'center';
  inner.style.pointerEvents = 'auto';

  inner.innerHTML = `
    <!-- Bed count pill -->
    <div style="
      background:#1E293B;color:#FFFFFF;padding:1px 6px;border-radius:10px;
      font-size:9px;font-weight:800;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);
      margin-bottom:-3px;z-index:10;border:1px solid #FFFFFF;font-family:'Inter',sans-serif;
    ">
      ${beds} BEDS (${icu} ICU)
    </div>

    <!-- Pin Body -->
    <div style="
      width:34px;height:34px;border-radius:10px;
      background:${color};border:2.5px solid #FFFFFF;
      box-shadow:0 4px 12px rgba(37,99,235,0.35);
      display:flex;align-items:center;justify-content:center;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M12 4v16M4 12h16" stroke="white" stroke-width="3" stroke-linecap="round"/>
      </svg>
    </div>

    <!-- Tip -->
    <div style="
      width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
      border-top:7px solid #FFFFFF;margin-top:-2px;
    "></div>
  `;
  wrapper.appendChild(inner);
  return wrapper;
}

export default function DispatchMap({
  incidents = [],
  ambulances = [],
  hospitals = [],
  selectedIncident,
  activeAssignment,
  focusAmbulance,
  onIncidentClick,
  onAmbulanceClick,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({ incidents: new Map(), ambulances: new Map(), hospitals: new Map() });
  const activeRoutesRef = useRef(new Set());
  const [mapReady, setMapReady] = useState(false);

  // Opt-in vehicle tracking / live telemetry HUD state
  const [followedUnitId, setFollowedUnitId] = useState(null);
  const [liveTelemetry, setLiveTelemetry] = useState({ distanceKm: '0.0', etaMinutes: 0, speed: 40 });

  const unitWaypointsRef = useRef(new Map()); // ambId -> [[lng, lat], ...]
  const unitProgressRef = useRef(new Map());  // ambId -> { index: 0, fraction: 0 }
  const animationFrameRef = useRef(null);

  // Sync external focus prop to followedUnitId
  useEffect(() => {
    if (focusAmbulance?.id) {
      setFollowedUnitId(focusAmbulance.id);
    }
  }, [focusAmbulance]);

  /* ── Initialize MapLibre GL Map ── */
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    console.log('[MapLibre GL] Initializing Vector Map over Bengaluru...');

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: CARTO_VOYAGER_STYLE,
      center: BENGALURU_LNG_LAT,
      zoom: 12,
      pitch: 0,
      bearing: 0,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'bottom-right');

    map.on('load', () => {
      console.log('[MapLibre GL] Vector Base Map loaded successfully!');
      setMapReady(true);
      map.resize();
    });

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.resize();
      }
    });
    resizeObserver.observe(mapContainerRef.current);

    mapInstanceRef.current = map;

    return () => {
      resizeObserver.disconnect();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  /* ── Sub-step 2b: Render Incident Markers ── */
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;
    const currentIds = new Set(incidents.map(i => i.id));

    markersRef.current.incidents.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.incidents.delete(id);
      }
    });

    incidents.forEach(inc => {
      const lngLat = toLngLat(inc);
      if (!lngLat) return;

      const existing = markersRef.current.incidents.get(inc.id);
      if (existing) {
        existing.setLngLat(lngLat);
      } else {
        const el = createIncidentDomElement(inc);
        el.addEventListener('click', () => onIncidentClick?.(inc));

        const popup = new maplibregl.Popup({ offset: [0, -45], closeButton: true, className: 'google-maplibre-popup' })
          .setHTML(`
            <div style="font-family:'Inter',sans-serif;padding:6px 8px;min-width:180px;">
              <div style="font-weight:800;font-size:13px;color:#0F172A;margin-bottom:2px;">🚨 ${inc.incident_type || 'Emergency Incident'}</div>
              <div style="font-size:11px;color:#475569;margin-bottom:6px;">${inc.location_address || 'Bengaluru'}</div>
              <div style="display:flex;gap:6px;">
                <span style="background:#FEE2E2;color:#EF4444;border-radius:4px;padding:2px 6px;font-size:10.5px;font-weight:800">${inc.severity}</span>
                <span style="background:#F1F5F9;color:#475569;border-radius:4px;padding:2px 6px;font-size:10.5px;font-weight:700">${inc.status}</span>
              </div>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(lngLat)
          .setPopup(popup)
          .addTo(map);

        markersRef.current.incidents.set(inc.id, marker);
      }
    });
  }, [incidents, onIncidentClick, mapReady]);

  /* ── Sub-step 2b: Render Ambulance Markers ── */
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;
    const currentIds = new Set(ambulances.map(a => a.id));

    markersRef.current.ambulances.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.ambulances.delete(id);
      }
    });

    ambulances.forEach(amb => {
      const lngLat = toLngLat(amb);
      if (!lngLat) return;

      const existing = markersRef.current.ambulances.get(amb.id);
      if (existing) {
        existing.setLngLat(lngLat);
      } else {
        const el = createAmbulanceDomElement(amb);
        el.addEventListener('click', () => {
          setFollowedUnitId(amb.id);
          onAmbulanceClick?.(amb);
          map.easeTo({ center: lngLat, zoom: 14.5, duration: 1000 });
        });

        const popup = new maplibregl.Popup({ offset: [0, -45], closeButton: true, className: 'google-maplibre-popup' })
          .setHTML(`
            <div style="font-family:'Inter',sans-serif;padding:6px 8px;min-width:180px;">
              <div style="font-weight:800;font-size:13px;color:#0F172A;">🚑 ${amb.call_sign || amb.vehicle_number}</div>
              <div style="font-size:11px;color:#475569;margin-bottom:4px;">Driver: ${amb.driver || 'Active Paramedic'}</div>
              <div style="font-size:11px;font-weight:700;color:#2563EB;">Status: ${amb.status} (Speed: ${amb.speed || 0} km/h)</div>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(lngLat)
          .setPopup(popup)
          .addTo(map);

        markersRef.current.ambulances.set(amb.id, marker);
      }
    });
  }, [ambulances, onAmbulanceClick, mapReady]);

  /* ── Sub-step 2b: Render Hospital Markers ── */
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;
    const currentIds = new Set(hospitals.map(h => h.id));

    markersRef.current.hospitals.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.hospitals.delete(id);
      }
    });

    hospitals.forEach(h => {
      const lngLat = toLngLat(h);
      if (!lngLat) return;

      const existing = markersRef.current.hospitals.get(h.id);
      if (existing) {
        existing.setLngLat(lngLat);
      } else {
        const el = createHospitalDomElement(h);
        const popup = new maplibregl.Popup({ offset: [0, -40], closeButton: true, className: 'google-maplibre-popup' })
          .setHTML(`
            <div style="font-family:'Inter',sans-serif;padding:6px 8px;min-width:180px;">
              <div style="font-weight:800;font-size:13px;color:#0F172A;margin-bottom:2px;">🏥 ${h.name}</div>
              <div style="font-size:11px;color:#475569;margin-bottom:4px;">Emergency Receiving Hospital</div>
              <div style="font-size:11px;font-weight:700;color:#2563EB;">Available Beds: ${h.available_beds || 12} (ICU: ${h.icu_beds_available || 4})</div>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(lngLat)
          .setPopup(popup)
          .addTo(map);

        markersRef.current.hospitals.set(h.id, marker);
      }
    });
  }, [hospitals, mapReady]);

  /* ── Multi-Unit Route Management with Dual-Segment Traveled / Remaining Layers ── */
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    const activeAmbulances = ambulances.filter(
      amb => ['EN_ROUTE', 'TRANSPORTING'].includes(amb.status) || amb.assigned_incident_id
    );
    const activeIds = new Set(activeAmbulances.map(a => a.id));

    activeRoutesRef.current.forEach(ambId => {
      if (!activeIds.has(ambId)) {
        if (map.isStyleLoaded()) {
          if (map.getLayer(`route-traveled-${ambId}`)) map.removeLayer(`route-traveled-${ambId}`);
          if (map.getLayer(`route-line-${ambId}`)) map.removeLayer(`route-line-${ambId}`);
          if (map.getLayer(`route-casing-${ambId}`)) map.removeLayer(`route-casing-${ambId}`);
          if (map.getSource(`route-source-${ambId}`)) map.removeSource(`route-source-${ambId}`);
        }
        activeRoutesRef.current.delete(ambId);
        unitWaypointsRef.current.delete(ambId);
        unitProgressRef.current.delete(ambId);
      }
    });

    if (activeAmbulances.length === 0) return;

    const ROUTE_THEMES = {
      'AMB-001': { core: '#2563EB', casing: '#1E40AF' }, // Alpha-1: Royal Blue
      'AMB-002': { core: '#EA580C', casing: '#9A3412' }, // Bravo-2: Orange
      'AMB-003': { core: '#9333EA', casing: '#581C87' }, // Charlie-3: Purple
      'AMB-004': { core: '#06B6D4', casing: '#164E63' }, // Delta-4: Cyan
      'AMB-005': { core: '#10B981', casing: '#064E3B' }, // Echo-5: Emerald
    };

    activeAmbulances.forEach(amb => {
      const ambCoord = toLngLat(amb);
      if (!ambCoord) return;

      const targetIncident = incidents.find(i => i.id === amb.assigned_incident_id) || incidents[0];
      if (!targetIncident) return;
      const incCoord = toLngLat(targetIncident);
      if (!incCoord) return;

      const sourceId = `route-source-${amb.id}`;
      const casingLayerId = `route-casing-${amb.id}`;
      const lineLayerId = `route-line-${amb.id}`;
      const traveledLayerId = `route-traveled-${amb.id}`;
      const theme = ROUTE_THEMES[amb.id] || { core: '#2563EB', casing: '#1E40AF' };

      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${ambCoord[0]},${ambCoord[1]};${incCoord[0]},${incCoord[1]}?overview=full&geometries=geojson`;

      fetch(osrmUrl)
        .then(res => res.json())
        .then(data => {
          if (!data || !data.routes || !data.routes[0]) return;

          const route = data.routes[0];
          const coords = route.geometry.coordinates;
          unitWaypointsRef.current.set(amb.id, coords);
          if (!unitProgressRef.current.has(amb.id)) {
            unitProgressRef.current.set(amb.id, { index: 0, fraction: 0 });
          }

          // Initial FeatureCollection with remaining route
          const geojsonData = {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { segment: 'remaining', ambulanceId: amb.id },
                geometry: { type: 'LineString', coordinates: coords },
              },
              {
                type: 'Feature',
                properties: { segment: 'traveled', ambulanceId: amb.id },
                geometry: { type: 'LineString', coordinates: [coords[0], coords[0]] },
              },
            ],
          };

          const renderUnitRoute = () => {
            try {
              if (map.getSource(sourceId)) {
                map.getSource(sourceId).setData(geojsonData);
              } else {
                map.addSource(sourceId, {
                  type: 'geojson',
                  data: geojsonData,
                });
              }

              // 1. Traveled Faded Path Layer (behind moving vehicle)
              if (!map.getLayer(traveledLayerId)) {
                map.addLayer({
                  id: traveledLayerId,
                  type: 'line',
                  source: sourceId,
                  filter: ['==', ['get', 'segment'], 'traveled'],
                  layout: { 'line-join': 'round', 'line-cap': 'round' },
                  paint: {
                    'line-color': '#94A3B8',
                    'line-width': 4.5,
                    'line-dasharray': [2, 2],
                    'line-opacity': 0.65,
                  },
                });
              }

              // 2. Remaining Path Outer Casing
              if (!map.getLayer(casingLayerId)) {
                map.addLayer({
                  id: casingLayerId,
                  type: 'line',
                  source: sourceId,
                  filter: ['==', ['get', 'segment'], 'remaining'],
                  layout: { 'line-join': 'round', 'line-cap': 'round' },
                  paint: {
                    'line-color': theme.casing,
                    'line-width': 8.5,
                    'line-opacity': 0.75,
                  },
                });
              }

              // 3. Remaining Path Core Glowing Navigation Line
              if (!map.getLayer(lineLayerId)) {
                map.addLayer({
                  id: lineLayerId,
                  type: 'line',
                  source: sourceId,
                  filter: ['==', ['get', 'segment'], 'remaining'],
                  layout: { 'line-join': 'round', 'line-cap': 'round' },
                  paint: {
                    'line-color': theme.core,
                    'line-width': 5.5,
                    'line-opacity': 1.0,
                  },
                });
              }

              activeRoutesRef.current.add(amb.id);
            } catch (e) {
              console.error(`[Multi-Route] Error adding layer for ${amb.id}:`, e);
            }
          };

          if (map.isStyleLoaded()) {
            renderUnitRoute();
          } else {
            map.once('styledata', renderUnitRoute);
          }
        })
        .catch(err => {
          console.error(`[Multi-Route] OSRM fetch error for ${amb.id}:`, err);
        });
    });
  }, [ambulances, incidents, mapReady]);

  /* ── Step 5: 60fps Position Interpolation, Dynamic Route Splitting & Live ETA Calculator ── */
  useEffect(() => {
    let lastTime = performance.now();
    let frameCount = 0;

    const animateVehicles = (now) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      frameCount++;

      const SPEED_FACTOR = 0.85;

      unitWaypointsRef.current.forEach((waypoints, ambId) => {
        if (!waypoints || waypoints.length < 2) return;

        const marker = markersRef.current.ambulances.get(ambId);
        if (!marker) return;

        let prog = unitProgressRef.current.get(ambId) || { index: 0, fraction: 0 };
        prog.fraction += dt * SPEED_FACTOR;

        while (prog.fraction >= 1) {
          prog.fraction -= 1;
          prog.index++;
          if (prog.index >= waypoints.length - 1) {
            prog.index = 0; // Loop navigation seamlessly
          }
        }
        unitProgressRef.current.set(ambId, prog);

        const pA = waypoints[prog.index];
        const pB = waypoints[Math.min(prog.index + 1, waypoints.length - 1)];

        // Smooth sub-segment position
        const currentLng = pA[0] + (pB[0] - pA[0]) * prog.fraction;
        const currentLat = pA[1] + (pB[1] - pA[1]) * prog.fraction;
        const currentLngLat = [currentLng, currentLat];

        // 1. Move vehicle marker
        marker.setLngLat(currentLngLat);

        // 2. Rotate vehicle icon based on forward heading
        const heading = calculateBearing(pA, pB);
        const el = marker.getElement();
        if (el) {
          const rotator = el.querySelector('.vehicle-icon-rotator');
          if (rotator) {
            rotator.style.transform = `rotate(${heading}deg)`;
          }
        }

        // 3. Traveled vs. Remaining Dynamic Polyline Slicing (updated smoothly every 3 frames)
        if (frameCount % 3 === 0 && mapInstanceRef.current) {
          const traveledCoords = [...waypoints.slice(0, prog.index + 1), currentLngLat];
          const remainingCoords = [currentLngLat, ...waypoints.slice(prog.index + 1)];

          const source = mapInstanceRef.current.getSource(`route-source-${ambId}`);
          if (source) {
            source.setData({
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { segment: 'traveled', ambulanceId: ambId },
                  geometry: { type: 'LineString', coordinates: traveledCoords },
                },
                {
                  type: 'Feature',
                  properties: { segment: 'remaining', ambulanceId: ambId },
                  geometry: { type: 'LineString', coordinates: remainingCoords.length > 1 ? remainingCoords : [currentLngLat, currentLngLat] },
                },
              ],
            });
          }

          // 4. Live Dynamic Remaining Distance & ETA Calculation
          let remainingMeters = 0;
          for (let k = 0; k < remainingCoords.length - 1; k++) {
            remainingMeters += calculateDistanceMeters(remainingCoords[k], remainingCoords[k + 1]);
          }
          const remainingKm = (remainingMeters / 1000).toFixed(1);
          const remainingMinutes = Math.max(1, Math.ceil((remainingMeters / 1000) / (38 / 60))); // 38 km/h urban average speed

          // Update marker DOM pill live
          if (el) {
            const badge = el.querySelector('.amb-live-badge');
            if (badge) {
              const ambObj = ambulances.find(a => a.id === ambId);
              const callsign = ambObj?.call_sign || ambId;
              badge.innerHTML = `${callsign} • ${remainingKm} km (${remainingMinutes}m)`;
            }
          }

          // If this unit is currently followed, update HUD telemetry state
          if (followedUnitId === ambId) {
            setLiveTelemetry({
              distanceKm: remainingKm,
              etaMinutes: remainingMinutes,
              speed: 42,
            });
          }
        }

        // 5. Opt-in Camera Auto-Follow
        if (followedUnitId === ambId && mapInstanceRef.current) {
          mapInstanceRef.current.easeTo({
            center: currentLngLat,
            duration: 120,
            easing: (t) => t,
          });
        }
      });

      animationFrameRef.current = requestAnimationFrame(animateVehicles);
    };

    animationFrameRef.current = requestAnimationFrame(animateVehicles);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [followedUnitId, ambulances]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '100%',
        bgcolor: '#F8FAFC',
        overflow: 'hidden',
      }}
    >
      {/* Map Container */}
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Floating Live Telemetry & Auto-Follow HUD Indicator */}
      {followedUnitId && (
        <Box
          sx={{
            position: 'absolute',
            top: 14,
            left: 14,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(10px)',
            color: '#FFFFFF',
            borderRadius: '12px',
            px: '14px',
            py: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.18)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CenterFocusStrongIcon sx={{ fontSize: 18, color: '#38BDF8', animation: 'pulse-slow 2s infinite' }} />
            <Typography sx={{ fontSize: '12px', fontWeight: 800, fontFamily: 'Inter, sans-serif' }}>
              Tracking: <span style={{ color: '#38BDF8' }}>{followedUnitId === 'AMB-001' ? 'Alpha-1' : followedUnitId === 'AMB-002' ? 'Bravo-2' : followedUnitId}</span>
            </Typography>
          </Box>

          <Box sx={{ width: '1px', height: '18px', bgcolor: 'rgba(255,255,255,0.2)' }} />

          {/* Live Remaining Distance */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <NearMeIcon sx={{ fontSize: 15, color: '#10B981' }} />
            <Typography sx={{ fontSize: '11.5px', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
              {liveTelemetry.distanceKm} km rem.
            </Typography>
          </Box>

          {/* Live Dynamic ETA */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AccessTimeIcon sx={{ fontSize: 15, color: '#F59E0B' }} />
            <Typography sx={{ fontSize: '11.5px', fontWeight: 700, fontFamily: 'Inter, sans-serif' }}>
              ETA {liveTelemetry.etaMinutes} min
            </Typography>
          </Box>

          <IconButton
            size="small"
            onClick={() => setFollowedUnitId(null)}
            sx={{ color: '#94A3B8', p: '2px', ml: '4px', '&:hover': { color: '#FFFFFF', bgcolor: 'rgba(255,255,255,0.15)' } }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      )}

      <style>{`
        @keyframes amb-pulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes inc-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.1); }
        }
        .maplibregl-popup-content {
          border-radius: 12px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18) !important;
          padding: 8px !important;
          border: 1px solid #E2E8F0 !important;
        }
      `}</style>
    </Box>
  );
}
