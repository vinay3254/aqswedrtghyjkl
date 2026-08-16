import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box } from '@mui/material';

/* ── Haversine distance ──────────────────────────────────────────────── */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* ── Clean SVG icons ─────────────────────────────────────────────────── */
const makeAmbulanceIcon = (status = 'AVAILABLE') => {
  const moving = ['EN_ROUTE', 'TRANSPORTING'].includes(status);
  const color  = moving ? '#ef4444' : '#22c55e';
  const ring   = moving
    ? `<div style="position:absolute;inset:-6px;border-radius:50%;border:2px solid ${color};opacity:0.5;animation:amb-pulse 1.2s infinite"></div>`
    : '';
  return L.divIcon({
    html: `
      <div style="position:relative;width:32px;height:32px">
        ${ring}
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:${color};
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);
          border:2px solid rgba(255,255,255,0.25);
        ">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="5" width="13" height="9" rx="2" fill="white" opacity="0.9"/>
            <path d="M14 8l3 1.5L14 11V8z" fill="white" opacity="0.9"/>
            <line x1="5" y1="8.5" x2="9" y2="8.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="7" y1="6.5" x2="7" y2="10.5" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    className: '',
  });
};

const makeHospitalIcon = (bedsAvail = 0) => {
  const color = bedsAvail > 10 ? '#3b82f6' : bedsAvail > 3 ? '#f59e0b' : '#ef4444';
  return L.divIcon({
    html: `
      <div style="
        width:30px;height:30px;border-radius:6px;
        background:${color};
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 8px rgba(0,0,0,0.5);
        border:2px solid rgba(255,255,255,0.3);
      ">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <line x1="4" y1="8" x2="12" y2="8" stroke="white" stroke-width="2" stroke-linecap="round"/>
          <line x1="8" y1="4" x2="8" y2="12" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    className: '',
  });
};

const makeIncidentIcon = (severity = 'MEDIUM') => {
  const cfg = {
    CRITICAL: { color: '#ef4444', size: 36, pulse: true  },
    HIGH:     { color: '#f97316', size: 32, pulse: true  },
    MEDIUM:   { color: '#f59e0b', size: 28, pulse: false },
    LOW:      { color: '#22c55e', size: 26, pulse: false },
  }[severity] || { color: '#f59e0b', size: 28, pulse: false };

  const ring = cfg.pulse
    ? `<div style="position:absolute;inset:-5px;border-radius:50%;background:${cfg.color};opacity:0.2;animation:inc-pulse 1.2s infinite"></div>`
    : '';

  return L.divIcon({
    html: `
      <div style="position:relative;width:${cfg.size}px;height:${cfg.size}px">
        ${ring}
        <div style="
          width:${cfg.size}px;height:${cfg.size}px;border-radius:50%;
          background:${cfg.color};
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 0 12px ${cfg.color}88;
          border:2px solid rgba(255,255,255,0.35);
        ">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2l5 9H2L7 2z" fill="white" opacity="0.9"/>
            <line x1="7" y1="6" x2="7" y2="8.5" stroke="${cfg.color}" stroke-width="1.4" stroke-linecap="round"/>
            <circle cx="7" cy="10" r="0.7" fill="${cfg.color}"/>
          </svg>
        </div>
      </div>`,
    iconSize: [cfg.size, cfg.size],
    iconAnchor: [cfg.size/2, cfg.size/2],
    className: '',
  });
};

/* ── OSRM route fetch ────────────────────────────────────────────────── */
async function fetchRoute(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (data.routes?.[0]) {
      return {
        coords: data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]),
        distance: (data.routes[0].distance / 1000).toFixed(1),
        duration: Math.ceil(data.routes[0].duration / 60),
      };
    }
  } catch {}
  return { coords: [from, to], distance: '?', duration: '?' };
}

/* ── Popup HTML helpers ──────────────────────────────────────────────── */
const popupStyle = `
  font-family: -apple-system, sans-serif;
  background: #FFFFFF;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: white;
  padding: 10px 14px;
  min-width: 160px;
`;

