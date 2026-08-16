import React, { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Box } from '@mui/material';

// Free, Keyless CARTO Voyager GL Vector Style (Google Maps-like vector street design)
const VECTOR_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const BENGALURU_LNG_LAT = [77.5946, 12.9716]; // [lng, lat] GeoJSON standard

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

  /* ── Sub-step 2a: Initialize MapLibre GL Vector Base Map (No markers / routes yet) ── */
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    console.log('[MapLibre GL] Initializing Vector Base Map over Bengaluru...');

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: VECTOR_STYLE_URL,
      center: BENGALURU_LNG_LAT,
      zoom: 12,
      pitch: 0,
      bearing: 0,
      attributionControl: true,
    });

    // Add navigation controls (zoom in/out, compass)
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'bottom-right');

    map.on('load', () => {
      console.log('[MapLibre GL] Vector Base Map loaded successfully over Bengaluru [77.5946, 12.9716]!');
      map.resize();
    });

    map.on('error', (e) => {
      console.error('[MapLibre GL] Map error:', e);
    });

    // Handle container resize
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
        console.log('[MapLibre GL] Removing map instance on unmount.');
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

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
    </Box>
  );
}
