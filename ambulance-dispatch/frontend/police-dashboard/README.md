# Police Coordination Dashboard

A real-time traffic coordination dashboard for police departments to manage ambulance routes during emergencies.

## Features

- **Real-time Map View**: Displays accident locations and ambulance positions
- **Traffic Clearance Management**: Request and manage traffic clearances for ambulance routes
- **Active Incident Tracking**: Monitor active accidents and their severity levels
- **Ambulance Coordination**: Track ambulance response status and ETAs
- **Live Statistics**: Dashboard metrics for quick situational awareness

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5174`

## Building

```bash
npm run build
```

## Project Structure

```
src/
├── components/
│   ├── AccidentMap.jsx        # Map view for incidents and ambulances
│   └── TrafficClearance.jsx   # Traffic clearance control panel
├── pages/
│   └── DashboardPage.jsx      # Main dashboard page
├── App.jsx                    # App router and main component
├── main.jsx                   # React entry point
└── index.css                  # Global styles
```

## Technologies

- React 19
- Material-UI 7
- Leaflet & React-Leaflet (mapping)
- Vite (build tool)
- Socket.IO (real-time updates)

## License

Proprietary
