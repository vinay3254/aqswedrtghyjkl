import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import api from '../services/api';

export default function HistoryScreen({ navigation }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await api.get('/incidents/my-history');
      setIncidents(response.data.incidents || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('Status', { incident: item })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.type}>{item.incident_type}</Text>
        <Text style={[styles.status, { color: item.status === 'RESOLVED' ? '#22c55e' : '#f59e0b' }]}>
          {item.status}
        </Text>
      </View>
      <Text style={styles.address} numberOfLines={2}>{item.location_address}</Text>
      <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {incidents.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyText}>No emergency history</Text>
        </View>
      ) : (
        <FlatList
          data={incidents}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  type: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
  status: { fontSize: 12, fontWeight: '600' },
  address: { fontSize: 14, color: '#6b7280' },
  date: { fontSize: 12, color: '#9ca3af', marginTop: 8 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, color: '#6b7280', marginTop: 12 }
});
