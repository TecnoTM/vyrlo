import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Item } from '../../store/appStore';
import { api } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';

const { width } = Dimensions.get('window');

export default function ItemDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAppStore();
  
  const [item, setItem] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('1');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const loadItem = async () => {
      try {
        const data = await api.getItem(id || '');
        setItem(data);
      } catch (error) {
        console.error('Error loading item:', error);
      } finally {
        setLoading(false);
      }
    };
    loadItem();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.notFound}>
        <Ionicons name="alert-circle-outline" size={64} color="#D1D5DB" />
        <Text style={styles.notFoundText}>Oggetto non trovato</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Torna indietro</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const numDays = parseInt(days) || 1;
  
  // Vinted-style pricing calculation
  const subtotal = item.price * numDays;
  const protectionFee = Math.round(subtotal * 0.15 * 100) / 100; // 15% commission
  const deposit = item.custom_deposit ?? Math.round(subtotal * 0.20 * 100) / 100; // Custom or 20%
  const total = Math.round((subtotal + protectionFee + deposit) * 100) / 100;

  const incrementDays = () => {
    setDays(String(numDays + 1));
  };

  const decrementDays = () => {
    if (numDays > 1) {
      setDays(String(numDays - 1));
    }
  };

  const handlePayment = async () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Accesso richiesto',
        'Devi effettuare accesso per prenotare',
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Accedi', onPress: () => router.push('/login') },
        ]
      );
      return;
    }

    if (!item) return;
    
    setProcessing(true);
    
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      
      // Get the origin URL for redirect
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://gear-share-app-1.preview.emergentagent.com';
      
      // Create Stripe Checkout session
      const checkoutResult = await api.createCheckout(
        {
          item_id: item.item_id,
          days: numDays,
          origin_url: baseUrl,
        },
        sessionToken || undefined
      );
      
      console.log('Checkout session created:', checkoutResult);
      
      if (!checkoutResult.checkout_url) {
        throw new Error('URL di pagamento non disponibile');
      }
      
      // Open Stripe Checkout in browser
      if (Platform.OS === 'web') {
        // On web, redirect to Stripe Checkout
        window.location.href = checkoutResult.checkout_url;
      } else {
        // On native, open in WebBrowser and return to app
        const result = await WebBrowser.openAuthSessionAsync(
          checkoutResult.checkout_url,
          `${baseUrl}/payment-success`
        );
        
        console.log('WebBrowser result:', result);
        
        if (result.type === 'success' && result.url) {
          // Parse URL to get session_id and booking_id
          const url = new URL(result.url);
          const session_id = url.searchParams.get('session_id');
          const booking_id = url.searchParams.get('booking_id');
          
          if (session_id) {
            router.push(`/payment-success?session_id=${session_id}&booking_id=${booking_id}`);
          }
        }
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      Alert.alert('Errore', error.message || 'Errore durante la creazione del pagamento');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Main Image */}
        <Image source={{ uri: item.image }} style={styles.mainImage} />

        {/* Content */}
        <View style={styles.content}>
          {/* Category & Condition Badges */}
          <View style={styles.badges}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{item.category}</Text>
            </View>
            <View style={styles.conditionBadge}>
              <Text style={styles.conditionBadgeText}>{item.condition}</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title}>{item.title}</Text>

          {/* Owner Card - Clickable */}
          {item.owner_id && (
            <TouchableOpacity 
              style={styles.ownerCard}
              onPress={() => router.push(`/profile/${item.owner_id}`)}
            >
              <View style={styles.ownerLeft}>
                {item.owner_picture ? (
                  <Image source={{ uri: item.owner_picture }} style={styles.ownerAvatar} />
                ) : (
                  <View style={styles.ownerAvatarPlaceholder}>
                    <Ionicons name="person" size={24} color="#9CA3AF" />
                  </View>
                )}
                <View style={styles.ownerInfo}>
                  <Text style={styles.ownerName}>{item.owner_name || 'Proprietario'}</Text>
                  <Text style={styles.ownerHint}>Tocca per vedere il profilo</Text>
                </View>
              </View>
              <TouchableOpacity 
                style={styles.chatButton}
                onPress={(e) => {
                  e.stopPropagation();
                  if (!isAuthenticated) {
                    Alert.alert(
                      'Accesso richiesto',
                      'Devi effettuare accesso per chattare',
                      [
                        { text: 'Annulla', style: 'cancel' },
                        { text: 'Accedi', onPress: () => router.push('/login') },
                      ]
                    );
                    return;
                  }
                  // Start chat with item context
                  const startChat = async () => {
                    try {
                      const sessionToken = await AsyncStorage.getItem('session_token');
                      const result = await api.startConversation(
                        { receiver_id: item.owner_id, item_id: item.item_id },
                        sessionToken || undefined
                      );
                      router.push(`/chat/${result.conversation_id}`);
                    } catch (error) {
                      console.error('Error starting chat:', error);
                    }
                  };
                  startChat();
                }}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#2563EB" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}

          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.price}>€{item.price}</Text>
            <Text style={styles.priceUnit}> / giorno</Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descrizione</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>

          {/* Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cosa include</Text>
            <View style={styles.features}>
              <View style={styles.featureItem}>
                <Ionicons name="shield-checkmark" size={20} color="#2563EB" />
                <Text style={styles.featureText}>Protezione Vyrlo inclusa</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="cash-outline" size={20} color="#2563EB" />
                <Text style={styles.featureText}>Deposito rimborsabile</Text>
              </View>
              <View style={styles.featureItem}>
                <Ionicons name="chatbubble-outline" size={20} color="#2563EB" />
                <Text style={styles.featureText}>Chat con il proprietario</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Booking Card - Sticky Bottom */}
      <View style={styles.bookingCard}>
        {/* Days Selector */}
        <View style={styles.bookingTop}>
          <View style={styles.daysSelector}>
            <Text style={styles.daysLabel}>Giorni di noleggio</Text>
            <View style={styles.daysControls}>
              <TouchableOpacity
                style={styles.daysButton}
                onPress={decrementDays}
              >
                <Ionicons name="remove" size={20} color="#2563EB" />
              </TouchableOpacity>
              <TextInput
                style={styles.daysInput}
                value={days}
                onChangeText={(text) => setDays(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                textAlign="center"
              />
              <TouchableOpacity
                style={styles.daysButton}
                onPress={incrementDays}
              >
                <Ionicons name="add" size={20} color="#2563EB" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Price Breakdown */}
        <View style={styles.priceBreakdown}>
          <View style={styles.priceRow2}>
            <Text style={styles.priceLabel}>Subtotale ({numDays} {numDays === 1 ? 'giorno' : 'giorni'})</Text>
            <Text style={styles.priceValue}>€{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.priceRow2}>
            <View style={styles.protectionRow}>
              <Text style={styles.priceLabel}>Protezione Vyrlo</Text>
              <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
            </View>
            <Text style={styles.priceValue}>€{protectionFee.toFixed(2)}</Text>
          </View>
          <View style={styles.priceRow2}>
            <Text style={styles.priceLabelDeposit}>Deposito (rimborsabile)</Text>
            <Text style={styles.priceValueDeposit}>€{deposit.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceRow2}>
            <Text style={styles.totalLabel}>Totale</Text>
            <Text style={styles.totalValue}>€{total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={styles.payButton}
          onPress={handlePayment}
          activeOpacity={0.8}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.payButtonText}>Paga Ora</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 320,
  },
  mainImage: {
    width: width,
    height: width * 0.75,
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  conditionBadge: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  conditionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
    lineHeight: 32,
  },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  ownerText: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 12,
  },
  price: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563EB',
  },
  priceUnit: {
    fontSize: 16,
    color: '#6B7280',
  },
  // Owner Card Styles
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  ownerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  ownerAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  ownerHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  chatButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#4B5563',
    lineHeight: 24,
  },
  features: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureText: {
    fontSize: 15,
    color: '#4B5563',
  },
  bookingCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  bookingTop: {
    marginBottom: 12,
  },
  daysSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  daysLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  daysControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  daysButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysInput: {
    width: 50,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    ...Platform.select({
      web: { outlineStyle: 'none' },
    }),
  },
  priceBreakdown: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  priceRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  protectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  priceLabelDeposit: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  priceValueDeposit: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  payButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  notFoundText: {
    fontSize: 18,
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  modalTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563EB',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Success Modal
  successIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 16,
    color: '#10B981',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 8,
  },
  successDetails: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
