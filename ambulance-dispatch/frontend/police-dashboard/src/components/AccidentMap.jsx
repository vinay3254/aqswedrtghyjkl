import React from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet'
import L from 'leaflet'
import { Box } from '@mui/material'

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom icons for accidents and ambulances
const accidentIcon = (severity) => {
  const color = severity === 'high' ? '#d32f2f' : severity === 'medium' ? '#f57c00' : '#fbc02d'
  return L.divIcon({
    html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center;">⚠️</div>`,
    iconSize: [30, 30],
    className: 'accident-icon',
  })
}

const ambulanceIcon = L.divIcon({
  html: `<div style="background-color: #4caf50; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center;">🚑</div>`,
  iconSize: [30, 30],
  className: 'ambulance-icon',
})

const AccidentMap = ({ accidents, ambulances }) => {
  const defaultCenter = [40.7128, -74.0060] // NYC center
  const zoom = 12

  return (
    <Box sx={{ width: '100%', height: '100%', borderRadius: 1, overflow: 'hidden' }}>
      <MapContainer
        center={defaultCenter}
        zoom={zoom}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Accident Markers */}
        {accidents.map(accident => (
          <React.Fragment key={accident.id}>
            <Marker
              position={[accident.lat, accident.lng]}
              icon={accidentIcon(accident.severity)}
            >
              <Popup>
                <div>
                  <h3>{accident.location}</h3>
                  <p><strong>Severity:</strong> {accident.severity}</p>
                  <p><strong>Status:</strong> {accident.status}</p>
                </div>
              </Popup>
            </Marker>
            {/* Incident radius */}
            <Circle
              center={[accident.lat, accident.lng]}
              radius={300}
              pathOptions={{
                color: accident.severity === 'high' ? '#d32f2f' : accident.severity === 'medium' ? '#f57c00' : '#fbc02d',
                fill: true,
                fillOpacity: 0.1,
              }}
            />
          </React.Fragment>
        ))}

        {/* Ambulance Markers */}
        {ambulances.map(ambulance => (
          <Marker
            key={ambulance.id}
            position={[ambulance.lat, ambulance.lng]}
            icon={ambulanceIcon}
          >
            <Popup>
              <div>
                <h3>Ambulance {ambulance.id}</h3>
                <p><strong>Status:</strong> {ambulance.status}</p>
                <p><strong>ETA:</strong> {ambulance.eta} min</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </Box>
  )
}

export default AccidentMap
