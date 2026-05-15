import { supabase } from '../utils/supabase';
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
    try {
      // Carica gli items
      const items = await api.getItems();
      if (items) setItems(items);

      // Controlla sessione Supabase
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Sincronizza con il backend
        try {
          await api.syncUser(session.access_token);
          const user = await api.getMe(session.access_token);
          setUser(user);
        } catch (error) {
          console.log('Backend sync error:', error);
          // Usa i dati Supabase direttamente
          setUser({
            user_id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.full_name || session.user.email || '',
            picture: session.user.user_metadata?.avatar_url || null,
          });
        }
      }
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
