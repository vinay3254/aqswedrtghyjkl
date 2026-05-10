import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import HomeScreen from './src/screens/HomeScreen';
import EmergencyTypeScreen from './src/screens/EmergencyTypeScreen';
import TrackingScreen from './src/screens/TrackingScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import StatusScreen from './src/screens/StatusScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#dc2626' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen}
          options={{ title: '🚑 Emergency' }}
        />
        <Stack.Screen 
          name="EmergencyType" 
          component={EmergencyTypeScreen}
          options={{ title: 'Emergency Type' }}
        />
        <Stack.Screen 
          name="Tracking" 
          component={TrackingScreen}
          options={{ title: 'Ambulance Tracking' }}
        />
        <Stack.Screen 
          name="Status" 
          component={StatusScreen}
          options={{ title: 'Incident Status' }}
        />
        <Stack.Screen 
          name="History" 
          component={HistoryScreen}
          options={{ title: 'History' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
