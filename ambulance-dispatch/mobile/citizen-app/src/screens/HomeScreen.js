import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Alert, Linking
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function HomeScreen({ navigation }) {
  const [hasActiveEmergency, setHasActiveEmergency] = useState(false);
  const [activeIncident, setActiveIncident] = useState(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkActiveEmergency();
    startPulseAnimation();
  }, []);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();
  };

  const checkActiveEmergency = async () => {
    const incident = await AsyncStorage.getItem('activeIncident');
    if (incident) {
      const parsed = JSON.parse(incident);
      if (!['RESOLVED', 'CANCELLED'].includes(parsed.status)) {
        setActiveIncident(parsed);
        setHasActiveEmergency(true);
      }
    }
  };

  const handleEmergencyPress = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location Required', 'Please enable location to request an ambulance', [
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
        { text: 'Cancel' }
      ]);
      return;
    }

    navigation.navigate('EmergencyType');
  };

  const goToTracking = () => {
    navigation.navigate('Tracking', { incident: activeIncident });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Emergency Help</Text>
        <Text style={styles.subtitle}>Request an ambulance with one tap</Text>
      </View>

      <View style={styles.buttonContainer}>
        {hasActiveEmergency ? (
          <TouchableOpacity style={styles.trackingButton} onPress={goToTracking}>
            <Text style={styles.trackingEmoji}>🚑</Text>
            <Text style={styles.trackingText}>Ambulance En Route</Text>
            <Text style={styles.trackingSubtext}>Tap to track</Text>
          </TouchableOpacity>
        ) : (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity style={styles.emergencyButton} onPress={handleEmergencyPress}>
              <Text style={styles.emergencyEmoji}>🆘</Text>
              <Text style={styles.emergencyText}>EMERGENCY</Text>
              <Text style={styles.emergencySubtext}>Tap for ambulance</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton} onPress={() => Linking.openURL('tel:108')}>
          <Text style={styles.footerIcon}>📞</Text>
          <Text style={styles.footerLabel}>Call 108</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={() => navigation.navigate('History')}>
          <Text style={styles.footerIcon}>📋</Text>
          <Text style={styles.footerLabel}>History</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  header: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 16, color: '#6b7280', marginTop: 8 },
  buttonContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emergencyButton: {
    width: 200, height: 200, borderRadius: 100, backgroundColor: '#dc2626',
    justifyContent: 'center', alignItems: 'center', elevation: 8,
    shadowColor: '#dc2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8
  },
  emergencyEmoji: { fontSize: 48 },
  emergencyText: { fontSize: 22, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  emergencySubtext: { fontSize: 12, color: '#fecaca', marginTop: 4 },
  trackingButton: {
    width: 200, height: 200, borderRadius: 100, backgroundColor: '#22c55e',
    justifyContent: 'center', alignItems: 'center', elevation: 8
  },
  trackingEmoji: { fontSize: 48 },
  trackingText: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginTop: 8 },
  trackingSubtext: { fontSize: 12, color: '#bbf7d0', marginTop: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-around', padding: 20, backgroundColor: '#fff' },
  footerButton: { alignItems: 'center', padding: 12 },
  footerIcon: { fontSize: 24 },
  footerLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 }
});
