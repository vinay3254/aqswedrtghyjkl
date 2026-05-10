import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import AssignmentScreen from './src/screens/AssignmentScreen';
import NavigationScreen from './src/screens/NavigationScreen';
import VitalsScreen from './src/screens/VitalsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = await AsyncStorage.getItem('authToken');
    setIsLoggedIn(!!token);
    setLoading(false);
  };

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#dc2626' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        {!isLoggedIn ? (
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen 
              name="Home" 
              component={HomeScreen}
              options={{ title: '🚑 Driver Dashboard' }}
            />
            <Stack.Screen 
              name="Assignment" 
              component={AssignmentScreen}
              options={{ title: 'Assignment Details' }}
            />
            <Stack.Screen 
              name="Navigation" 
              component={NavigationScreen}
              options={{ title: 'Navigation' }}
            />
            <Stack.Screen 
              name="Vitals" 
              component={VitalsScreen}
              options={{ title: 'Patient Vitals' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
