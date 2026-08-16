import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Box } from '@mui/material';

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

/* ── Robust Coordinate Converter (Converts any lat/lng format to MapLibre [lng, lat]) ── */
export function toLngLat(coord) {
  if (!coord) return null;
  if (Array.isArray(coord) && coord.length >= 2) {
    // If given [lat, lng] where lat is ~12-13 and lng is ~77-78
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

/* ── DOM Element Creators for MapLibre Markers ── */
function createAmbulanceDomElement(amb) {
  const el = document.createElement('div');
  el.className = 'maplibre-custom-marker maplibre-ambulance-marker';
  el.style.cursor = 'pointer';
  el.style.position = 'relative';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';

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
  const speed = amb.speed ? `${amb.speed} km/h` : '';

  el.innerHTML = `
    <!-- Callsign Badge -->
    <div style="
      background:#0F172A;color:#FFFFFF;padding:2px 7px;border-radius:12px;
      font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,0.3);
      margin-bottom:-4px;z-index:10;border:1.5px solid #FFFFFF;letter-spacing:0.3px;font-family:'Inter',sans-serif;
    ">
      ${callsign} ${isStale ? '⚠️ OFFLINE' : (speed ? `• ${speed}` : '')}
    </div>

    <!-- Google Pin Circle with Drop-Shadow -->
    <div style="
      position:relative;width:38px;height:38px;border-radius:50%;
      background:${color};border:3px solid #FFFFFF;
      box-shadow:0 4px 14px rgba(0,0,0,0.38);
      display:flex;align-items:center;justify-content:center;
      transition:all 0.3s ease;
    ">
      ${moving ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:0.6;animation:amb-pulse 1.2s infinite"></div>` : ''}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="14" height="11" rx="2" fill="white"/>
        <path d="M17 9l4 2v6h-4V9z" fill="white"/>
        <circle cx="7.5" cy="17.5" r="2.5" fill="#0F172A"/>
        <circle cx="17.5" cy="17.5" r="2.5" fill="#0F172A"/>
        <path d="M10 8.5v6M7 11.5h6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>

    <!-- Pointer -->
    <div style="
      width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
      border-top:8px solid #FFFFFF;margin-top:-2px;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.2));
    "></div>
  `;
  return el;
}

function createIncidentDomElement(inc) {
  const el = document.createElement('div');
  el.className = 'maplibre-custom-marker maplibre-incident-marker';
  el.style.cursor = 'pointer';
  el.style.position = 'relative';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';

  const sev = inc.severity || 'HIGH';
  const color = sev === 'CRITICAL' ? '#EF4444' : sev === 'HIGH' ? '#F97316' : '#F59E0B';
  const size = sev === 'CRITICAL' ? 42 : 36;

  el.innerHTML = `
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
  return el;
}

function createHospitalDomElement(h) {
  const el = document.createElement('div');
  el.className = 'maplibre-custom-marker maplibre-hospital-marker';
  el.style.cursor = 'pointer';
  el.style.position = 'relative';
  el.style.display = 'flex';
  el.style.flexDirection = 'column';
  el.style.alignItems = 'center';

  const beds = h.available_beds ?? 12;
  const icu = h.icu_beds_available ?? 4;
  const color = beds > 10 ? '#2563EB' : beds > 3 ? '#F59E0B' : '#EF4444';

  el.innerHTML = `
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
  return el;
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
  const mapLoadedRef = useRef(false);

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
      mapLoadedRef.current = true;
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
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  /* ── Sub-step 2b: Render Incident Markers with toLngLat() ── */
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const currentIds = new Set(incidents.map(i => i.id));

    // Remove deleted incident markers
    markersRef.current.incidents.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.incidents.delete(id);
      }
    });

    // Add or update incidents
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
  }, [incidents, onIncidentClick]);

  /* ── Sub-step 2b: Render Ambulance Markers with toLngLat() ── */
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const currentIds = new Set(ambulances.map(a => a.id));

    // Remove deleted ambulance markers
    markersRef.current.ambulances.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.ambulances.delete(id);
      }
    });

    // Add or update ambulances
    ambulances.forEach(amb => {
      const lngLat = toLngLat(amb);
      if (!lngLat) return;

      const existing = markersRef.current.ambulances.get(amb.id);
      if (existing) {
        existing.setLngLat(lngLat);
      } else {
        const el = createAmbulanceDomElement(amb);
        el.addEventListener('click', () => onAmbulanceClick?.(amb));

        const popup = new maplibregl.Popup({ offset: [0, -45], closeButton: true, className: 'google-maplibre-popup' })
          .setHTML(`
            <div style="font-family:'Inter',sans-serif;padding:6px 8px;min-width:180px;">
              <div style="font-weight:800;font-size:13px;color:#0F172A;">🚑 ${amb.call_sign || amb.vehicle_number}</div>
              <div style="font-size:11px;color:#475569;margin-bottom:4px;">Driver: ${amb.driver || 'Active Paramedic'}</div>
              <div style="font-size:11px;font-weight:700;color:#2563EB;">Status: ${amb.status}</div>
            </div>
          `);

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(lngLat)
          .setPopup(popup)
          .addTo(map);

        markersRef.current.ambulances.set(amb.id, marker);
      }
    });
  }, [ambulances, onAmbulanceClick]);

  /* ── Sub-step 2b: Render Hospital Markers with toLngLat() ── */
  useEffect(() => {
    if (!mapInstanceRef.current) return;
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
  }, [hospitals]);

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

      <style>{`
        @keyframes amb-pulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes inc-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
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
