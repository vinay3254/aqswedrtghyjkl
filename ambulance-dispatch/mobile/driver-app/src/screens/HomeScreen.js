import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, RefreshControl
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { connectSocket, socket } from '../services/socket';

const STATUS_COLORS = {
  AVAILABLE: '#22c55e',
  DISPATCHED: '#f59e0b',
  EN_ROUTE: '#3b82f6',
  AT_SCENE: '#8b5cf6',
  TRANSPORTING: '#ec4899',
  AT_HOSPITAL: '#06b6d4',
  OFFLINE: '#6b7280'
};

export default function HomeScreen({ navigation }) {
  const [assignment, setAssignment] = useState(null);
  const [status, setStatus] = useState('AVAILABLE');
  const [refreshing, setRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    initializeApp();
    return () => socket?.disconnect();
  }, []);

  const initializeApp = async () => {
    const userData = await AsyncStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));

    await requestLocationPermission();
    await fetchCurrentAssignment();
    connectSocket();

    socket.on('assignment:new', handleNewAssignment);
    socket.on('assignment:cancelled', handleAssignmentCancelled);

    startLocationTracking();
  };

  const requestLocationPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location access is required');
    }
  };

  const startLocationTracking = async () => {
    await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 50, timeInterval: 10000 },
      async (location) => {
        try {
          await api.put('/ambulances/me/location', {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            speed: location.coords.speed,
            heading: location.coords.heading
          });
        } catch (error) {
          console.error('Location update failed:', error);
        }
      }
    );
  };

  const fetchCurrentAssignment = async () => {
    try {
      const response = await api.get('/assignments/driver/current');
      if (response.data.assignment) {
        setAssignment(response.data.assignment);
        setStatus(response.data.assignment.incident?.status || 'DISPATCHED');
      }
    } catch (error) {
      console.log('No current assignment');
    }
  };

  const handleNewAssignment = (data) => {
    setAssignment(data);
    setStatus('DISPATCHED');
    setCountdown(60);
    Alert.alert('🚨 New Assignment!', `Severity: ${data.incident.severity}\nType: ${data.incident.incident_type}`);
  };

  const handleAssignmentCancelled = () => {
    setAssignment(null);
    setStatus('AVAILABLE');
    Alert.alert('Assignment Cancelled', 'The assignment has been cancelled');
  };

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const acceptAssignment = async () => {
    try {
      await api.post(`/assignments/${assignment.id}/accept`);
      setStatus('EN_ROUTE');
      setCountdown(null);
      Alert.alert('Accepted!', 'Navigate to the incident location');
    } catch (error) {
      Alert.alert('Error', 'Failed to accept assignment');
    }
  };

  const rejectAssignment = async () => {
    try {
      await api.post(`/assignments/${assignment.id}/reject`, { reason: 'Driver rejected' });
      setAssignment(null);
      setStatus('AVAILABLE');
      setCountdown(null);
    } catch (error) {
      Alert.alert('Error', 'Failed to reject assignment');
    }
  };

  const updateIncidentStatus = async (newStatus) => {
    try {
      await api.put(`/incidents/${assignment.incident_id}/status`, { status: newStatus });
      setStatus(newStatus);
      if (newStatus === 'RESOLVED') {
        setAssignment(null);
        setStatus('AVAILABLE');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCurrentAssignment();
    setRefreshing(false);
  }, []);

  const renderStatusButtons = () => {
    const buttons = [
      { status: 'ON_SCENE', label: '📍 Arrived at Scene', from: ['EN_ROUTE'] },
      { status: 'TRANSPORTING', label: '🏥 Patient Loaded', from: ['ON_SCENE'] },
      { status: 'AT_HOSPITAL', label: '🏨 At Hospital', from: ['TRANSPORTING'] },
      { status: 'RESOLVED', label: '✅ Mission Complete', from: ['AT_HOSPITAL'] }
    ];

    return buttons.filter(b => b.from.includes(status)).map(b => (
      <TouchableOpacity
        key={b.status}
        style={[styles.actionButton, { backgroundColor: STATUS_COLORS[b.status] || '#3b82f6' }]}
        onPress={() => updateIncidentStatus(b.status)}
      >
        <Text style={styles.actionButtonText}>{b.label}</Text>
      </TouchableOpacity>
    ));
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] }]}>
        <Text style={styles.statusText}>{status.replace('_', ' ')}</Text>
      </View>

      {!assignment ? (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingEmoji}>🚑</Text>
          <Text style={styles.waitingText}>Waiting for assignment...</Text>
          <Text style={styles.waitingSubtext}>You'll be notified when a new emergency is assigned</Text>
        </View>
      ) : (
        <>
          {countdown !== null && (
            <View style={styles.countdownCard}>
              <Text style={styles.countdownLabel}>⏱️ Accept within</Text>
              <Text style={styles.countdownTimer}>{countdown}s</Text>
              <View style={styles.acceptRejectRow}>
                <TouchableOpacity style={styles.acceptButton} onPress={acceptAssignment}>
                  <Text style={styles.buttonText}>✅ ACCEPT</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectButton} onPress={rejectAssignment}>
                  <Text style={styles.buttonText}>❌ REJECT</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.assignmentCard}>
            <Text style={styles.cardTitle}>🚨 Current Assignment</Text>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Severity:</Text>
              <Text style={[styles.value, { color: assignment.incident?.severity === 'CRITICAL' ? '#dc2626' : '#f59e0b' }]}>
                {assignment.incident?.severity}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Type:</Text>
              <Text style={styles.value}>{assignment.incident?.incident_type}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Location:</Text>
              <Text style={styles.value} numberOfLines={2}>{assignment.incident?.location_address}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Hospital:</Text>
              <Text style={styles.value}>{assignment.hospital?.name || 'TBD'}</Text>
            </View>
          </View>

          <View style={styles.actionsCard}>
            {renderStatusButtons()}
            
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => navigation.navigate('Navigation', { assignment })}
            >
              <Text style={styles.navButtonText}>🗺️ Open Navigation</Text>
            </TouchableOpacity>

            {status === 'TRANSPORTING' && (
              <TouchableOpacity
                style={styles.vitalsButton}
                onPress={() => navigation.navigate('Vitals', { assignment })}
              >
                <Text style={styles.vitalsButtonText}>💊 Enter Patient Vitals</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  statusBadge: { alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, marginBottom: 16 },
  statusText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  waitingCard: { backgroundColor: '#fff', borderRadius: 12, padding: 40, alignItems: 'center', elevation: 2 },
  waitingEmoji: { fontSize: 64 },
  waitingText: { fontSize: 20, fontWeight: 'bold', color: '#374151', marginTop: 16 },
  waitingSubtext: { fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center' },
  countdownCard: { backgroundColor: '#fef2f2', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#dc2626' },
  countdownLabel: { fontSize: 16, color: '#dc2626' },
  countdownTimer: { fontSize: 48, fontWeight: 'bold', color: '#dc2626' },
  acceptRejectRow: { flexDirection: 'row', marginTop: 16, gap: 12 },
  acceptButton: { backgroundColor: '#22c55e', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  rejectButton: { backgroundColor: '#dc2626', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  assignmentCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#374151', marginBottom: 12 },
  infoRow: { flexDirection: 'row', marginBottom: 8 },
  label: { fontWeight: 'bold', color: '#6b7280', width: 80 },
  value: { flex: 1, color: '#111827' },
  actionsCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, elevation: 2, gap: 12 },
  actionButton: { padding: 16, borderRadius: 8, alignItems: 'center' },
  actionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  navButton: { backgroundColor: '#3b82f6', padding: 16, borderRadius: 8, alignItems: 'center' },
  navButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  vitalsButton: { backgroundColor: '#8b5cf6', padding: 16, borderRadius: 8, alignItems: 'center' },
  vitalsButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
