import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Box, Typography, Chip } from '@mui/material';

// CARTO Voyager High-DPI Style (Google Maps-like vector street design)
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
      attribution: '&copy; OpenStreetMap &copy; CARTO',
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

/* ── DOM Marker Generators ── */
function createDriverMarkerElement() {
  const wrapper = document.createElement('div');
  wrapper.className = 'driver-marker-wrapper';
  wrapper.style.cursor = 'pointer';

  const inner = document.createElement('div');
  inner.style.position = 'relative';
  inner.style.width = '42px';
  inner.style.height = '42px';
  inner.style.borderRadius = '50%';
  inner.style.background = '#2563EB';
  inner.style.border = '3px solid #FFFFFF';
  inner.style.boxShadow = '0 4px 16px rgba(37,99,235,0.5)';
  inner.style.display = 'flex';
  inner.style.alignItems = 'center';
  inner.style.justifyContent = 'center';

  inner.innerHTML = `
    <div class="driver-vehicle-rotator" style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;transition:transform 0.2s linear;">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="14" height="11" rx="2" fill="white"/>
        <path d="M17 9l4 2v6h-4V9z" fill="white"/>
        <circle cx="7.5" cy="17.5" r="2.5" fill="#0F172A"/>
        <circle cx="17.5" cy="17.5" r="2.5" fill="#0F172A"/>
        <path d="M10 8.5v6M7 11.5h6" stroke="#2563EB" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
  `;
  wrapper.appendChild(inner);
  return wrapper;
}

function createIncidentMarkerElement() {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="width:36px;height:36px;border-radius:50%;background:#EF4444;border:3px solid #FFFFFF;box-shadow:0 4px 14px rgba(239,68,68,0.5);display:flex;align-items:center;justify-content:center;font-size:16px;">
      🚨
    </div>
  `;
  return wrapper;
}

function createHospitalMarkerElement() {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="width:34px;height:34px;border-radius:10px;background:#2563EB;border:2.5px solid #FFFFFF;box-shadow:0 4px 12px rgba(37,99,235,0.4);display:flex;align-items:center;justify-content:center;font-size:16px;">
      🏥
    </div>
  `;
  return wrapper;
}

