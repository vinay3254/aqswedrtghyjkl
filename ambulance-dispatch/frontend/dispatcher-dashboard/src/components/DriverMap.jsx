import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box, Typography, Chip } from '@mui/material';

/* ── Ambulance SVG icon ─────────────────────────── */
const makeAmbulanceIcon = (heading = 0) => L.divIcon({
  html: `
    <div style="transform:rotate(${heading}deg);transition:transform 0.5s;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.7))">
      <svg width="44" height="44" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
        <!-- body -->
        <rect x="4" y="14" width="32" height="18" rx="4" fill="#dc2626"/>
        <!-- cab -->
        <rect x="28" y="17" width="10" height="12" rx="3" fill="#fca5a5"/>
        <!-- cross symbol -->
        <rect x="12" y="20" width="10" height="3" rx="1" fill="white"/>
        <rect x="15.5" y="17" width="3" height="10" rx="1" fill="white"/>
        <!-- wheels -->
        <circle cx="11" cy="33" r="4" fill="#FFFFFF" stroke="#475569" stroke-width="1.5"/>
        <circle cx="11" cy="33" r="1.5" fill="#64748b"/>
        <circle cx="31" cy="33" r="4" fill="#FFFFFF" stroke="#475569" stroke-width="1.5"/>
        <circle cx="31" cy="33" r="1.5" fill="#64748b"/>
        <!-- lights -->
        <rect x="4" y="14" width="5" height="3" rx="1" fill="#ef4444"
          style="animation:light-blink 0.8s infinite alternate"/>
        <rect x="35" y="14" width="5" height="3" rx="1" fill="#3b82f6"
          style="animation:light-blink 0.8s 0.4s infinite alternate"/>
        <!-- direction arrow -->
        <polygon points="22,6 18,13 26,13" fill="#fbbf24"/>
      </svg>
    </div>
    <style>
      @keyframes light-blink { from{opacity:1} to{opacity:0.2} }
    </style>`,
  iconSize: [44, 44],
  iconAnchor: [22, 36],
  className: '',
});

const INCIDENT_ICON = L.divIcon({
  html: `<div style="position:relative;width:36px;height:36px">
    <div style="position:absolute;inset:0;border-radius:50%;background:rgba(239,68,68,0.3);animation:sos-ring 1s infinite"></div>
    <div style="position:absolute;inset:6px;border-radius:50%;background:#ef4444;display:flex;align-items:center;justify-content:center;font-size:14px">🚨</div>
    <style>@keyframes sos-ring{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.2);opacity:0}}</style>
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  className: '',
});

const HOSPITAL_ICON = L.divIcon({
  html: `<div style="background:#2563eb;border-radius:8px;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 2px 8px rgba(37,99,235,0.6);border:2px solid #93c5fd">🏥</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  className: '',
});

/* ── Fetch OSRM road route ───────────────────────── */
async function fetchRoute(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=simplified&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    if (data.routes?.[0]) {
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    }
  } catch {}
  return [from, to]; // fallback straight line
}

