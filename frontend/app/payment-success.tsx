import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store/appStore';
import { api } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PaymentDetails {
  payment_status: string;
  booking_id: string;
  booking: {
    booking_id: string;
    item_id: string;
    renter_id: string;
    owner_id: string;
    days: number;
    subtotal: number;
    protection_fee: number;
    deposit: number;
    total: number;
    status: string;
  };
  item: {
    item_id: string;
    title: string;
    category: string;
    image: string;
    owner_id: string;
    owner_name?: string;
  };
  amount_total: number;
  subtotal: number;
  platform_fee: number;
  deposit: number;
}

export default function PaymentSuccessPage() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { isAuthenticated } = useAppStore();
  
  const [loading, setLoading] = useState(true);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionId = params.session_id as string;
  const bookingId = params.booking_id as string;

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    
    if (sessionId) {
      checkPaymentStatus();
    } else if (bookingId) {
      loadBookingDetails();
    } else {
      setError('Parametri mancanti');
      setLoading(false);
    }
  }, [sessionId, bookingId, isAuthenticated]);

  const checkPaymentStatus = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const data = await api.getCheckoutStatus(sessionId, sessionToken || undefined);
      setPaymentDetails(data);
    } catch (err: any) {
      setError(err.message || 'Errore nel recupero dei dettagli');
    } finally {
      setLoading(false);
    }
  };

  const loadBookingDetails = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const data = await api.getBookingDetails(bookingId, sessionToken || undefined);
      // Transform to match PaymentDetails structure
      setPaymentDetails({
        payment_status: data.booking.payment_status || data.booking.status,
        booking_id: data.booking.booking_id,
        booking: data.booking,
        item: data.item,
        amount_total: data.booking.total,
        subtotal: data.booking.subtotal,
        platform_fee: data.booking.protection_fee,
        deposit: data.booking.deposit,
      });
    } catch (err: any) {
      setError(err.message || 'Errore nel recupero dei dettagli');
    } finally {
      setLoading(false);
    }
  };

  const handleContactChat = async () => {
    if (!paymentDetails) return;
    
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const result = await api.startConversation(
        { receiver_id: paymentDetails.item.owner_id, item_id: paymentDetails.item.item_id },
        sessionToken || undefined
      );
      router.push(`/chat/${result.conversation_id}`);
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  const handleContactWhatsApp = () => {
    if (!paymentDetails) return;
    
    const message = encodeURIComponent(
      `Ciao! Ho appena prenotato "${paymentDetails.item.title}" su Vyrlo per ${paymentDetails.booking.days} giorni. Quando possiamo organizzare il ritiro?`
    );
    // Demo phone - in production this would come from owner's profile
    const phone = '393331234567';
    const url = `https://wa.me/${phone}?text=${message}`;
    Linking.openURL(url);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Verifica pagamento...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={64} color="#EF4444" />
        <Text style={styles.errorTitle}>Errore</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.errorButton} onPress={() => router.push('/')}>
          <Text style={styles.errorButtonText}>Torna alla Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPaid = paymentDetails?.payment_status === 'paid';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Success Header */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, isPaid ? styles.iconCircleSuccess : styles.iconCirclePending]}>
            <Ionicons 
              name={isPaid ? "checkmark" : "time"} 
              size={48} 
              color="#ffffff" 
            />
          </View>
          <Text style={styles.title}>
            {isPaid ? 'Pagamento Completato!' : 'Pagamento in elaborazione'}
          </Text>
          <Text style={styles.subtitle}>
            {isPaid 
              ? 'La tua Protezione Vyrlo è attiva'
              : 'Stiamo verificando il tuo pagamento'
            }
          </Text>
        </View>

        {/* Item Card */}
        {paymentDetails?.item && (
          <View style={styles.itemCard}>
            <Image source={{ uri: paymentDetails.item.image }} style={styles.itemImage} />
            <View style={styles.itemInfo}>
              <Text style={styles.itemCategory}>{paymentDetails.item.category}</Text>
              <Text style={styles.itemTitle} numberOfLines={2}>{paymentDetails.item.title}</Text>
              <Text style={styles.itemDays}>
                {paymentDetails.booking.days} {paymentDetails.booking.days === 1 ? 'giorno' : 'giorni'} di noleggio
              </Text>
            </View>
          </View>
        )}

        {/* Price Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Riepilogo Pagamento</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotale</Text>
            <Text style={styles.summaryValue}>€{paymentDetails?.subtotal.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <View style={styles.protectionLabel}>
              <Ionicons name="shield-checkmark" size={16} color="#2563EB" />
              <Text style={styles.summaryLabelProtection}>Protezione Vyrlo</Text>
            </View>
            <Text style={styles.summaryValue}>€{paymentDetails?.platform_fee.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabelDeposit}>Deposito (rimborsabile)</Text>
            <Text style={styles.summaryValueDeposit}>€{paymentDetails?.deposit.toFixed(2)}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Totale Pagato</Text>
            <Text style={styles.totalValue}>€{paymentDetails?.amount_total.toFixed(2)}</Text>
          </View>
        </View>

        {/* Protection Info */}
        <View style={styles.protectionCard}>
          <Ionicons name="shield-checkmark" size={32} color="#2563EB" />
          <View style={styles.protectionInfo}>
            <Text style={styles.protectionTitle}>Protezione Vyrlo Attiva</Text>
            <Text style={styles.protectionDesc}>
              Il tuo noleggio è protetto. In caso di problemi con l'oggetto, sei coperto.
            </Text>
          </View>
        </View>

        {/* Booking Reference */}
        <View style={styles.referenceCard}>
          <Text style={styles.referenceLabel}>Codice Prenotazione</Text>
          <Text style={styles.referenceCode}>{paymentDetails?.booking_id}</Text>
        </View>

        {/* Contact Owner */}
        <View style={styles.contactSection}>
          <Text style={styles.contactTitle}>Contatta il Proprietario</Text>
          <Text style={styles.contactDesc}>
            Organizza il ritiro e la restituzione dell'oggetto
          </Text>
          
          <View style={styles.contactButtons}>
            <TouchableOpacity style={styles.chatButton} onPress={handleContactChat}>
              <Ionicons name="chatbubble" size={20} color="#ffffff" />
              <Text style={styles.chatButtonText}>Chat Vyrlo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.whatsappButton} onPress={handleContactWhatsApp}>
              <Ionicons name="logo-whatsapp" size={20} color="#ffffff" />
              <Text style={styles.whatsappButtonText}>WhatsApp</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.homeButton} onPress={() => router.push('/')}>
          <Text style={styles.homeButtonText}>Torna alla Home</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.bookingsButton} 
          onPress={() => router.push('/dashboard')}
        >
          <Text style={styles.bookingsButtonText}>Le mie prenotazioni</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  errorButton: {
    marginTop: 24,
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  scrollContent: {
    paddingBottom: 120,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSuccess: {
    backgroundColor: '#10B981',
  },
  iconCirclePending: {
    backgroundColor: '#F59E0B',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  itemCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    textTransform: 'uppercase',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },
  itemDays: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  protectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryLabelProtection: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '500',
  },
  summaryLabelDeposit: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  summaryValueDeposit: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
  },
  protectionCard: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    alignItems: 'center',
  },
  protectionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  protectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E40AF',
  },
  protectionDesc: {
    fontSize: 13,
    color: '#3B82F6',
    marginTop: 4,
    lineHeight: 18,
  },
  referenceCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    alignItems: 'center',
  },
  referenceLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  referenceCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  contactSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  contactDesc: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  chatButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  whatsappButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  whatsappButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 12,
  },
  homeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  homeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  bookingsButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  bookingsButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
