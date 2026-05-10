import React from 'react';
import {
  List, ListItem, ListItemText, ListItemIcon, ListItemSecondaryAction,
  Chip, Typography, Box, IconButton, Tooltip, Divider, Paper
} from '@mui/material';
import { 
  LocalHospital, LocalTaxi, AccessTime, CheckCircle, 
  NavigateNext, Warning, PriorityHigh
} from '@mui/icons-material';

const SEVERITY_CONFIG = {
  CRITICAL: { color: 'error', icon: <PriorityHigh />, label: 'Critical' },
  HIGH: { color: 'warning', icon: <Warning />, label: 'High' },
  MEDIUM: { color: 'info', icon: null, label: 'Medium' },
  LOW: { color: 'success', icon: null, label: 'Low' }
};

const STATUS_CONFIG = {
  PENDING: { color: '#f59e0b', label: 'Pending' },
  ACKNOWLEDGED: { color: '#3b82f6', label: 'Acknowledged' },
  DISPATCHED: { color: '#8b5cf6', label: 'Dispatched' },
  EN_ROUTE: { color: '#22c55e', label: 'En Route' },
  ON_SCENE: { color: '#06b6d4', label: 'On Scene' },
  TRANSPORTING: { color: '#ec4899', label: 'Transporting' },
  AT_HOSPITAL: { color: '#6366f1', label: 'At Hospital' },
  RESOLVED: { color: '#10b981', label: 'Resolved' },
  CANCELLED: { color: '#6b7280', label: 'Cancelled' }
};

function formatTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000);
  
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString();
}

export default function IncidentQueue({ 
  incidents, 
  onSelect, 
  selectedId,
  filter = 'active'
}) {
  const filtered = incidents.filter(i => {
    if (filter === 'active') {
      return !['RESOLVED', 'CANCELLED'].includes(i.status);
    }
    if (filter === 'pending') {
      return ['PENDING', 'ACKNOWLEDGED'].includes(i.status);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const aSev = severityOrder[a.severity] ?? 99;
    const bSev = severityOrder[b.severity] ?? 99;
    if (aSev !== bSev) return aSev - bSev;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  if (sorted.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">No incidents</Typography>
      </Box>
    );
  }

  return (
    <List sx={{ p: 0 }}>
      {sorted.map((incident, index) => {
        const severity = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.MEDIUM;
        const status = STATUS_CONFIG[incident.status] || STATUS_CONFIG.PENDING;
        const isSelected = incident.id === selectedId;

        return (
          <React.Fragment key={incident.id}>
            <ListItem
              button
              selected={isSelected}
              onClick={() => onSelect(incident)}
              sx={{
                borderLeft: 4,
                borderLeftColor: severity.color + '.main',
                bgcolor: isSelected ? 'action.selected' : 'inherit',
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {severity.icon || <LocalHospital color={severity.color} />}
              </ListItemIcon>
              
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2" noWrap sx={{ maxWidth: 120 }}>
                      {incident.incident_type}
                    </Typography>
                    <Chip
                      label={status.label}
                      size="small"
                      sx={{ 
                        bgcolor: status.color, 
                        color: 'white',
                        height: 20,
                        fontSize: '0.7rem'
                      }}
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="caption" noWrap display="block" color="text.secondary">
                      {incident.location_address || `${incident.location_lat?.toFixed(4)}, ${incident.location_lng?.toFixed(4)}`}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                      <AccessTime sx={{ fontSize: 12 }} color="disabled" />
                      <Typography variant="caption" color="text.secondary">
                        {formatTimeAgo(incident.created_at)}
                      </Typography>
                      {incident.assignment && (
                        <>
                          <LocalTaxi sx={{ fontSize: 12, ml: 1 }} color="success" />
                          <Typography variant="caption" color="success.main">
                            Assigned
                          </Typography>
                        </>
                      )}
                    </Box>
                  </Box>
                }
              />
              
              <ListItemSecondaryAction>
                <IconButton edge="end" size="small">
                  <NavigateNext />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
            {index < sorted.length - 1 && <Divider />}
          </React.Fragment>
        );
      })}
    </List>
  );
}
