import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, Item } from '../../store/appStore';
import { api } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

interface UserProfile {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  description?: string;
  phone?: string;
  location?: string;
}

export default function UserProfilePage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAppStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userItems, setUserItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = user?.user_id === id;

  useEffect(() => {
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    try {
      const profileData = await api.getUserProfile(id || '');
      setProfile(profileData);
      
      // Load user's items
      const allItems = await api.getItems();
      const filteredItems = allItems.filter((item: Item) => item.owner_id === id);
      setUserItems(filteredItems);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      const result = await api.startConversation(
        { receiver_id: id || '' },
        sessionToken || undefined
      );
      router.push(`/chat/${result.conversation_id}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="person-outline" size={64} color="#D1D5DB" />
        <Text style={styles.errorText}>Utente non trovato</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header */}
      <View style={styles.header}>
        {profile.picture ? (
          <Image source={{ uri: profile.picture }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={48} color="#9CA3AF" />
          </View>
        )}
        
        <Text style={styles.name}>{profile.name}</Text>
        
        {profile.location && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={16} color="#6B7280" />
            <Text style={styles.location}>{profile.location}</Text>
          </View>
        )}
        
        {profile.description && (
          <Text style={styles.description}>{profile.description}</Text>
        )}
        
        {/* Actions */}
        {!isOwnProfile && (
          <TouchableOpacity style={styles.chatButton} onPress={startChat}>
            <Ionicons name="chatbubble-outline" size={20} color="#ffffff" />
            <Text style={styles.chatButtonText}>Invia messaggio</Text>
          </TouchableOpacity>
        )}
        
        {isOwnProfile && (
          <TouchableOpacity 
            style={styles.editButton} 
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={20} color="#2563EB" />
            <Text style={styles.editButtonText}>Modifica profilo</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* User's Items */}
      <View style={styles.itemsSection}>
        <Text style={styles.sectionTitle}>
          {isOwnProfile ? 'I tuoi annunci' : `Annunci di ${profile.name.split(' ')[0]}`}
        </Text>
        
        {userItems.length === 0 ? (
          <View style={styles.emptyItems}>
            <Text style={styles.emptyItemsText}>Nessun annuncio pubblicato</Text>
          </View>
        ) : (
          <View style={styles.itemsGrid}>
            {userItems.map((item) => (
              <TouchableOpacity
                key={item.item_id}
                style={styles.itemCard}
                onPress={() => router.push(`/item/${item.item_id}`)}
              >
                <Image source={{ uri: item.image }} style={styles.itemImage} />
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={styles.itemPrice}>€{item.price}/giorno</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
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
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 18,
    color: '#6B7280',
    marginTop: 16,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  location: {
    fontSize: 14,
    color: '#6B7280',
  },
  description: {
    fontSize: 15,
    color: '#4B5563',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
    gap: 8,
  },
  chatButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
    gap: 8,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2563EB',
  },
  itemsSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  emptyItems: {
    padding: 32,
    alignItems: 'center',
  },
  emptyItemsText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  itemCard: {
    width: cardWidth,
    marginBottom: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  itemImage: {
    width: '100%',
    height: cardWidth * 0.75,
    backgroundColor: '#F3F4F6',
  },
  itemContent: {
    padding: 10,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 4,
  },
});
