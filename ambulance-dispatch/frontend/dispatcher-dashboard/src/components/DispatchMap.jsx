import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box } from '@mui/material';

const AMBULANCE_ICON = L.divIcon({
  html: '<div style="font-size: 24px; text-shadow: 1px 1px 2px white;">🚑</div>',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
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

export default function DispatchMap({ 
  incidents = [], 
  ambulances = [], 
  hospitals = [],
  selectedIncident,
  onIncidentClick,
  onAmbulanceClick,
  onHospitalClick,
  center = [20.5937, 78.9629], // India center
  zoom = 5
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({
    incidents: new Map(),
    ambulances: new Map(),
    hospitals: new Map()
  });
  const routeLayerRef = useRef(null);

  useEffect(() => {
    if (mapInstanceRef.current) return;

    mapInstanceRef.current = L.map(mapRef.current).setView(center, zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstanceRef.current);

    routeLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

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

  // Update ambulance markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const currentIds = new Set(ambulances.map(a => a.id));
    
    markersRef.current.ambulances.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        mapInstanceRef.current.removeLayer(marker);
        markersRef.current.ambulances.delete(id);
      }
    });

    ambulances.forEach(ambulance => {
      if (!ambulance.latitude || !ambulance.longitude) return;
      
      const existingMarker = markersRef.current.ambulances.get(ambulance.id);
      
      if (existingMarker) {
        existingMarker.setLatLng([ambulance.latitude, ambulance.longitude]);
      } else {
        const marker = L.marker([ambulance.latitude, ambulance.longitude], { icon: AMBULANCE_ICON })
          .addTo(mapInstanceRef.current)
          .bindPopup(`
            <strong>${ambulance.call_sign || ambulance.vehicle_number}</strong><br/>
            Type: ${ambulance.type}<br/>
            Status: ${ambulance.status}
          `)
          .on('click', () => onAmbulanceClick?.(ambulance));
        
        markersRef.current.ambulances.set(ambulance.id, marker);
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

  // Highlight selected incident
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedIncident) return;
    
    mapInstanceRef.current.setView(
      [selectedIncident.location_lat, selectedIncident.location_lng],
      14
    );
  }, [selectedIncident]);

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