export default function DriverMap({ driverPos, incident, missionStatus, hospital }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const routeLayersRef = useRef([]);
  const prevPosRef = useRef(null);
  const [heading, setHeading] = useState(0);

  /* ── Init map ─── */
  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false })
      .setView([driverPos.lat, driverPos.lng], 15);

    // Light navigation tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.attribution({ position: 'bottomleft', prefix: '© OSM' }).addTo(map);

    // Driver marker
    driverMarkerRef.current = L.marker([driverPos.lat, driverPos.lng], {
      icon: makeAmbulanceIcon(0),
      zIndexOffset: 1000,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  /* ── Update driver position + heading ─── */
  useEffect(() => {
    if (!mapInstanceRef.current || !driverMarkerRef.current) return;

    const latlng = [driverPos.lat, driverPos.lng];

    // Calculate heading from previous position
    if (prevPosRef.current) {
      const dlat = driverPos.lat - prevPosRef.current.lat;
      const dlng = driverPos.lng - prevPosRef.current.lng;
      if (Math.abs(dlat) > 0.00001 || Math.abs(dlng) > 0.00001) {
        const deg = Math.atan2(dlng, dlat) * (180 / Math.PI);
        setHeading(deg);
      }
    }
    prevPosRef.current = driverPos;

    driverMarkerRef.current.setLatLng(latlng);
    driverMarkerRef.current.setIcon(makeAmbulanceIcon(heading));

    // Smooth follow
    if (missionStatus === 'EN_ROUTE' || missionStatus === 'TRANSPORTING') {
      mapInstanceRef.current.panTo(latlng, { animate: true, duration: 1 });
    }
  }, [driverPos, heading, missionStatus]);

  /* ── Draw route when mission starts ─── */
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear old routes
    routeLayersRef.current.forEach(l => mapInstanceRef.current.removeLayer(l));
    routeLayersRef.current = [];

    if (!incident?.location_lat || !incident?.location_lng) return;

    const driverLatLng = [driverPos.lat, driverPos.lng];
    const incidentLatLng = [incident.location_lat, incident.location_lng];

    // Add incident marker
    const incidentMarker = L.marker(incidentLatLng, { icon: INCIDENT_ICON })
      .addTo(mapInstanceRef.current)
      .bindPopup(`<b>🚨 ${incident.incident_type}</b><br>${incident.location_address}`);
    routeLayersRef.current.push(incidentMarker);

    // Add hospital marker if transporting
    if (hospital?.latitude && hospital?.longitude) {
      const hospMarker = L.marker([hospital.latitude, hospital.longitude], { icon: HOSPITAL_ICON })
        .addTo(mapInstanceRef.current)
        .bindPopup(`<b>🏥 ${hospital.name}</b>`);
      routeLayersRef.current.push(hospMarker);
    }

    // Fetch and draw routes
    const drawRoutes = async () => {
      if (missionStatus === 'EN_ROUTE' || missionStatus === 'ON_SCENE') {
        const pts = await fetchRoute(driverLatLng, incidentLatLng);
        const line = L.polyline(pts, { color: '#ef4444', weight: 5, opacity: 0.85 })
          .addTo(mapInstanceRef.current);
        line.bindTooltip('🚑 Route to incident', { sticky: true });
        routeLayersRef.current.push(line);
      }

      if ((missionStatus === 'TRANSPORTING' || missionStatus === 'AT_HOSPITAL') && hospital?.latitude) {
        const from = missionStatus === 'TRANSPORTING' ? driverLatLng : incidentLatLng;
        const pts = await fetchRoute(from, [hospital.latitude, hospital.longitude]);
        const line = L.polyline(pts, { color: '#3b82f6', weight: 5, opacity: 0.85 })
          .addTo(mapInstanceRef.current);
        line.bindTooltip('🏥 Route to hospital', { sticky: true });
        routeLayersRef.current.push(line);
      }

      // Fit bounds to show everything
      const allPoints = [driverLatLng, incidentLatLng];
      if (hospital?.latitude) allPoints.push([hospital.latitude, hospital.longitude]);
      if (allPoints.length > 1) {
        mapInstanceRef.current.fitBounds(L.latLngBounds(allPoints), { padding: [60, 60] });
      }
    };

    drawRoutes();
  }, [incident, hospital, missionStatus]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <Box ref={mapRef} sx={{ width: '100%', height: '100%' }} />

      {/* Speed overlay */}
      <Box sx={{
        position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
        bgcolor: 'rgba(0,0,0,0.75)', borderRadius: 2, px: 2, py: 1,
        border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
      }}>
        <Typography variant="h5" sx={{ color: 'white', fontWeight: 900, lineHeight: 1, fontFamily: 'monospace' }}>
          {['EN_ROUTE', 'TRANSPORTING'].includes(missionStatus) ? `${Math.floor(40 + Math.random() * 30)}` : '0'}
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem' }}>km/h</Typography>
      </Box>

      {/* Status badge */}
      <Box sx={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
        <Chip
          label={missionStatus?.replace(/_/g, ' ') || 'STANDBY'}
          sx={{
            bgcolor: missionStatus === 'EN_ROUTE' ? '#ef4444' : missionStatus === 'TRANSPORTING' ? '#3b82f6' : missionStatus === 'ON_SCENE' ? '#f97316' : '#22c55e',
            color: 'white', fontWeight: 800, fontSize: '0.75rem',
            boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
          }}
        />
      </Box>

      {/* GPS live indicator */}
      <Box sx={{
        position: 'absolute', top: 12, right: 12, zIndex: 1000,
        bgcolor: 'rgba(0,0,0,0.7)', borderRadius: 1.5, px: 1, py: 0.5,
        display: 'flex', alignItems: 'center', gap: 0.5,
        border: '1px solid rgba(34,197,94,0.3)',
      }}>
        <Box sx={{
          width: 7, height: 7, borderRadius: '50%', bgcolor: '#22c55e',
          animation: 'gps-blink 1.5s infinite',
          '@keyframes gps-blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
        }} />
        <Typography variant="caption" sx={{ color: '#22c55e', fontSize: '0.6rem', fontWeight: 700 }}>GPS LIVE</Typography>
      </Box>
    </Box>
  );
}
