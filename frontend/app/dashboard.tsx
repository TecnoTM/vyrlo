import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Item, Booking } from '../store/appStore';
import { api } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout, setUser } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<'bookings' | 'items'>('bookings');
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    loadData();
  }, [isAuthenticated]);

  const loadData = async () => {
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      
      const [bookings, items] = await Promise.all([
        api.getMyBookings(sessionToken || undefined),
        api.getMyItems(sessionToken || undefined),
      ]);
      
      setMyBookings(bookings);
      setMyItems(items);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Esci',
      'Sei sicuro di voler uscire?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Esci',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('session_token');
            await api.logout();
            logout();
            setUser(null);
            router.replace('/');
          },
        },
      ]
    );
  };

  if (!isAuthenticated || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Ionicons name="person" size={40} color="#9CA3AF" />
            </View>
          )}
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/add')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="add-circle" size={28} color="#2563EB" />
            </View>
            <Text style={styles.quickActionText}>Pubblica</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/chat')}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="chatbubbles" size={28} color="#2563EB" />
            </View>
            <Text style={styles.quickActionText}>Messaggi</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push(`/profile/${user?.user_id}`)}
          >
            <View style={styles.quickActionIcon}>
              <Ionicons name="person" size={28} color="#2563EB" />
            </View>
            <Text style={styles.quickActionText}>Profilo</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'bookings' && styles.tabActive]}
            onPress={() => setActiveTab('bookings')}
          >
            <Ionicons
              name="calendar"
              size={20}
              color={activeTab === 'bookings' ? '#2563EB' : '#9CA3AF'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'bookings' && styles.tabTextActive,
              ]}
            >
              Prenotazioni
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'items' && styles.tabActive]}
            onPress={() => setActiveTab('items')}
          >
            <Ionicons
              name="cube"
              size={20}
              color={activeTab === 'items' ? '#2563EB' : '#9CA3AF'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'items' && styles.tabTextActive,
              ]}
            >
              I miei annunci
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {activeTab === 'bookings' ? (
          <View style={styles.content}>
            {myBookings.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>Nessuna prenotazione</Text>
                <Text style={styles.emptyStateText}>
                  Le tue prenotazioni appariranno qui
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => router.push('/')}
                >
                  <Text style={styles.emptyStateButtonText}>Esplora oggetti</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myBookings.map((booking) => (
                <View key={booking.booking_id} style={styles.bookingCard}>
                  <View style={styles.bookingHeader}>
                    <View style={styles.bookingStatus}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color="#10B981"
                      />
                      <Text style={styles.bookingStatusText}>
                        {booking.status === 'confirmed' ? 'Confermato' : booking.status}
                      </Text>
                    </View>
                    <Text style={styles.bookingDate}>
                      {new Date(booking.created_at).toLocaleDateString('it-IT')}
                    </Text>
                  </View>
                  <View style={styles.bookingDetails}>
                    <Text style={styles.bookingDays}>
                      {booking.days} {booking.days === 1 ? 'giorno' : 'giorni'}
                    </Text>
                    <View style={styles.bookingPricing}>
                      <Text style={styles.bookingLabel}>Subtotale</Text>
                      <Text style={styles.bookingValue}>€{booking.subtotal.toFixed(2)}</Text>
                    </View>
                    <View style={styles.bookingPricing}>
                      <Text style={styles.bookingLabel}>Protezione</Text>
                      <Text style={styles.bookingValue}>€{booking.protection_fee.toFixed(2)}</Text>
                    </View>
                    <View style={styles.bookingPricing}>
                      <Text style={styles.bookingLabelDeposit}>Deposito</Text>
                      <Text style={styles.bookingValueDeposit}>€{booking.deposit.toFixed(2)}</Text>
                    </View>
                    <View style={styles.bookingTotal}>
                      <Text style={styles.bookingTotalLabel}>Totale pagato</Text>
                      <Text style={styles.bookingTotalValue}>€{booking.total.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={styles.content}>
            {myItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="cube-outline" size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateTitle}>Nessun annuncio</Text>
                <Text style={styles.emptyStateText}>
                  Inizia a guadagnare pubblicando il tuo primo annuncio
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => router.push('/add')}
                >
                  <Text style={styles.emptyStateButtonText}>Pubblica ora</Text>
                </TouchableOpacity>
              </View>
            ) : (
              myItems.map((item) => (
                <TouchableOpacity
                  key={item.item_id}
                  style={styles.itemCard}
                  onPress={() => router.push(`/item/${item.item_id}`)}
                >
                  <Image source={{ uri: item.image }} style={styles.itemImage} />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemCategory}>{item.category}</Text>
                    <Text style={styles.itemTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.itemPrice}>
                      €{item.price}/giorno
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
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
  scrollContent: {
    paddingBottom: 24,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profileImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  profileEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 20,
    gap: 12,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
  },
  quickActionIcon: {
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2563EB',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#2563EB',
  },
  content: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyStateButton: {
    marginTop: 20,
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  bookingCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bookingStatusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10B981',
  },
  bookingDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  bookingDetails: {
    gap: 8,
  },
  bookingDays: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  bookingPricing: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bookingLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  bookingValue: {
    fontSize: 14,
    color: '#374151',
  },
  bookingLabelDeposit: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  bookingValueDeposit: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  bookingTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bookingTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  bookingTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  itemImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2563EB',
    textTransform: 'uppercase',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 4,
  },
});
