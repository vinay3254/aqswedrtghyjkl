import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import api from '../services/api';

export default function NavigationScreen({ route }) {
  const { assignment } = route.params;
  const [currentLocation, setCurrentLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [eta, setEta] = useState(null);

  const destination = assignment.incident?.status === 'TRANSPORTING' 
    ? { lat: assignment.hospital?.latitude, lng: assignment.hospital?.longitude, name: assignment.hospital?.name }
    : { lat: assignment.incident?.location_lat, lng: assignment.incident?.location_lng, name: 'Incident Location' };

  useEffect(() => {
    startNavigation();
    const interval = setInterval(updateRoute, 30000);
    return () => clearInterval(interval);
  }, []);

  const startNavigation = async () => {
    const location = await Location.getCurrentPositionAsync({});
    setCurrentLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    });
    await updateRoute();
  };

  const updateRoute = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({});
      const response = await api.post('/routing/calculate', {
        origin: { lat: location.coords.latitude, lng: location.coords.longitude },
        destination: { lat: destination.lat, lng: destination.lng }
      });

      if (response.data.route) {
        const coords = decodePolyline(response.data.route.geometry);
        setRouteCoords(coords);
        setEta(Math.round(response.data.route.duration / 60));
      }
    } catch (error) {
      console.error('Route update failed:', error);
    }
  };

  const decodePolyline = (encoded) => {
    const points = [];
    let index = 0, lat = 0, lng = 0;
    while (index < encoded.length) {
      let b, shift = 0, result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      shift = 0; result = 0;
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
  };

  if (!currentLocation) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>📍 Getting location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05
        }}
        showsUserLocation
        followsUserLocation
      >
        <Marker
          coordinate={{ latitude: destination.lat, longitude: destination.lng }}
          title={destination.name}
          pinColor="#dc2626"
        />
        {routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor="#3b82f6" strokeWidth={4} />
        )}
      </MapView>

      <View style={styles.etaCard}>
        <Text style={styles.etaLabel}>ETA</Text>
        <Text style={styles.etaTime}>{eta || '--'} min</Text>
        <Text style={styles.destName}>{destination.name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height - 120 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 18, color: '#6b7280' },
  etaCard: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    elevation: 4, alignItems: 'center'
  },
  etaLabel: { fontSize: 14, color: '#6b7280' },
  etaTime: { fontSize: 36, fontWeight: 'bold', color: '#111827' },
  destName: { fontSize: 14, color: '#374151', marginTop: 4 }
});
