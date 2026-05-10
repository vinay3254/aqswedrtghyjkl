import React, { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  AppBar,
  Toolbar,
  Card,
  CardContent,
  Badge,
} from '@mui/material'
import {
  Traffic as TrafficIcon,
  Accident as AccidentIcon,
  LocalPolice as PoliceIcon,
  Emergency as EmergencyIcon,
} from '@mui/icons-material'
import AccidentMap from '../components/AccidentMap'
import TrafficClearance from '../components/TrafficClearance'

const DashboardPage = () => {
  const [accidents, setAccidents] = useState([
    { id: 1, location: 'Main St & 5th Ave', lat: 40.7128, lng: -74.006, severity: 'high', status: 'active' },
    { id: 2, location: 'Broadway & 42nd St', lat: 40.758, lng: -73.9855, severity: 'medium', status: 'active' },
    { id: 3, location: 'Park Ave & 34th St', lat: 40.7489, lng: -73.9680, severity: 'low', status: 'resolved' },
  ])

  const [ambulances, setAmbulances] = useState([
    { id: 1, location: 'Main St & 5th Ave', lat: 40.7128, lng: -74.006, status: 'responding', eta: 3 },
    { id: 2, location: 'Broadway & 42nd St', lat: 40.758, lng: -73.9855, status: 'en-route', eta: 5 },
    { id: 3, location: 'Park Ave & 34th St', lat: 40.7489, lng: -73.9680, status: 'on-scene', eta: 0 },
  ])

  const [trafficClearances, setTrafficClearances] = useState([])

  const activeAccidents = accidents.filter(a => a.status === 'active').length
  const respondingAmbulances = ambulances.filter(a => a.status === 'responding' || a.status === 'en-route').length

  const handleClearTraffic = (accidentId, duration) => {
    const clearance = {
      id: Date.now(),
      accidentId,
      duration,
      timestamp: new Date(),
      status: 'active',
    }
    setTrafficClearances([...trafficClearances, clearance])
  }

  const handleRevokeClearance = (clearanceId) => {
    setTrafficClearances(trafficClearances.filter(c => c.id !== clearanceId))
  }

  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <AppBar position="static">
        <Toolbar>
          <PoliceIcon sx={{ mr: 2 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Police Coordination Dashboard
          </Typography>
          <Typography variant="body2">
            {new Date().toLocaleTimeString()}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', bgcolor: '#f5f5f5', p: 2 }}>
        <Container maxWidth="lg" sx={{ height: '100%' }}>
          {/* Stats Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Active Accidents
                      </Typography>
                      <Typography variant="h4">
                        {activeAccidents}
                      </Typography>
                    </Box>
                    <Badge badgeContent={activeAccidents} color="error">
                      <AccidentIcon sx={{ fontSize: 40, color: '#d32f2f' }} />
                    </Badge>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Ambulances Responding
                      </Typography>
                      <Typography variant="h4">
                        {respondingAmbulances}
                      </Typography>
                    </Box>
                    <Badge badgeContent={respondingAmbulances} color="warning">
                      <EmergencyIcon sx={{ fontSize: 40, color: '#f57c00' }} />
                    </Badge>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Traffic Clearances
                      </Typography>
                      <Typography variant="h4">
                        {trafficClearances.length}
                      </Typography>
                    </Box>
                    <Badge badgeContent={trafficClearances.length} color="info">
                      <TrafficIcon sx={{ fontSize: 40, color: '#1976d2' }} />
                    </Badge>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography color="textSecondary" gutterBottom>
                        Avg Response Time
                      </Typography>
                      <Typography variant="h4">
                        4 min
                      </Typography>
                    </Box>
                    <PoliceIcon sx={{ fontSize: 40, color: '#1976d2' }} />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Map and Traffic Control */}
          <Grid container spacing={2} sx={{ height: 'calc(100% - 200px)' }}>
            <Grid item xs={12} md={7} sx={{ height: '100%' }}>
              <Paper sx={{ height: '100%', p: 2 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Accident Locations & Ambulance Routes
                </Typography>
                <AccidentMap accidents={accidents} ambulances={ambulances} />
              </Paper>
            </Grid>

            <Grid item xs={12} md={5} sx={{ height: '100%' }}>
              <TrafficClearance
                accidents={accidents}
                trafficClearances={trafficClearances}
                onClearTraffic={handleClearTraffic}
                onRevokeClearance={handleRevokeClearance}
              />
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  )
}

export default DashboardPage
