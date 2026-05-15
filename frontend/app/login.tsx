import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useAppStore } from '../store/appStore';
import { supabase } from '../utils/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAppStore();
  const [loading, setLoading] = useState(false);

  // Controlla se c'è già una sessione attiva
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const user = session.user;
        setUser({
          user_id: user.id,
          email: user.email || '',
          name: user.user_metadata?.full_name || user.email || '',
          picture: user.user_metadata?.avatar_url || null,
        });
        router.replace('/dashboard');
      }
    });
  }, []);

  // Ascolta i cambiamenti di autenticazione
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);
        if (event === 'SIGNED_IN' && session?.user) {
          const user = session.user;
          setUser({
            user_id: user.id,
            email: user.email || '',
            name: user.user_metadata?.full_name || user.email || '',
            picture: user.user_metadata?.avatar_url || null,
          });
          router.replace('/dashboard');
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin },
        });
      } else {
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: 'https://hwljppemlwhdszdrcfdo.supabase.co/auth/v1/callback',
          },
        });
        if (error) throw error;
        if (data?.url) {
          await WebBrowser.openBrowserAsync(data.url);
        }
      }
    } catch (error) {
      console.log('Errore login:', error);
      Alert.alert('Errore', 'Errore durante il login. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>Vyrlo</Text>
          <Text style={styles.tagline}>Noleggio peer-to-peer</Text>
        </View>
        <View style={styles.illustrationContainer}>
          <View style={styles.illustration}>
            <Ionicons name="swap-horizontal" size={80} color="#2563EB" />
          </View>
        </View>
        <View style={styles.benefits}>
          <View style={styles.benefitItem}>
            <Ionicons name="shield-checkmark" size={24} color="#2563EB" />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Protezione Vyrlo</Text>
              <Text style={styles.benefitDesc}>Transazioni sicure e garantite</Text>
            </View>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="cash-outline" size={24} color="#2563EB" />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Guadagna</Text>
              <Text style={styles.benefitDesc}>Monetizza ciò che non usi</Text>
            </View>
          </View>
          <View style={styles.benefitItem}>
            <Ionicons name="chatbubbles-outline" size={24} color="#2563EB" />
            <View style={styles.benefitText}>
              <Text style={styles.benefitTitle}>Chat integrata</Text>
              <Text style={styles.benefitDesc}>Comunica direttamente nell'app</Text>
            </View>
          </View>
        </View>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.googleButton, loading && styles.googleButtonDisabled]}
            onPress={handleGoogleLogin}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color="#ffffff" />
                <Text style={styles.googleButtonText}>Continua con Google</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.terms}>
            Continuando, accetti i nostri{' '}
            <Text style={styles.termsLink}>Termini di Servizio</Text>
            {' '}e la{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingTop: 40, paddingBottom: 24 },
  logoContainer: { alignItems: 'center' },
  logo: { fontSize: 42, fontWeight: '800', color: '#2563EB', letterSpacing: -1 },
  tagline: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  illustrationContainer: { alignItems: 'center', paddingVertical: 32 },
  illustration: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  benefits: { gap: 20 },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  benefitText: { flex: 1 },
  benefitTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  benefitDesc: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  buttonContainer: { gap: 16 },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563EB', paddingVertical: 16, borderRadius: 12, gap: 12 },
  googleButtonDisabled: { opacity: 0.7 },
  googleButtonText: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  terms: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
  termsLink: { color: '#2563EB' },
});