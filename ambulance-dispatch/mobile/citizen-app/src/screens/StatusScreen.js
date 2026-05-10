import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function StatusScreen({ route }) {
  const { incident } = route.params;

  const timeline = [
    { status: 'PENDING', time: incident.created_at, label: 'Emergency Reported' },
    { status: 'ACKNOWLEDGED', time: incident.acknowledged_at, label: 'Dispatcher Acknowledged' },
    { status: 'DISPATCHED', time: incident.dispatched_at, label: 'Ambulance Dispatched' },
    { status: 'EN_ROUTE', time: incident.en_route_at, label: 'Ambulance En Route' },
    { status: 'ON_SCENE', time: incident.on_scene_at, label: 'Ambulance Arrived' },
    { status: 'TRANSPORTING', time: incident.transporting_at, label: 'Patient Being Transported' },
    { status: 'AT_HOSPITAL', time: incident.at_hospital_at, label: 'Arrived at Hospital' },
    { status: 'RESOLVED', time: incident.resolved_at, label: 'Incident Resolved' }
  ].filter(t => t.time);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Incident #{incident.incident_number || incident.id?.slice(0, 8)}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Type:</Text>
          <Text style={styles.value}>{incident.incident_type}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Severity:</Text>
          <Text style={[styles.value, { color: incident.severity === 'CRITICAL' ? '#dc2626' : '#f59e0b' }]}>
            {incident.severity}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Location:</Text>
          <Text style={styles.value}>{incident.location_address}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Status:</Text>
          <Text style={[styles.value, { fontWeight: 'bold', color: incident.status === 'RESOLVED' ? '#22c55e' : '#3b82f6' }]}>
            {incident.status}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Timeline</Text>
        {timeline.map((item, index) => (
          <View key={item.status} style={styles.timelineItem}>
            <View style={styles.timelineDot} />
            {index < timeline.length - 1 && <View style={styles.timelineLine} />}
            <View style={styles.timelineContent}>
              <Text style={styles.timelineLabel}>{item.label}</Text>
              <Text style={styles.timelineTime}>{new Date(item.time).toLocaleString()}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  infoRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  label: { width: 80, fontWeight: '600', color: '#6b7280' },
  value: { flex: 1, color: '#111827' },
  timelineItem: { flexDirection: 'row', marginBottom: 16, position: 'relative' },
  timelineDot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: '#22c55e', marginRight: 12, marginTop: 4
  },
  timelineLine: {
    position: 'absolute', left: 5, top: 16, width: 2, height: 32, backgroundColor: '#d1d5db'
  },
  timelineContent: { flex: 1 },
  timelineLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  timelineTime: { fontSize: 12, color: '#6b7280', marginTop: 2 }
});