export default function DriverMap({ driverPos, incident, missionStatus, hospital }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const driverMarkerRef = useRef(null);
  const incidentMarkerRef = useRef(null);
  const hospitalMarkerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [heading, setHeading] = useState(0);
  const prevPosRef = useRef(null);

  /* ── Init MapLibre Map ── */
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLngLat = [driverPos?.lng || 77.5946, driverPos?.lat || 12.9716];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: CARTO_VOYAGER_STYLE,
      center: initialLngLat,
      zoom: 15,
      pitch: 35,
      bearing: 0,
      attributionControl: false,
    });

    map.on('load', () => {
      setMapReady(true);
      map.resize();

      // Add driver marker
      const el = createDriverMarkerElement();
      driverMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(initialLngLat)
        .addTo(map);
    });

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.resize();
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

  /* ── Update Driver Position & Heading Rotation ── */
  useEffect(() => {
    if (!mapInstanceRef.current || !driverMarkerRef.current || !driverPos) return;

    const currentLngLat = [driverPos.lng, driverPos.lat];
    driverMarkerRef.current.setLngLat(currentLngLat);

    if (prevPosRef.current) {
      const dLat = driverPos.lat - prevPosRef.current.lat;
      const dLng = driverPos.lng - prevPosRef.current.lng;
      if (Math.abs(dLat) > 0.00001 || Math.abs(dLng) > 0.00001) {
        const deg = (Math.atan2(dLng, dLat) * 180) / Math.PI;
        setHeading(deg);

        const el = driverMarkerRef.current.getElement();
        if (el) {
          const rotator = el.querySelector('.driver-vehicle-rotator');
          if (rotator) rotator.style.transform = `rotate(${deg}deg)`;
        }
      }
    }
    prevPosRef.current = driverPos;

    if (['EN_ROUTE', 'TRANSPORTING'].includes(missionStatus)) {
      mapInstanceRef.current.easeTo({
        center: currentLngLat,
        bearing: 0,
        pitch: 0,
        duration: 800,
        easing: (t) => t,
      });
    }
  }, [driverPos, heading, missionStatus]);

  /* ── Render Navigation Route & Markers ── */
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    // Manage incident marker
    if (incident?.location_lat && incident?.location_lng) {
      const incLngLat = [incident.location_lng, incident.location_lat];
      if (!incidentMarkerRef.current) {
        incidentMarkerRef.current = new maplibregl.Marker({ element: createIncidentMarkerElement(), anchor: 'center' })
          .setLngLat(incLngLat)
          .addTo(map);
      } else {
        incidentMarkerRef.current.setLngLat(incLngLat);
      }
    } else if (incidentMarkerRef.current) {
      incidentMarkerRef.current.remove();
      incidentMarkerRef.current = null;
    }

    // Manage hospital marker
    if (hospital?.latitude && hospital?.longitude) {
      const hospLngLat = [hospital.longitude, hospital.latitude];
      if (!hospitalMarkerRef.current) {
        hospitalMarkerRef.current = new maplibregl.Marker({ element: createHospitalMarkerElement(), anchor: 'center' })
          .setLngLat(hospLngLat)
          .addTo(map);
      } else {
        hospitalMarkerRef.current.setLngLat(hospLngLat);
      }
    } else if (hospitalMarkerRef.current) {
      hospitalMarkerRef.current.remove();
      hospitalMarkerRef.current = null;
    }

    // Fetch and draw road route
    if (incident?.location_lat && incident?.location_lng) {
      const from = [driverPos.lng, driverPos.lat];
      const target = (missionStatus === 'TRANSPORTING' && hospital?.latitude)
        ? [hospital.longitude, hospital.latitude]
        : [incident.location_lng, incident.location_lat];

      const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${target[0]},${target[1]}?overview=full&geometries=geojson`;

      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (!data?.routes?.[0]) return;
          const route = data.routes[0];

          const geojson = {
            type: 'Feature',
            geometry: route.geometry,
          };

          if (map.getSource('driver-route-source')) {
            map.getSource('driver-route-source').setData(geojson);
          } else {
            map.addSource('driver-route-source', { type: 'geojson', data: geojson });
            map.addLayer({
              id: 'driver-route-casing',
              type: 'line',
              source: 'driver-route-source',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#1E40AF', 'line-width': 8, 'line-opacity': 0.6 },
            });
            map.addLayer({
              id: 'driver-route-line',
              type: 'line',
              source: 'driver-route-source',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: { 'line-color': '#2563EB', 'line-width': 5, 'line-opacity': 1.0 },
            });
          }
        })
        .catch(err => console.error('[DriverMap Route Error]', err));
    }
  }, [incident, hospital, missionStatus, mapReady, driverPos]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />

      {/* Speed overlay */}
      <Box sx={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
        bgcolor: 'rgba(15,23,42,0.85)', borderRadius: 2, px: 1.5, py: 0.8,
        border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
      }}>
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 900, lineHeight: 1, fontFamily: 'monospace' }}>
          {['EN_ROUTE', 'TRANSPORTING'].includes(missionStatus) ? '42' : '0'}
        </Typography>
        <Typography variant="caption" sx={{ color: '#94A3B8', fontSize: '0.65rem' }}>km/h</Typography>
      </Box>

      {/* Status badge */}
      <Box sx={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 1000 }}>
        <Chip
          label={missionStatus?.replace(/_/g, ' ') || 'STANDBY'}
          sx={{
            bgcolor: missionStatus === 'EN_ROUTE' ? '#EF4444' : missionStatus === 'TRANSPORTING' ? '#2563EB' : missionStatus === 'ON_SCENE' ? '#F97316' : '#10B981',
            color: 'white', fontWeight: 800, fontSize: '0.75rem',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
          }}
        />
      </Box>

      {/* GPS live indicator */}
      <Box sx={{
        position: 'absolute', top: 12, right: 12, zIndex: 1000,
        bgcolor: 'rgba(15,23,42,0.85)', borderRadius: 1.5, px: 1, py: 0.5,
        display: 'flex', alignItems: 'center', gap: 0.5,
        border: '1px solid rgba(16,185,129,0.3)',
      }}>
        <Box sx={{
          width: 7, height: 7, borderRadius: '50%', bgcolor: '#10B981',
          animation: 'gps-blink 1.5s infinite',
          '@keyframes gps-blink': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.2 } },
        }} />
        <Typography variant="caption" sx={{ color: '#10B981', fontSize: '0.65rem', fontWeight: 800 }}>GPS LIVE</Typography>
      </Box>
    </Box>
  );
}
