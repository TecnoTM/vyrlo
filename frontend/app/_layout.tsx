import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { api } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  const { setUser, setIsLoading, setItems } = useAppStore();

  useEffect(() => {
    const initApp = async () => {
      // Retry logic for API calls
      const retryFetch = async <T,>(fn: () => Promise<T>, retries = 3, delay = 1500): Promise<T | null> => {
        for (let i = 0; i < retries; i++) {
          try {
            return await fn();
          } catch (error) {
            console.log(`Retry ${i + 1}/${retries} failed:`, error);
            if (i === retries - 1) return null;
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
          }
        }
        return null;
      };

      try {
        // Try to get stored session token
        const sessionToken = await AsyncStorage.getItem('session_token');
        
        if (sessionToken) {
          try {
            const user = await api.getMe(sessionToken);
            setUser(user);
          } catch (error) {
            // Session invalid, clear it
            await AsyncStorage.removeItem('session_token');
          }
        }
        
        // Seed data with retry
        await retryFetch(() => api.seedData(), 2, 1000);
        
        // Load items with retry
        const items = await retryFetch(() => api.getItems(), 3, 1500);
        if (items) {
          setItems(items);
        }
      } catch (error) {
        console.error('Init error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    // Delay initial load slightly to allow tunnel to stabilize
    const timer = setTimeout(initApp, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#ffffff',
          },
          headerTintColor: '#2563EB',
          headerTitleStyle: {
            fontWeight: '600',
          },
          headerShadowVisible: false,
          contentStyle: {
            backgroundColor: '#ffffff',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="item/[id]"
          options={{
            title: 'Dettaglio',
            headerBackTitle: 'Indietro',
          }}
        />
        <Stack.Screen
          name="add"
          options={{
            title: 'Nuovo Annuncio',
            headerBackTitle: 'Indietro',
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            title: 'Accedi',
            headerBackTitle: 'Indietro',
          }}
        />
        <Stack.Screen
          name="auth-callback"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            headerBackTitle: 'Indietro',
          }}
        />
        <Stack.Screen
          name="chat/index"
          options={{
            title: 'Messaggi',
            headerBackTitle: 'Indietro',
          }}
        />
        <Stack.Screen
          name="chat/[id]"
          options={{
            title: 'Chat',
            headerBackTitle: 'Indietro',
          }}
        />
        <Stack.Screen
          name="profile/[id]"
          options={{
            title: 'Profilo',
            headerBackTitle: 'Indietro',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Impostazioni',
            headerBackTitle: 'Indietro',
          }}
        />
        <Stack.Screen
          name="payment-success"
          options={{
            title: 'Pagamento',
            headerShown: false,
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
