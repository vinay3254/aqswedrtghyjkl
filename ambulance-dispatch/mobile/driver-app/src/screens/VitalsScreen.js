import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView
} from 'react-native';
import api from '../services/api';

export default function VitalsScreen({ route, navigation }) {
  const { assignment } = route.params;
  const [vitals, setVitals] = useState({
    bloodPressureSystolic: '',
    bloodPressureDiastolic: '',
    heartRate: '',
    oxygenSaturation: '',
    temperature: '',
    respiratoryRate: '',
    consciousnessLevel: 'ALERT',
    notes: ''
  });

  const consciousnessLevels = [
    { value: 'ALERT', label: 'Alert' },
    { value: 'VERBAL', label: 'Responds to Verbal' },
    { value: 'PAIN', label: 'Responds to Pain' },
    { value: 'UNRESPONSIVE', label: 'Unresponsive' }
  ];

  const handleSubmit = async () => {
    try {
      await api.post(`/incidents/${assignment.incident_id}/vitals`, {
        blood_pressure: `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`,
        heart_rate: parseInt(vitals.heartRate) || null,
        oxygen_saturation: parseInt(vitals.oxygenSaturation) || null,
        temperature: parseFloat(vitals.temperature) || null,
        respiratory_rate: parseInt(vitals.respiratoryRate) || null,
        consciousness_level: vitals.consciousnessLevel,
        notes: vitals.notes
      });
      Alert.alert('Success', 'Vitals transmitted to hospital', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit vitals');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>📋 Patient Vitals</Text>
      <Text style={styles.subtitle}>Enter patient vitals to transmit to hospital</Text>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>BP Systolic</Text>
          <TextInput
            style={styles.input}
            placeholder="120"
            keyboardType="numeric"
            value={vitals.bloodPressureSystolic}
            onChangeText={(v) => setVitals({...vitals, bloodPressureSystolic: v})}
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.label}>BP Diastolic</Text>
          <TextInput
            style={styles.input}
            placeholder="80"
            keyboardType="numeric"
            value={vitals.bloodPressureDiastolic}
            onChangeText={(v) => setVitals({...vitals, bloodPressureDiastolic: v})}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Heart Rate (bpm)</Text>
          <TextInput
            style={styles.input}
            placeholder="72"
            keyboardType="numeric"
            value={vitals.heartRate}
            onChangeText={(v) => setVitals({...vitals, heartRate: v})}
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.label}>O₂ Saturation (%)</Text>
          <TextInput
            style={styles.input}
            placeholder="98"
            keyboardType="numeric"
            value={vitals.oxygenSaturation}
            onChangeText={(v) => setVitals({...vitals, oxygenSaturation: v})}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Temperature (°C)</Text>
          <TextInput
            style={styles.input}
            placeholder="37.0"
            keyboardType="decimal-pad"
            value={vitals.temperature}
            onChangeText={(v) => setVitals({...vitals, temperature: v})}
          />
        </View>
        <View style={styles.halfInput}>
          <Text style={styles.label}>Resp. Rate</Text>
          <TextInput
            style={styles.input}
            placeholder="16"
            keyboardType="numeric"
            value={vitals.respiratoryRate}
            onChangeText={(v) => setVitals({...vitals, respiratoryRate: v})}
          />
        </View>
      </View>

      <Text style={styles.label}>Consciousness (AVPU)</Text>
      <View style={styles.avpuRow}>
        {consciousnessLevels.map(level => (
          <TouchableOpacity
            key={level.value}
            style={[
              styles.avpuButton,
              vitals.consciousnessLevel === level.value && styles.avpuButtonActive
            ]}
            onPress={() => setVitals({...vitals, consciousnessLevel: level.value})}
          >
            <Text style={[
              styles.avpuText,
              vitals.consciousnessLevel === level.value && styles.avpuTextActive
            ]}>{level.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Additional observations..."
        multiline
        numberOfLines={4}
        value={vitals.notes}
        onChangeText={(v) => setVitals({...vitals, notes: v})}
      />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>📤 Transmit to Hospital</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  row: { flexDirection: 'row', gap: 12 },
  halfInput: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8,
    padding: 12, fontSize: 16
  },
  notesInput: { height: 100, textAlignVertical: 'top' },
  avpuRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  avpuButton: {
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff'
  },
  avpuButtonActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  avpuText: { color: '#374151', fontSize: 12 },
  avpuTextActive: { color: '#fff' },
  submitButton: {
    backgroundColor: '#22c55e', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 24, marginBottom: 40
  },
  submitButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});
