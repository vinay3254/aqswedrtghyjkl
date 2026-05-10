import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function AssignmentScreen({ route }) {
  const { assignment } = route.params;
  const incident = assignment.incident || {};
  const hospital = assignment.hospital || {};

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🚨 Incident Details</Text>
        <DetailRow label="ID" value={incident.incident_number || incident.id?.slice(0, 8)} />
        <DetailRow label="Severity" value={incident.severity} highlight />
        <DetailRow label="Type" value={incident.incident_type} />
        <DetailRow label="Patients" value={incident.patient_count} />
        <DetailRow label="Description" value={incident.description} />
        <DetailRow label="Address" value={incident.location_address} />
        <DetailRow label="Caller" value={incident.caller_name} />
        <DetailRow label="Phone" value={incident.caller_phone} />
      </View>

      {hospital.name && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏥 Destination Hospital</Text>
          <DetailRow label="Name" value={hospital.name} />
          <DetailRow label="Address" value={hospital.address} />
          <DetailRow label="Phone" value={hospital.phone} />
          <DetailRow label="Available Beds" value={hospital.available_beds} />
          <DetailRow label="ICU Beds" value={hospital.available_icu_beds} />
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 Assignment Info</Text>
        <DetailRow label="Assigned At" value={new Date(assignment.assigned_at).toLocaleString()} />
        <DetailRow label="ETA" value={assignment.estimated_arrival_time ? `${assignment.estimated_arrival_time} min` : 'Calculating...'} />
        <DetailRow label="Auto-Selected" value={assignment.auto_selected ? 'Yes' : 'No'} />
        {assignment.ambulance_reasoning && (
          <DetailRow label="Selection Reason" value={assignment.ambulance_reasoning} />
        )}
      </View>
    </ScrollView>
  );
}

const DetailRow = ({ label, value, highlight }) => (
  <View style={styles.detailRow}>
    <Text style={styles.label}>{label}</Text>
    <Text style={[styles.value, highlight && styles.highlight]}>{value || 'N/A'}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  detailRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  label: { width: 120, fontWeight: '600', color: '#6b7280' },
  value: { flex: 1, color: '#111827' },
  highlight: { color: '#dc2626', fontWeight: 'bold' }
});
