import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const EMERGENCY_TYPES = [
  { id: 'MEDICAL', emoji: '🏥', label: 'Medical Emergency' },
  { id: 'ACCIDENT', emoji: '🚗', label: 'Accident' },
  { id: 'CARDIAC', emoji: '❤️', label: 'Cardiac / Heart Attack' },
  { id: 'STROKE', emoji: '🧠', label: 'Stroke' },
  { id: 'TRAUMA', emoji: '🩹', label: 'Trauma / Injury' },
  { id: 'MATERNITY', emoji: '🤰', label: 'Maternity' },
  { id: 'OTHER', emoji: '🆘', label: 'Other Emergency' }
];

export default function EmergencyTypeScreen({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [location, setLocation] = useState(null);
  const [address, setAddress] = useState('Getting location...');
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    getLocation();
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      submitEmergency('MEDICAL');
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const getLocation = async () => {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setLocation(loc.coords);

    const [reverseGeo] = await Location.reverseGeocodeAsync({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude
    });

    if (reverseGeo) {
      const addr = [reverseGeo.street, reverseGeo.city, reverseGeo.region].filter(Boolean).join(', ');
      setAddress(addr || 'Location captured');
    }

    setCountdown(10);
  };

  const selectType = (type) => {
    setSelectedType(type);
    setCountdown(null);
    submitEmergency(type);
  };

  const submitEmergency = async (type) => {
    if (!location) {
      Alert.alert('Error', 'Location not available');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/incidents', {
        location_lat: location.latitude,
        location_lng: location.longitude,
        location_address: address,
        incident_type: type,
        severity: type === 'CARDIAC' || type === 'STROKE' ? 'CRITICAL' : 'HIGH',
        description: `Emergency reported via mobile app: ${type}`,
        caller_phone: 'App User'
      });

      const incident = response.data.incident || response.data;
      await AsyncStorage.setItem('activeIncident', JSON.stringify(incident));

      navigation.replace('Tracking', { incident });
    } catch (error) {
      Alert.alert('Error', 'Failed to request ambulance. Please call 108.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>🚑 Requesting ambulance...</Text>
        <Text style={styles.loadingSubtext}>Help is on the way</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.locationCard}>
        <Text style={styles.locationLabel}>📍 Your Location</Text>
        <Text style={styles.locationText}>{address}</Text>
      </View>

      {countdown !== null && (
        <View style={styles.countdownCard}>
          <Text style={styles.countdownLabel}>Auto-requesting in</Text>
          <Text style={styles.countdownNumber}>{countdown}</Text>
          <Text style={styles.countdownSubtext}>Select type below or wait</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Select Emergency Type</Text>

      <View style={styles.typesGrid}>
        {EMERGENCY_TYPES.map(type => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.typeButton,
              selectedType === type.id && styles.typeButtonSelected
            ]}
            onPress={() => selectType(type.id)}
          >
            <Text style={styles.typeEmoji}>{type.emoji}</Text>
            <Text style={styles.typeLabel}>{type.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' },
  loadingText: { fontSize: 20, fontWeight: 'bold', color: '#dc2626', marginTop: 20 },
  loadingSubtext: { fontSize: 14, color: '#6b7280', marginTop: 8 },
  locationCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2
  },
  locationLabel: { fontSize: 14, color: '#6b7280' },
  locationText: { fontSize: 16, fontWeight: '600', color: '#111827', marginTop: 4 },
  countdownCard: {
    backgroundColor: '#fef2f2', borderRadius: 12, padding: 20, marginBottom: 16,
    alignItems: 'center', borderWidth: 2, borderColor: '#dc2626'
  },
  countdownLabel: { fontSize: 14, color: '#dc2626' },
  countdownNumber: { fontSize: 48, fontWeight: 'bold', color: '#dc2626' },
  countdownSubtext: { fontSize: 12, color: '#991b1b' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  typesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  typeButton: {
    width: '47%', backgroundColor: '#fff', borderRadius: 12, padding: 16,
    alignItems: 'center', elevation: 2, borderWidth: 2, borderColor: 'transparent'
  },
  typeButtonSelected: { borderColor: '#dc2626', backgroundColor: '#fef2f2' },
  typeEmoji: { fontSize: 32 },
  typeLabel: { fontSize: 12, color: '#374151', marginTop: 8, textAlign: 'center' }
});
