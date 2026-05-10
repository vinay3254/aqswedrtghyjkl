import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Linking, TouchableOpacity
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { connectSocket, socket } from '../services/socket';
import api from '../services/api';

const STATUS_INFO = {
  PENDING: { emoji: '⏳', label: 'Finding ambulance...', color: '#f59e0b' },
  ACKNOWLEDGED: { emoji: '✅', label: 'Dispatcher notified', color: '#3b82f6' },
  DISPATCHED: { emoji: '🚑', label: 'Ambulance assigned', color: '#8b5cf6' },
  EN_ROUTE: { emoji: '🚨', label: 'Ambulance on the way!', color: '#22c55e' },
  ON_SCENE: { emoji: '📍', label: 'Ambulance arrived', color: '#22c55e' },
  TRANSPORTING: { emoji: '🏥', label: 'Going to hospital', color: '#06b6d4' },
  AT_HOSPITAL: { emoji: '🏨', label: 'At hospital', color: '#6366f1' },
  RESOLVED: { emoji: '✅', label: 'Completed', color: '#22c55e' }
};

export default function TrackingScreen({ route, navigation }) {
  const { incident: initialIncident } = route.params;
  const [incident, setIncident] = useState(initialIncident);
  const [ambulanceLocation, setAmbulanceLocation] = useState(null);
  const [eta, setEta] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const mapRef = useRef(null);

  useEffect(() => {
    setupTracking();
    const interval = setInterval(fetchUpdates, 10000);
    return () => {
      clearInterval(interval);
      socket?.disconnect();
    };
  }, []);

  const setupTracking = async () => {
    connectSocket();

    socket.on('incident:updated', (data) => {
      if (data.id === incident.id) {
        setIncident(data);
        AsyncStorage.setItem('activeIncident', JSON.stringify(data));
      }
    });

    socket.on('ambulance:location', (data) => {
      if (assignment && data.ambulance_id === assignment.ambulance_id) {
        setAmbulanceLocation({ latitude: data.latitude, longitude: data.longitude });
      }
    });

    socket.on('assignment:created', (data) => {
      if (data.incident_id === incident.id) {
        setAssignment(data);
      }
    });

    await fetchUpdates();
  };

  const fetchUpdates = async () => {
    try {
      const response = await api.get(`/incidents/${incident.id}`);
      setIncident(response.data);
      AsyncStorage.setItem('activeIncident', JSON.stringify(response.data));

      if (response.data.assignment) {
        setAssignment(response.data.assignment);
        setEta(response.data.assignment.estimated_arrival_time);

        if (response.data.assignment.ambulance) {
          setAmbulanceLocation({
            latitude: response.data.assignment.ambulance.latitude,
            longitude: response.data.assignment.ambulance.longitude
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch updates:', error);
    }
  };

  const callDriver = () => {
    if (assignment?.ambulance?.driver_phone) {
      Linking.openURL(`tel:${assignment.ambulance.driver_phone}`);
    }
  };

  const status = STATUS_INFO[incident.status] || STATUS_INFO.PENDING;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: incident.location_lat,
          longitude: incident.location_lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02
        }}
      >
        <Marker
          coordinate={{ latitude: incident.location_lat, longitude: incident.location_lng }}
          title="Your Location"
          pinColor="#dc2626"
        />
        {ambulanceLocation && (
          <Marker
            coordinate={ambulanceLocation}
            title="Ambulance"
          >
            <View style={styles.ambulanceMarker}>
              <Text style={styles.ambulanceEmoji}>🚑</Text>
            </View>
          </Marker>
        )}
      </MapView>

      <View style={styles.infoCard}>
        <View style={[styles.statusBadge, { backgroundColor: status.color }]}>
          <Text style={styles.statusEmoji}>{status.emoji}</Text>
          <Text style={styles.statusText}>{status.label}</Text>
        </View>

        {eta && (
          <View style={styles.etaContainer}>
            <Text style={styles.etaLabel}>ETA</Text>
            <Text style={styles.etaTime}>{eta} min</Text>
          </View>
        )}

        {assignment?.ambulance && (
          <View style={styles.ambulanceInfo}>
            <Text style={styles.ambulanceLabel}>
              🚑 {assignment.ambulance.call_sign || 'Ambulance'} ({assignment.ambulance.type})
            </Text>
            {assignment.ambulance.driver_phone && (
              <TouchableOpacity style={styles.callButton} onPress={callDriver}>
                <Text style={styles.callButtonText}>📞 Call Driver</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {incident.status === 'RESOLVED' && (
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => {
              AsyncStorage.removeItem('activeIncident');
              navigation.replace('Home');
            }}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.6 },
  ambulanceMarker: {
    backgroundColor: '#fff', borderRadius: 20, padding: 8, borderWidth: 2, borderColor: '#22c55e'
  },
  ambulanceEmoji: { fontSize: 24 },
  infoCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, elevation: 8, minHeight: 200
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'center',
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30
  },
  statusEmoji: { fontSize: 24 },
  statusText: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginLeft: 8 },
  etaContainer: { alignItems: 'center', marginTop: 20 },
  etaLabel: { fontSize: 14, color: '#6b7280' },
  etaTime: { fontSize: 42, fontWeight: 'bold', color: '#111827' },
  ambulanceInfo: {
    marginTop: 16, padding: 12, backgroundColor: '#f3f4f6', borderRadius: 12
  },
  ambulanceLabel: { fontSize: 14, color: '#374151', textAlign: 'center' },
  callButton: {
    backgroundColor: '#22c55e', paddingVertical: 12, borderRadius: 8, marginTop: 12
  },
  callButtonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 16 },
  doneButton: {
    backgroundColor: '#3b82f6', paddingVertical: 14, borderRadius: 8, marginTop: 16
  },
  doneButtonText: { color: '#fff', fontWeight: 'bold', textAlign: 'center', fontSize: 16 }
});