export default function DispatchMap({
  incidents = [],
  ambulances = [],
  hospitals = [],
  selectedIncident,
  activeAssignment,
  focusAmbulance,
  onIncidentClick,
  onAmbulanceClick,
  center = [12.9716, 77.5946], // Bangalore default
  zoom = 12,
}) {
  const mapRef           = useRef(null);
  const mapInstanceRef   = useRef(null);
  const markersRef       = useRef({ incidents: new Map(), ambulances: new Map(), hospitals: new Map() });
  const trailsRef        = useRef(new Map());
  const trailPointsRef   = useRef(new Map());
  const followIdRef      = useRef(null);
  const initialFitDoneRef = useRef(false);
  const lastCenteredIncidentIdRef = useRef(null);
  const lastFitAssignmentIdRef    = useRef(null);
  const routeLayerRef    = useRef(null);
  const previewLayerRef  = useRef(null);

  /* ── Init map ── */
  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
    }).setView(center, zoom);

    map.on('dragstart zoomstart', () => {
      followIdRef.current = null;
    });

    /* OSM tiles with CSS dark filter — works on any connection */
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
      className: 'map-light-tiles',
    }).addTo(map);

    /* Custom zoom controls — bottom right */
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    routeLayerRef.current  = L.layerGroup().addTo(map);
    previewLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  /* ── Incident markers ── */
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const currentIds = new Set(incidents.map(i => i.id));

    markersRef.current.incidents.forEach((m, id) => {
      if (!currentIds.has(id)) { mapInstanceRef.current.removeLayer(m); markersRef.current.incidents.delete(id); }
    });

    incidents.forEach(inc => {
      const latlng = [inc.location_lat, inc.location_lng];
      const icon = makeIncidentIcon(inc.severity);
      const existing = markersRef.current.incidents.get(inc.id);
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
      } else {
        const m = L.marker(latlng, { icon, zIndexOffset: 500 })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<div style="${popupStyle}">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px">${inc.incident_type || 'Incident'}</div>
            <div style="color:rgba(255,255,255,0.5);font-size:11px;margin-bottom:6px">${inc.location_address || ''}</div>
            <div style="display:flex;gap:8px">
              <span style="background:rgba(239,68,68,0.2);color:#fca5a5;border-radius:4px;padding:2px 7px;font-size:11px">${inc.severity}</span>
              <span style="background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);border-radius:4px;padding:2px 7px;font-size:11px">${inc.status}</span>
            </div>
          </div>`, { className: 'dark-popup' })
          .on('click', () => onIncidentClick?.(inc));
        markersRef.current.incidents.set(inc.id, m);
      }
    });
  }, [incidents, onIncidentClick]);

  /* ── Ambulance markers + trails ── */
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const TRAIL_MAX = 10;
    const currentIds = new Set(ambulances.map(a => a.id));

    markersRef.current.ambulances.forEach((m, id) => {
      if (!currentIds.has(id)) {
        mapInstanceRef.current.removeLayer(m);
        markersRef.current.ambulances.delete(id);
        const trail = trailsRef.current.get(id);
        if (trail) { mapInstanceRef.current.removeLayer(trail); trailsRef.current.delete(id); }
        trailPointsRef.current.delete(id);
      }
    });

    ambulances.forEach(amb => {
      if (!amb.latitude || !amb.longitude) return;
      const latlng = [amb.latitude, amb.longitude];
      const moving = ['EN_ROUTE', 'TRANSPORTING'].includes(amb.status);

      if (moving) {
        const pts = trailPointsRef.current.get(amb.id) || [];
        pts.push(latlng);
        if (pts.length > TRAIL_MAX) pts.shift();
        trailPointsRef.current.set(amb.id, pts);
        const existingTrail = trailsRef.current.get(amb.id);
        if (existingTrail) {
          existingTrail.setLatLngs(pts);
        } else if (pts.length >= 2) {
          const trail = L.polyline(pts, { color: '#ef4444', weight: 2, opacity: 0.5, dashArray: '3,5' })
            .addTo(mapInstanceRef.current);
          trailsRef.current.set(amb.id, trail);
        }
      }

      const existing = markersRef.current.ambulances.get(amb.id);
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(makeAmbulanceIcon(amb.status));
      } else {
        const m = L.marker(latlng, { icon: makeAmbulanceIcon(amb.status), zIndexOffset: 1000 })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<div style="${popupStyle}">
            <div style="font-weight:700;font-size:13px;margin-bottom:3px">${amb.call_sign || amb.vehicle_number}</div>
            <div style="color:rgba(255,255,255,0.5);font-size:11px;margin-bottom:6px">${amb.driver || 'Driver'}</div>
            <span style="background:${moving ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'};color:${moving ? '#fca5a5' : '#86efac'};border-radius:4px;padding:2px 8px;font-size:11px">${amb.status}</span>
          </div>`, { className: 'dark-popup' })
          .on('click', () => { followIdRef.current = amb.id; onAmbulanceClick?.(amb); });
        markersRef.current.ambulances.set(amb.id, m);
      }

      if (followIdRef.current === amb.id && moving) {
        mapInstanceRef.current.panTo(latlng, { animate: true, duration: 0.8 });
      }
    });

    // On first ambulance load, fit map to show all of them
    if (!initialFitDoneRef.current && ambulances.length > 0) {
      const pts = ambulances.filter(a => a.latitude && a.longitude).map(a => [a.latitude, a.longitude]);
      if (pts.length > 0) {
        mapInstanceRef.current.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 14, animate: true });
        initialFitDoneRef.current = true;
      }
    }
  }, [ambulances, onAmbulanceClick]);

  /* ── Hospital markers ── */
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const currentIds = new Set(hospitals.map(h => h.id));

    markersRef.current.hospitals.forEach((m, id) => {
      if (!currentIds.has(id)) { mapInstanceRef.current.removeLayer(m); markersRef.current.hospitals.delete(id); }
    });

    hospitals.forEach(h => {
      if (!h.latitude || !h.longitude) return;
      const existing = markersRef.current.hospitals.get(h.id);
      if (existing) {
        existing.setLatLng([h.latitude, h.longitude]);
        existing.setIcon(makeHospitalIcon(h.available_beds));
      } else {
        const m = L.marker([h.latitude, h.longitude], { icon: makeHospitalIcon(h.available_beds) })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<div style="${popupStyle}">
            <div style="font-weight:700;font-size:13px;margin-bottom:3px">${h.name}</div>
            <div style="display:flex;gap:6px;margin-top:4px">
              <span style="background:rgba(59,130,246,0.2);color:#93c5fd;border-radius:4px;padding:2px 7px;font-size:11px">Beds: ${h.available_beds || 0}/${h.total_beds || 0}</span>
              <span style="background:rgba(139,92,246,0.2);color:#c4b5fd;border-radius:4px;padding:2px 7px;font-size:11px">ICU: ${h.icu_beds_available || 0}</span>
            </div>
          </div>`, { className: 'dark-popup' });
        markersRef.current.hospitals.set(h.id, m);
      }
    });
  }, [hospitals]);

  /* ── Focus on ambulance ── */
  useEffect(() => {
    if (!mapInstanceRef.current || !focusAmbulance) return;
    const { latitude, longitude, id } = focusAmbulance;
    if (latitude && longitude) {
      followIdRef.current = id;
      mapInstanceRef.current.flyTo([latitude, longitude], 15, { duration: 1.0 });
    }
  }, [focusAmbulance]);

  /* ── Preview: selected incident (no active assignment) ── */
  useEffect(() => {
    let alive = true;
    if (!mapInstanceRef.current) return;
    previewLayerRef.current?.clearLayers();

    if (!selectedIncident || activeAssignment) return;

    const iLat = selectedIncident.location_lat;
    const iLng = selectedIncident.location_lng;

    /* Pulsing ring at incident */
    L.circle([iLat, iLng], {
      radius: 250,
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.12,
      weight: 1.5,
      dashArray: '5,4',
    }).addTo(previewLayerRef.current);

    if (selectedIncident && selectedIncident.id !== lastCenteredIncidentIdRef.current) {
      mapInstanceRef.current.setView([iLat, iLng], 13, { animate: true });
      lastCenteredIncidentIdRef.current = selectedIncident.id;
    }

    (async () => {
      /* Nearest available ambulance → incident (single orange dashed line) */
      const ambs = ambulances.filter(a => a.latitude && a.longitude && a.status === 'AVAILABLE');
      if (ambs.length > 0 && alive) {
        const nearest = ambs.reduce((best, a) => {
          const d = haversine(a.latitude, a.longitude, iLat, iLng);
          return d < best.dist ? { amb: a, dist: d } : best;
        }, { amb: null, dist: Infinity });

        if (nearest.amb) {
          const { coords, duration } = await fetchRoute([nearest.amb.latitude, nearest.amb.longitude], [iLat, iLng]);
          if (!alive) return;
          L.polyline(coords, { color: '#f97316', weight: 3, opacity: 0.75, dashArray: '6,5' })
            .addTo(previewLayerRef.current)
            .bindTooltip(`ETA ~${duration} min`, { permanent: false, direction: 'center' });
        }
      }

      /* Nearest hospital (just 1 — green dashed) */
      const hosps = hospitals
        .filter(h => h.latitude && h.longitude && (h.available_beds || 0) > 0)
        .map(h => ({ h, dist: haversine(iLat, iLng, h.latitude, h.longitude) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 1);

      if (hosps.length > 0 && alive) {
        const { coords, distance } = await fetchRoute([iLat, iLng], [hosps[0].h.latitude, hosps[0].h.longitude]);
        if (!alive) return;
        L.polyline(coords, { color: '#22c55e', weight: 2, opacity: 0.6, dashArray: '4,6' })
          .addTo(previewLayerRef.current)
          .bindTooltip(`${hosps[0].h.name} · ${distance} km`, { permanent: false, direction: 'center' });
      }
    })();

    return () => { alive = false; };
  }, [selectedIncident, ambulances, hospitals, activeAssignment]);

  /* ── Active assignment: ambulance → incident → hospital ── */
  useEffect(() => {
    let alive = true;
    if (!mapInstanceRef.current) return;
    routeLayerRef.current?.clearLayers();
    if (!activeAssignment) return;

    previewLayerRef.current?.clearLayers();

    const { incident, ambulance, hospital } = activeAssignment;
    const iLat = incident?.location_lat;
    const iLng = incident?.location_lng;
    if (!iLat || !iLng) return;

    /* Incident ring */
    L.circle([iLat, iLng], {
      radius: 200,
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.18,
      weight: 2,
    }).addTo(routeLayerRef.current);

    (async () => {
      const boundsPoints = [[iLat, iLng]];

      /* Ambulance → incident: thick red solid */
      if (ambulance?.latitude && ambulance?.longitude && alive) {
        boundsPoints.push([ambulance.latitude, ambulance.longitude]);
        const { coords, duration } = await fetchRoute([ambulance.latitude, ambulance.longitude], [iLat, iLng]);
        if (!alive) return;
        L.polyline(coords, { color: '#ef4444', weight: 4, opacity: 0.9 })
          .addTo(routeLayerRef.current)
          .bindTooltip(`🚑 En route · ~${duration} min`, { sticky: true });

        /* Animated dashed overlay for moving effect */
        L.polyline(coords, { color: '#fca5a5', weight: 2, opacity: 0.5, dashArray: '8,10' })
          .addTo(routeLayerRef.current);
      }

      /* Incident → hospital: thick blue solid */
      if (hospital?.latitude && hospital?.longitude && alive) {
        boundsPoints.push([hospital.latitude, hospital.longitude]);
        const { coords, distance } = await fetchRoute([iLat, iLng], [hospital.latitude, hospital.longitude]);
        if (!alive) return;
        L.polyline(coords, { color: '#3b82f6', weight: 4, opacity: 0.9 })
          .addTo(routeLayerRef.current)
          .bindTooltip(`🏥 ${hospital.name || 'Hospital'} · ${distance} km`, { sticky: true });

        /* Hospital arrival ring */
        L.circle([hospital.latitude, hospital.longitude], {
          radius: 150,
          color: '#22c55e',
          fillColor: '#22c55e',
          fillOpacity: 0.15,
          weight: 1.5,
        }).addTo(routeLayerRef.current);
      }

      if (boundsPoints.length > 1 && alive && activeAssignment.id !== lastFitAssignmentIdRef.current) {
        mapInstanceRef.current.fitBounds(L.latLngBounds(boundsPoints), { padding: [80, 80], animate: true });
        lastFitAssignmentIdRef.current = activeAssignment.id;
      }
    })();

    return () => { alive = false; };
  }, [activeAssignment]);

  return (
    <Box
      ref={mapRef}
      sx={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        '& .ambulance-marker, & .hospital-marker, & .incident-marker': {
          background: 'transparent',
          border: 'none',
        },
        /* Popup dark theme override */
        '& .dark-popup .leaflet-popup-content-wrapper': {
          background: '#FFFFFF',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          color: 'white',
          padding: 0,
        },
        '& .dark-popup .leaflet-popup-content': {
          margin: 0,
        },
        '& .dark-popup .leaflet-popup-tip': {
          background: '#FFFFFF',
        },
        '& .leaflet-control-zoom': {
          border: '1px solid rgba(255,255,255,0.1) !important',
          borderRadius: '6px !important',
          overflow: 'hidden',
        },
        '& .leaflet-control-zoom a': {
          background: '#FFFFFF !important',
          color: 'white !important',
          borderColor: 'rgba(255,255,255,0.1) !important',
          '&:hover': { background: '#334155 !important' },
        },
        /* Dark tile filter — inverts OSM to night mode */
        '& .map-dark-tiles': {
          filter: 'none',
        },
        /* Marker pulse animations */
        '@keyframes amb-pulse': {
          '0%':   { transform: 'scale(1)',   opacity: 0.7 },
          '100%': { transform: 'scale(2.2)', opacity: 0   },
        },
        '@keyframes inc-pulse': {
          '0%':   { transform: 'scale(1)',   opacity: 0.5 },
          '100%': { transform: 'scale(2.5)', opacity: 0   },
        },
      }}
    />
  );
}
