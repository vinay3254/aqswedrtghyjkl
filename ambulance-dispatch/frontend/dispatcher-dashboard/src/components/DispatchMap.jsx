import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box } from '@mui/material';

/**
 * Haversine formula — returns great-circle distance in km between two lat/lng points.
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const makeAmbulanceIcon = (moving = false) => L.divIcon({
  html: moving
    ? `<div style="position:relative;width:36px;height:36px">
        <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,0.25);animation:amb-ring 1.2s infinite"></div>
        <div style="position:absolute;inset:4px;border-radius:50%;background:rgba(59,130,246,0.15);animation:amb-ring 1.2s 0.4s infinite"></div>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:20px">🚑</div>
       </div>`
    : '<div style="font-size:22px;text-shadow:1px 1px 3px rgba(0,0,0,0.6)">🚑</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  className: 'ambulance-marker'
});

const HOSPITAL_ICON = L.divIcon({
  html: '<div style="font-size: 24px; text-shadow: 1px 1px 2px white;">🏥</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  className: 'hospital-marker'
});

const INCIDENT_ICONS = {
  CRITICAL: L.divIcon({
    html: '<div style="font-size: 28px; animation: pulse 1s infinite;">🔴</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    className: 'incident-marker critical'
  }),
  HIGH: L.divIcon({
    html: '<div style="font-size: 24px;">🟠</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    className: 'incident-marker high'
  }),
  MEDIUM: L.divIcon({
    html: '<div style="font-size: 24px;">🟡</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    className: 'incident-marker medium'
  }),
  LOW: L.divIcon({
    html: '<div style="font-size: 24px;">🟢</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    className: 'incident-marker low'
  })
};

async function fetchRoute(from, to) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=simplified&geometries=geojson`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const data = await res.json();
    if (data.routes?.[0]) {
      return data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    }
  } catch (e) {
    console.error('OSRM fetch failed', e);
  }
  return [from, to];
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
  onHospitalClick,
  center = [19.0760, 72.8777], // Mumbai default
  zoom = 12
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({
    incidents: new Map(),
    ambulances: new Map(),
    hospitals: new Map()
  });
  const trailsRef = useRef(new Map());       // ambulance trail polylines
  const trailPointsRef = useRef(new Map());  // ambulance trail point history
  const followIdRef = useRef(null);          // ambulance id being auto-followed
  const routeLayerRef = useRef(null);
  const nearbyLayerRef = useRef(null);

  useEffect(() => {
    if (mapInstanceRef.current) return;

    mapInstanceRef.current = L.map(mapRef.current).setView(center, zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current);

    routeLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    nearbyLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update incident markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const currentIds = new Set(incidents.map(i => i.id));
    
    // Remove old markers
    markersRef.current.incidents.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        mapInstanceRef.current.removeLayer(marker);
        markersRef.current.incidents.delete(id);
      }
    });

    // Add/update markers
    incidents.forEach(incident => {
      const existingMarker = markersRef.current.incidents.get(incident.id);
      const icon = INCIDENT_ICONS[incident.severity] || INCIDENT_ICONS.MEDIUM;
      
      if (existingMarker) {
        existingMarker.setLatLng([incident.location_lat, incident.location_lng]);
      } else {
        const marker = L.marker([incident.location_lat, incident.location_lng], { icon })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <strong>${incident.incident_type}</strong><br/>
            Severity: ${incident.severity}<br/>
            Status: ${incident.status}<br/>
            ${incident.location_address || ''}
          `)
          .on('click', () => onIncidentClick?.(incident));
        
        markersRef.current.incidents.set(incident.id, marker);
      }
    });
  }, [incidents, onIncidentClick]);

  // Update ambulance markers + trails
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const currentIds = new Set(ambulances.map(a => a.id));
    const TRAIL_MAX = 12;

    // Remove stale markers and trails
    markersRef.current.ambulances.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        mapInstanceRef.current.removeLayer(marker);
        markersRef.current.ambulances.delete(id);
        const trail = trailsRef.current.get(id);
        if (trail) { mapInstanceRef.current.removeLayer(trail); trailsRef.current.delete(id); }
        trailPointsRef.current.delete(id);
      }
    });

    ambulances.forEach(ambulance => {
      if (!ambulance.latitude || !ambulance.longitude) return;
      const moving = ['EN_ROUTE', 'TRANSPORTING'].includes(ambulance.status);
      const latlng = [ambulance.latitude, ambulance.longitude];

      // --- Trail ---
      if (moving) {
        const pts = trailPointsRef.current.get(ambulance.id) || [];
        pts.push(latlng);
        if (pts.length > TRAIL_MAX) pts.shift();
        trailPointsRef.current.set(ambulance.id, pts);

        const existing = trailsRef.current.get(ambulance.id);
        if (existing) {
          existing.setLatLngs(pts);
        } else if (pts.length >= 2) {
          const trail = L.polyline(pts, {
            color: '#3b82f6', weight: 3, opacity: 0.6, dashArray: '4,4'
          }).addTo(mapInstanceRef.current);
          trailsRef.current.set(ambulance.id, trail);
        }
      }

      // --- Marker ---
      const existingMarker = markersRef.current.ambulances.get(ambulance.id);
      if (existingMarker) {
        existingMarker.setLatLng(latlng);
        existingMarker.setIcon(makeAmbulanceIcon(moving));
      } else {
        const marker = L.marker(latlng, { icon: makeAmbulanceIcon(moving) })
          .addTo(mapInstanceRef.current)
          .bindPopup(`<strong>${ambulance.call_sign || ambulance.vehicle_number}</strong><br/>
            ${ambulance.driver || ''}<br/>
            Status: <b>${ambulance.status}</b>`)
          .on('click', () => { followIdRef.current = ambulance.id; onAmbulanceClick?.(ambulance); });
        markersRef.current.ambulances.set(ambulance.id, marker);
      }

      // Auto-follow selected ambulance
      if (followIdRef.current === ambulance.id && moving) {
        mapInstanceRef.current.panTo(latlng, { animate: true, duration: 1 });
      }
    });
  }, [ambulances, onAmbulanceClick]);

  // Update hospital markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const currentIds = new Set(hospitals.map(h => h.id));
    
    markersRef.current.hospitals.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        mapInstanceRef.current.removeLayer(marker);
        markersRef.current.hospitals.delete(id);
      }
    });

    hospitals.forEach(hospital => {
      if (!hospital.latitude || !hospital.longitude) return;
      
      const existingMarker = markersRef.current.hospitals.get(hospital.id);
      
      if (existingMarker) {
        existingMarker.setLatLng([hospital.latitude, hospital.longitude]);
      } else {
        const marker = L.marker([hospital.latitude, hospital.longitude], { icon: HOSPITAL_ICON })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <strong>${hospital.name}</strong><br/>
            Beds: ${hospital.available_beds || 0}/${hospital.total_beds || 0}<br/>
            ICU: ${hospital.icu_beds_available || 0}/${hospital.icu_beds_total || 0}
          `)
          .on('click', () => onHospitalClick?.(hospital));
        
        markersRef.current.hospitals.set(hospital.id, marker);
      }
    });
  }, [hospitals, onHospitalClick]);

  // Fly to ambulance and start auto-follow when selected from panel
  useEffect(() => {
    if (!mapInstanceRef.current || !focusAmbulance) return;
    const { latitude, longitude, id } = focusAmbulance;
    if (latitude && longitude) {
      followIdRef.current = id;
      mapInstanceRef.current.flyTo([latitude, longitude], 15, { duration: 1.2 });
    }
  }, [focusAmbulance]);

  /**
   * Effect 1 — Preview nearby ambulance + top-3 hospitals when an incident is selected.
   * Skipped entirely when activeAssignment is present (Effect 2 owns the map in that state).
   * Deps include activeAssignment so this effect re-runs and clears layers when assignment arrives.
   */
  useEffect(() => {
    let active = true;
    if (!mapInstanceRef.current) return;

    // Clear both layers whenever this effect runs
    if (routeLayerRef.current) routeLayerRef.current.clearLayers();
    if (nearbyLayerRef.current) nearbyLayerRef.current.clearLayers();

    // Nothing selected or an assignment has taken over — stop here
    if (!selectedIncident || activeAssignment) return;

    const iLat = selectedIncident.location_lat;
    const iLng = selectedIncident.location_lng;

    // Pulsing red circle at incident location
    L.circle([iLat, iLng], {
      radius: 300,
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.15,
      dashArray: '6,4',
    }).addTo(nearbyLayerRef.current);

    // Pan map to the incident
    mapInstanceRef.current.setView([iLat, iLng], 13);

    const drawPreviewRoutes = async () => {
      // Find nearest ambulance (only those that carry lat/lng)
      const ambs = ambulances.filter(a => a.latitude && a.longitude);
      if (ambs.length > 0) {
        const nearest = ambs.reduce((best, a) => {
          const d = haversine(a.latitude, a.longitude, iLat, iLng);
          return d < best.dist ? { amb: a, dist: d } : best;
        }, { amb: null, dist: Infinity });

        if (nearest.amb) {
          const routePts = await fetchRoute([nearest.amb.latitude, nearest.amb.longitude], [iLat, iLng]);
          if (!active) return;
          L.polyline(
            routePts,
            { color: '#f97316', weight: 3, dashArray: '8,6', opacity: 0.8 }
          ).addTo(nearbyLayerRef.current);
        }
      }

      // Sort hospitals by distance to incident, take top 3
      const RANK_COLORS = ['#22c55e', '#3b82f6', '#a78bfa'];
      const hosps = hospitals
        .filter(h => h.latitude && h.longitude)
        .map(h => ({ h, dist: haversine(iLat, iLng, h.latitude, h.longitude) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 3);

      hosps.forEach(async ({ h, dist }, rank) => {
        const color = RANK_COLORS[rank];

        const routePts = await fetchRoute([iLat, iLng], [h.latitude, h.longitude]);
        if (!active) return;

        // Dashed colored polyline from incident to hospital
        L.polyline(
          routePts,
          { color, weight: 2, dashArray: '4,8', opacity: 0.6 }
        ).addTo(nearbyLayerRef.current);

        // Proximity circle around hospital
        L.circle([h.latitude, h.longitude], {
          radius: 200,
          color,
          fillColor: color,
          fillOpacity: 0.15,
        }).addTo(nearbyLayerRef.current);

        // Distance label pill badge
        L.marker([h.latitude, h.longitude], {
          icon: L.divIcon({
            html: `<div style="background:${color};color:white;padding:2px 6px;border-radius:10px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 4px rgba(0,0,0,0.5)">${dist.toFixed(1)}km</div>`,
            className: '',
            iconAnchor: [0, -16],
          }),
          interactive: false,
        }).addTo(nearbyLayerRef.current);
      });
    };
    
    drawPreviewRoutes();

    return () => { active = false; };
  }, [selectedIncident, ambulances, hospitals, activeAssignment]);

  /**
   * Effect 2 — Draw confirmed assignment route: ambulance → incident → hospital.
   * Clears both layer groups and draws solid lines for the dispatched assignment.
   */
  useEffect(() => {
    let active = true;
    if (!mapInstanceRef.current) return;
    if (!activeAssignment) return;

    // Clear both layer groups
    if (routeLayerRef.current) routeLayerRef.current.clearLayers();
    if (nearbyLayerRef.current) nearbyLayerRef.current.clearLayers();

    const { incident, ambulance, hospital } = activeAssignment;
    const iLat = incident?.location_lat;
    const iLng = incident?.location_lng;

    if (!iLat || !iLng) return;

    const boundsPoints = [[iLat, iLng]];

    // Pulsing red circle at incident
    L.circle([iLat, iLng], {
      radius: 250,
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.2,
    }).addTo(routeLayerRef.current);

    const drawActiveRoutes = async () => {
      // Ambulance → incident (solid red)
      if (ambulance?.latitude && ambulance?.longitude) {
        boundsPoints.push([ambulance.latitude, ambulance.longitude]);
        const routePts = await fetchRoute([ambulance.latitude, ambulance.longitude], [iLat, iLng]);
        if (!active) return;
        const line = L.polyline(
          routePts,
          { color: '#ef4444', weight: 5, opacity: 0.9 }
        ).addTo(routeLayerRef.current);
        line.bindTooltip('🚑 Ambulance en route to scene', { sticky: true });
      }

      // Incident → hospital (solid blue)
      if (hospital?.latitude && hospital?.longitude) {
        boundsPoints.push([hospital.latitude, hospital.longitude]);
        const routePts = await fetchRoute([iLat, iLng], [hospital.latitude, hospital.longitude]);
        if (!active) return;
        const line = L.polyline(
          routePts,
          { color: '#3b82f6', weight: 5, opacity: 0.9 }
        ).addTo(routeLayerRef.current);
        line.bindTooltip('🏥 Transport route to hospital', { sticky: true });

        // Green proximity circle at hospital
        L.circle([hospital.latitude, hospital.longitude], {
          radius: 200,
          color: '#22c55e',
          fillColor: '#22c55e',
          fillOpacity: 0.2,
        }).addTo(routeLayerRef.current);
      }

      // Fit map to show all three points
      if (boundsPoints.length > 1 && mapInstanceRef.current && active) {
        mapInstanceRef.current.fitBounds(L.latLngBounds(boundsPoints), { padding: [60, 60] });
      }
    };

    drawActiveRoutes();

    return () => { active = false; };
  }, [activeAssignment]);

  return (
    <Box
      ref={mapRef}
      sx={{
        width: '100%',
        height: '100%',
        minHeight: 400,
        '& .ambulance-marker, & .hospital-marker, & .incident-marker': {
          background: 'transparent',
          border: 'none'
        },
        '@keyframes amb-ring': {
          '0%': { transform: 'scale(0.6)', opacity: 0.8 },
          '100%': { transform: 'scale(1.8)', opacity: 0 },
        },
        '& .critical': {
          animation: 'pulse 1s infinite'
        },
        '@keyframes pulse': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' }
        }
      }}
    />
  );
}
