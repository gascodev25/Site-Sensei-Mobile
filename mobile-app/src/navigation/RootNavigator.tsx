import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from './AuthContext';
import LoginScreen from '../screens/LoginScreen';
import ServiceListScreen from '../screens/ServiceListScreen';
import ServiceDetailScreen from '../screens/ServiceDetailScreen';
import FieldCompletionScreen from '../screens/FieldCompletionScreen';
import SuccessScreen from '../screens/SuccessScreen';
import type { MobileService } from '../api/client';

export type RootStackParamList = {
  Login: undefined;
  ServiceList: undefined;
  ServiceDetail: { service: MobileService; occurrenceDate?: string };
  FieldCompletion: { service: MobileService; occurrenceDate: string };
  Success: { serviceId: number; clientName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        {!user ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen
              name="ServiceList"
              component={ServiceListScreen}
              options={{ title: 'My Services', headerBackVisible: false }}
            />
            <Stack.Screen
              name="ServiceDetail"
              component={ServiceDetailScreen}
              options={{ title: 'Service Details' }}
            />
            <Stack.Screen
              name="FieldCompletion"
              component={FieldCompletionScreen}
              options={{ title: 'Complete Service', headerBackTitle: 'Back' }}
            />
            <Stack.Screen
              name="Success"
              component={SuccessScreen}
              options={{ title: 'Submitted', headerBackVisible: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
