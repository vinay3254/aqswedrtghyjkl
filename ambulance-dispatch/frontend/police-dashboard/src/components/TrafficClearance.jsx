import React, { useState } from 'react'
import {
  Paper,
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack,
  Divider,
  Card,
  CardContent,
} from '@mui/material'
import {
  Traffic as TrafficIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Block as BlockIcon,
} from '@mui/icons-material'

const TrafficClearance = ({ accidents, trafficClearances, onClearTraffic, onRevokeClearance }) => {
  const [openDialog, setOpenDialog] = useState(false)
  const [selectedAccident, setSelectedAccident] = useState(null)
  const [duration, setDuration] = useState('15')

  const handleOpenDialog = (accident) => {
    setSelectedAccident(accident)
    setDuration('15')
    setOpenDialog(true)
  }

  const handleCloseDialog = () => {
    setOpenDialog(false)
    setSelectedAccident(null)
  }

  const handleConfirmClearance = () => {
    if (selectedAccident) {
      onClearTraffic(selectedAccident.id, parseInt(duration))
      handleCloseDialog()
    }
  }

  const activeAccidents = accidents.filter(a => a.status === 'active')

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Traffic Clearances List */}
      <Paper sx={{ p: 2, flexGrow: 1, overflow: 'auto' }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrafficIcon />
          Active Traffic Clearances
        </Typography>

        {trafficClearances.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
            <TrafficIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography>No active traffic clearances</Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            {trafficClearances.map(clearance => {
              const accident = accidents.find(a => a.id === clearance.accidentId)
              return (
                <Card key={clearance.id} variant="outlined">
                  <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="subtitle2">
                          {accident?.location || `Accident #${clearance.accidentId}`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Duration: {clearance.duration} minutes
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        color="error"
                        startIcon={<BlockIcon />}
                        onClick={() => onRevokeClearance(clearance.id)}
                      >
                        Revoke
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              )
            })}
          </Stack>
        )}
      </Paper>

      <Divider />

      {/* Accidents to Clear */}
      <Paper sx={{ p: 2, flexGrow: 1, overflow: 'auto' }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Request Traffic Clearance
        </Typography>

        {activeAccidents.length === 0 ? (
          <Box sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
            <CheckCircleIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5, color: 'success.main' }} />
            <Typography>No active incidents</Typography>
          </Box>
        ) : (
          <List sx={{ width: '100%' }}>
            {activeAccidents.map(accident => {
              const hasExistingClearance = trafficClearances.some(
                c => c.accidentId === accident.id
              )

              return (
                <ListItem
                  key={accident.id}
                  disablePadding
                  sx={{ mb: 1 }}
                >
                  <ListItemButton
                    disabled={hasExistingClearance}
                    onClick={() => handleOpenDialog(accident)}
                    sx={{
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      p: 1.5,
                      '&:hover': {
                        bgcolor: hasExistingClearance ? 'inherit' : 'action.hover',
                      },
                    }}
                  >
                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle2">
                        {accident.location}
                      </Typography>
                      {hasExistingClearance && (
                        <Chip
                          size="small"
                          label="Cleared"
                          color="success"
                          variant="outlined"
                        />
                      )}
                    </Box>
                    <ListItemText
                      secondary={`Severity: ${accident.severity}`}
                      sx={{ m: 0 }}
                    />
                  </ListItemButton>
                </ListItem>
              )
            })}
          </List>
        )}
      </Paper>

      {/* Clearance Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Request Traffic Clearance
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
            Location: {selectedAccident?.location}
          </Typography>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Clearance Duration</InputLabel>
            <Select
              value={duration}
              label="Clearance Duration"
              onChange={(e) => setDuration(e.target.value)}
            >
              <MenuItem value="5">5 minutes</MenuItem>
              <MenuItem value="10">10 minutes</MenuItem>
              <MenuItem value="15">15 minutes</MenuItem>
              <MenuItem value="20">20 minutes</MenuItem>
              <MenuItem value="30">30 minutes</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ p: 2, bgcolor: '#e3f2fd', borderRadius: 1 }}>
            <Typography variant="caption" color="info.main">
              ⚠️ Traffic clearance will redirect all vehicles away from the incident zone for the selected duration.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleConfirmClearance}
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
          >
            Clear Traffic
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default TrafficClearance
