import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box } from '@mui/material';

/* ── Haversine distance in meters ───────────────────────────────────────── */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ── Distance from point to polyline segment ─────────────────────────── */
function minDistanceToPolyline(point, polyline) {
  if (!polyline || polyline.length < 2) return 0;
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const p1 = polyline[i];
    const p2 = polyline[i + 1];
    // Midpoint approximation for segment
    const midLat = (p1[0] + p2[0]) / 2;
    const midLng = (p1[1] + p2[1]) / 2;
    const dist = haversineMeters(point[0], point[1], midLat, midLng);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/* ── Google Maps-Style Custom SVG Marker Pins ─────────────────────────── */
const makeGoogleAmbulanceIcon = (amb) => {
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

  return L.divIcon({
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <!-- Vehicle Badge -->
        <div style="
          background:#0F172A;color:#FFFFFF;padding:2px 7px;border-radius:12px;
          font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,0.3);
          margin-bottom:-4px;z-index:10;border:1.5px solid #FFFFFF;letter-spacing:0.3px;
        ">
          ${callsign} ${isStale ? '⚠️ OFFLINE' : (speed ? `• ${speed}` : '')}
        </div>

        <!-- Google Pin Body with Shadow -->
        <div style="
          position:relative;width:40px;height:40px;border-radius:50%;
          background:${color};border:3px solid #FFFFFF;
          box-shadow:0 4px 14px rgba(0,0,0,0.38);
          display:flex;align-items:center;justify-content:center;
          transition:all 0.3s ease;
        ">
          ${moving ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:0.6;animation:amb-pulse 1.2s infinite"></div>` : ''}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="6" width="14" height="11" rx="2" fill="white"/>
            <path d="M17 9l4 2v6h-4V9z" fill="white"/>
            <circle cx="7.5" cy="17.5" r="2.5" fill="#0F172A"/>
            <circle cx="17.5" cy="17.5" r="2.5" fill="#0F172A"/>
            <path d="M10 8.5v6M7 11.5h6" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>

        <!-- Pin Pointer -->
        <div style="
          width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
          border-top:8px solid #FFFFFF;margin-top:-2px;filter:drop-shadow(0 2px 2px rgba(0,0,0,0.2));
        "></div>
      </div>`,
    iconSize: [60, 60],
    iconAnchor: [30, 56],
    popupAnchor: [0, -56],
    className: 'custom-google-marker',
  });
};

const makeGoogleIncidentIcon = (inc) => {
  const sev = inc.severity || 'HIGH';
  const color = sev === 'CRITICAL' ? '#EF4444' : sev === 'HIGH' ? '#F97316' : '#F59E0B';
  const size = sev === 'CRITICAL' ? 44 : 38;

  return L.divIcon({
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <!-- Severity Banner -->
        <div style="
          background:${color};color:#FFFFFF;padding:2px 7px;border-radius:10px;
          font-size:9.5px;font-weight:800;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,0.3);
          margin-bottom:-4px;z-index:10;border:1.5px solid #FFFFFF;letter-spacing:0.4px;
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 22h20L12 2z" fill="white"/>
            <line x1="12" y1="9" x2="12" y2="14" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="12" cy="18" r="1.2" fill="${color}"/>
          </svg>
        </div>

        <!-- Pin Tip -->
        <div style="
          width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;
          border-top:8px solid #FFFFFF;margin-top:-2px;
        "></div>
      </div>`,
    iconSize: [60, 60],
    iconAnchor: [30, 56],
    popupAnchor: [0, -56],
    className: 'custom-google-marker',
  });
};

const makeGoogleHospitalIcon = (h) => {
  const beds = h.available_beds ?? 12;
  const icu = h.icu_beds_available ?? 4;
  const color = beds > 10 ? '#2563EB' : beds > 3 ? '#F59E0B' : '#EF4444';

  return L.divIcon({
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <!-- ICU Bed Count Pill -->
        <div style="
          background:#1E293B;color:#FFFFFF;padding:1px 6px;border-radius:10px;
          font-size:9px;font-weight:800;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);
          margin-bottom:-3px;z-index:10;border:1px solid #FFFFFF;
        ">
          ${beds} BEDS (${icu} ICU)
        </div>

        <!-- Pin Body -->
        <div style="
          width:36px;height:36px;border-radius:10px;
          background:${color};border:2.5px solid #FFFFFF;
          box-shadow:0 4px 12px rgba(37,99,235,0.35);
          display:flex;align-items:center;justify-content:center;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 4v16M4 12h16" stroke="white" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>

        <div style="
          width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;
          border-top:7px solid #FFFFFF;margin-top:-2px;
        "></div>
      </div>`,
    iconSize: [50, 50],
    iconAnchor: [25, 48],
    popupAnchor: [0, -48],
    className: 'custom-google-marker',
  });
};

/* ── OSRM Route Fetching ──────────────────────────────────────────────── */
async function fetchOSRMRoute(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    const data = await res.json();
    if (data.routes?.[0]) {
      return {
        coords: data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        distanceKm: (data.routes[0].distance / 1000).toFixed(1),
        etaMins: Math.ceil(data.routes[0].duration / 60),
      };
    }
  } catch (err) {
    console.warn('OSRM route fetch fallback:', err);
  }
  return {
    coords: [from, to],
    distanceKm: (haversineMeters(from[0], from[1], to[0], to[1]) / 1000).toFixed(1),
    etaMins: Math.ceil((haversineMeters(from[0], from[1], to[0], to[1]) / 1000) / 40 * 60) || 5,
  };
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
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({ incidents: new Map(), ambulances: new Map(), hospitals: new Map() });
  const activeRouteRef = useRef({ polyline: null, coords: [], lastFetchOrigin: null });
  const userInteractedRef = useRef(false);
  const animFrameRef = useRef(new Map()); // Lerp tracking per ambulance

  /* ── Initialize Map with CARTO Voyager (Google Maps Look) ── */
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [12.9716, 77.5946], // Bengaluru Center
      zoom: 12.5,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 120,
      zoomControl: false,
    });

    // CARTO Voyager Tiles (Google Maps styled raster tiles with crisp road hierarchy)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    const onUserInteract = () => { userInteractedRef.current = true; };
    map.on('dragstart', onUserInteract);
    map.on('zoomstart', onUserInteract);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  /* ── Incident Markers ── */
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const currentIds = new Set(incidents.map(i => i.id));

    markersRef.current.incidents.forEach((m, id) => {
      if (!currentIds.has(id)) {
        mapInstanceRef.current.removeLayer(m);
        markersRef.current.incidents.delete(id);
      }
    });

    incidents.forEach(inc => {
      if (!inc.location_lat || !inc.location_lng) return;
      const latlng = [inc.location_lat, inc.location_lng];
      const icon = makeGoogleIncidentIcon(inc);

      const existing = markersRef.current.incidents.get(inc.id);
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
      } else {
        const m = L.marker(latlng, { icon, zIndexOffset: 600 })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <div style="font-family:'Inter',sans-serif;padding:6px 8px;min-width:180px;">
              <div style="font-weight:800;font-size:13px;color:#0F172A;margin-bottom:2px;">${inc.incident_type || 'Incident'}</div>
              <div style="font-size:11px;color:#475569;margin-bottom:6px;">${inc.location_address || 'Bengaluru'}</div>
              <div style="display:flex;gap:6px;">
                <span style="background:#FEE2E2;color:#EF4444;border-radius:4px;padding:2px 6px;font-size:10.5px;font-weight:800">${inc.severity}</span>
                <span style="background:#F1F5F9;color:#475569;border-radius:4px;padding:2px 6px;font-size:10.5px;font-weight:700">${inc.status}</span>
              </div>
            </div>`)
          .on('click', () => onIncidentClick?.(inc));
        markersRef.current.incidents.set(inc.id, m);
      }
    });
  }, [incidents, onIncidentClick]);

  /* ── Hospital Markers ── */
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const currentIds = new Set(hospitals.map(h => h.id));

    markersRef.current.hospitals.forEach((m, id) => {
      if (!currentIds.has(id)) {
        mapInstanceRef.current.removeLayer(m);
        markersRef.current.hospitals.delete(id);
      }
    });

    hospitals.forEach(h => {
      if (!h.latitude || !h.longitude) return;
      const latlng = [h.latitude, h.longitude];
      const icon = makeGoogleHospitalIcon(h);

      const existing = markersRef.current.hospitals.get(h.id);
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
      } else {
        const m = L.marker(latlng, { icon, zIndexOffset: 300 })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <div style="font-family:'Inter',sans-serif;padding:6px 8px;min-width:180px;">
              <div style="font-weight:800;font-size:13px;color:#0F172A;margin-bottom:2px;">🏥 ${h.name}</div>
              <div style="font-size:11px;color:#475569;margin-bottom:4px;">Emergency Receiving Hospital</div>
              <div style="font-size:11px;font-weight:700;color:#2563EB;">Available Beds: ${h.available_beds || 12} (ICU: ${h.icu_beds_available || 4})</div>
            </div>`);
        markersRef.current.hospitals.set(h.id, m);
      }
    });
  }, [hospitals]);

  /* ── Smooth Ambulance Marker Position Interpolation (Lerp) ── */
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const currentIds = new Set(ambulances.map(a => a.id));

    markersRef.current.ambulances.forEach((m, id) => {
      if (!currentIds.has(id)) {
        mapInstanceRef.current.removeLayer(m);
        markersRef.current.ambulances.delete(id);
      }
    });

    ambulances.forEach(amb => {
      if (!amb.latitude || !amb.longitude) return;
      const targetLatLng = [amb.latitude, amb.longitude];
      const icon = makeGoogleAmbulanceIcon(amb);

      const existing = markersRef.current.ambulances.get(amb.id);
      if (existing) {
        existing.setIcon(icon);

        // Smooth coordinate lerp animation over 800ms
        const startLatLng = existing.getLatLng();
        const startTime = performance.now();
        const duration = 800;

        const animateMove = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // Ease-out quad
          const ease = progress * (2 - progress);

          const curLat = startLatLng.lat + (targetLatLng[0] - startLatLng.lat) * ease;
          const curLng = startLatLng.lng + (targetLatLng[1] - startLatLng.lng) * ease;

          existing.setLatLng([curLat, curLng]);

          if (progress < 1) {
            animFrameRef.current.set(amb.id, requestAnimationFrame(animateMove));
          }
        };

        if (animFrameRef.current.has(amb.id)) {
          cancelAnimationFrame(animFrameRef.current.get(amb.id));
        }
        animFrameRef.current.set(amb.id, requestAnimationFrame(animateMove));
      } else {
        const m = L.marker(targetLatLng, { icon, zIndexOffset: 900 })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <div style="font-family:'Inter',sans-serif;padding:6px 8px;min-width:180px;">
              <div style="font-weight:800;font-size:13px;color:#0F172A;">🚑 ${amb.call_sign || amb.vehicle_number}</div>
              <div style="font-size:11px;color:#475569;margin-bottom:4px;">Driver: ${amb.driver || 'Active Paramedic'}</div>
              <div style="font-size:11px;font-weight:700;color:#2563EB;">Status: ${amb.status}</div>
            </div>`)
          .on('click', () => onAmbulanceClick?.(amb));
        markersRef.current.ambulances.set(amb.id, m);
      }
    });
  }, [ambulances, onAmbulanceClick]);

  /* ── Dynamic OSRM Route & Deviation Recalculation ── */
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (!activeAssignment || !activeAssignment.ambulance || !activeAssignment.incident) {
      if (activeRouteRef.current.polyline) {
        mapInstanceRef.current.removeLayer(activeRouteRef.current.polyline);
        activeRouteRef.current = { polyline: null, coords: [], lastFetchOrigin: null };
      }
      return;
    }

    const amb = activeAssignment.ambulance;
    const inc = activeAssignment.incident;
    const ambLatLng = [amb.latitude, amb.longitude];
    const incLatLng = [inc.location_lat, inc.location_lng];

    const needsRecalculation = () => {
      if (!activeRouteRef.current.polyline) return true;
      // Check if driver has deviated > 200m from route
      const deviation = minDistanceToPolyline(ambLatLng, activeRouteRef.current.coords);
      return deviation > 200;
    };

    if (needsRecalculation()) {
      (async () => {
        const routeData = await fetchOSRMRoute(ambLatLng, incLatLng);
        if (!mapInstanceRef.current) return;

        if (activeRouteRef.current.polyline) {
          mapInstanceRef.current.removeLayer(activeRouteRef.current.polyline);
        }

        const poly = L.polyline(routeData.coords, {
          color: '#2563EB',
          weight: 6,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(mapInstanceRef.current);

        poly.bindTooltip(`🚑 En Route • ETA: ${routeData.etaMins} mins (${routeData.distanceKm} km)`, {
          permanent: true,
          direction: 'center',
          className: 'google-route-tooltip',
        });

        activeRouteRef.current = {
          polyline: poly,
          coords: routeData.coords,
          lastFetchOrigin: ambLatLng,
        };

        if (!userInteractedRef.current) {
          mapInstanceRef.current.fitBounds(L.latLngBounds([ambLatLng, incLatLng]), { padding: [80, 80] });
        }
      })();
    }
  }, [activeAssignment, ambulances]);

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <Box ref={mapRef} sx={{ width: '100%', height: '100%' }} />

      <style>{`
        @keyframes amb-pulse {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes inc-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        .custom-google-marker {
          background: transparent !important;
          border: none !important;
        }
        .google-route-tooltip {
          background: #0F172A !important;
          color: #FFFFFF !important;
          border: 1px solid rgba(255,255,255,0.2) !important;
          font-weight: 800 !important;
          font-size: 11px !important;
          border-radius: 8px !important;
          padding: 3px 8px !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        }
      `}</style>
    </Box>
  );
}
