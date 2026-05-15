import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import { useAppStore } from '../store/appStore';
import { api } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

export default function AuthCallbackPage() {
  const router = useRouter();
  const localParams = useLocalSearchParams();
  const globalParams = useGlobalSearchParams();
  const { setUser, setIsLoading } = useAppStore();
  const hasProcessed = useRef(false);
  const [status, setStatus] = useState('Accesso in corso...');

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      // Wait for layout to mount before navigating
      await new Promise(resolve => setTimeout(resolve, 300));
      
      try {
        let sessionId: string | null = null;

        // Try multiple methods to get session_id
        
        // Method 1: Check local params (expo-router)
        if (localParams.session_id) {
          sessionId = localParams.session_id as string;
          console.log('Found session_id in localParams:', sessionId);
        }
        
        // Method 2: Check global params
        if (!sessionId && globalParams.session_id) {
          sessionId = globalParams.session_id as string;
          console.log('Found session_id in globalParams:', sessionId);
        }

        // Method 3: For web, check URL hash fragment
        if (!sessionId && Platform.OS === 'web') {
          const hash = window.location.hash;
          const search = window.location.search;
          const href = window.location.href;
          
          console.log('Web URL:', href);
          console.log('Hash:', hash);
          console.log('Search:', search);
          
          // Check hash fragment
          if (hash && hash.includes('session_id=')) {
            sessionId = hash.split('session_id=')[1]?.split('&')[0] || null;
            console.log('Found session_id in hash:', sessionId);
          }
          
          // Check query string
          if (!sessionId && search && search.includes('session_id=')) {
            const urlParams = new URLSearchParams(search);
            sessionId = urlParams.get('session_id');
            console.log('Found session_id in search:', sessionId);
          }
          
          // Check full URL
          if (!sessionId && href.includes('session_id=')) {
            const match = href.match(/session_id=([^&]+)/);
            if (match) {
              sessionId = match[1];
              console.log('Found session_id in href:', sessionId);
            }
          }
        }

        // Method 4: For native, try to get current URL
        if (!sessionId && Platform.OS !== 'web') {
          try {
            const url = await Linking.getInitialURL();
            console.log('Native initial URL:', url);
            if (url && url.includes('session_id=')) {
              const match = url.match(/session_id=([^&]+)/);
              if (match) {
                sessionId = match[1];
                console.log('Found session_id in native URL:', sessionId);
              }
            }
          } catch (e) {
            console.log('Could not get initial URL:', e);
          }
        }

        if (!sessionId) {
          console.error('No session_id found in any location');
          setStatus('Errore: sessione non trovata');
          setTimeout(() => router.replace('/login'), 1500);
          return;
        }

        setStatus('Validazione sessione...');

        // Exchange session_id for session_token
        const result = await api.exchangeSession(sessionId);
        
        // Store session token
        if (result.session_token) {
          await AsyncStorage.setItem('session_token', result.session_token);
        }

        // Set user in store
        setUser(result.user);
        setIsLoading(false);

        setStatus('Accesso completato!');

        // Navigate to dashboard with delay to ensure layout is mounted
        setTimeout(() => router.replace('/dashboard'), 500);
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('Errore di autenticazione');
        setTimeout(() => router.replace('/login'), 1500);
      }
    };

    // Delay processing to ensure layout is fully mounted
    setTimeout(processAuth, 500);
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
