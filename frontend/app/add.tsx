import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore, CATEGORIES } from '../store/appStore';
import { api } from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AddItemPage() {
  const router = useRouter();
  const { isAuthenticated, setItems } = useAppStore();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('Ottime condizioni');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [customDeposit, setCustomDeposit] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showConditionPicker, setShowConditionPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const CONDITIONS = [
    'Come nuovo',
    'Ottime condizioni',
    'Buone condizioni',
    'Condizioni accettabili',
  ];

  // Default placeholder images per category
  const CATEGORY_IMAGES: Record<string, string> = {
    'Foto & Video': 'https://images.unsplash.com/photo-1606986628470-26a67fa4730c?w=600&q=80',
    'Edilizia': 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=600&q=80',
    'Libri & Fumetti': 'https://images.unsplash.com/photo-1709675577966-6231e5a2ac43?w=600&q=80',
    'Sport': 'https://images.unsplash.com/photo-1624243519828-52a0f2c88af3?w=600&q=80',
  };

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Accesso richiesto',
        'Devi effettuare l\'accesso per pubblicare annunci',
        [
          { text: 'Annulla', style: 'cancel' },
          { text: 'Accedi', onPress: () => router.push('/login') },
        ]
      );
      return;
    }

    if (!title.trim()) {
      Alert.alert('Errore', 'Inserisci un titolo');
      return;
    }
    if (!category) {
      Alert.alert('Errore', 'Seleziona una categoria');
      return;
    }
    if (!price || isNaN(Number(price))) {
      Alert.alert('Errore', 'Inserisci un prezzo valido');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Errore', 'Inserisci una descrizione');
      return;
    }

    setLoading(true);

    try {
      const sessionToken = await AsyncStorage.getItem('session_token');
      
      await api.createItem(
        {
          title: title.trim(),
          category,
          condition,
          price: Number(price),
          description: description.trim(),
          image: CATEGORY_IMAGES[category] || CATEGORY_IMAGES['Foto & Video'],
          custom_deposit: customDeposit ? Number(customDeposit) : undefined,
        },
        sessionToken || undefined
      );

      // Refresh items list
      const items = await api.getItems();
      setItems(items);

      Alert.alert('Successo!', 'Il tuo annuncio è stato pubblicato', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Errore', error.message || 'Errore durante la pubblicazione');
    } finally {
      setLoading(false);
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
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.form}>
          {/* Title */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Titolo annuncio *</Text>
            <TextInput
              style={styles.input}
              placeholder="Es. Drone DJI Mini 4 Pro completo..."
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Category */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Categoria *</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => {
                setShowCategoryPicker(!showCategoryPicker);
                setShowConditionPicker(false);
              }}
            >
              <Text
                style={[
                  styles.selectButtonText,
                  !category && styles.selectButtonPlaceholder,
                ]}
              >
                {category || 'Seleziona categoria'}
              </Text>
              <Ionicons
                name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
            {showCategoryPicker && (
              <View style={styles.picker}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.pickerOption,
                      category === cat && styles.pickerOptionActive,
                    ]}
                    onPress={() => {
                      setCategory(cat);
                      setShowCategoryPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        category === cat && styles.pickerOptionTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                    {category === cat && (
                      <Ionicons name="checkmark" size={20} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Condition */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Condizioni</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => {
                setShowConditionPicker(!showConditionPicker);
                setShowCategoryPicker(false);
              }}
            >
              <Text style={styles.selectButtonText}>{condition}</Text>
              <Ionicons
                name={showConditionPicker ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>
            {showConditionPicker && (
              <View style={styles.picker}>
                {CONDITIONS.map((cond) => (
                  <TouchableOpacity
                    key={cond}
                    style={[
                      styles.pickerOption,
                      condition === cond && styles.pickerOptionActive,
                    ]}
                    onPress={() => {
                      setCondition(cond);
                      setShowConditionPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        condition === cond && styles.pickerOptionTextActive,
                      ]}
                    >
                      {cond}
                    </Text>
                    {condition === cond && (
                      <Ionicons name="checkmark" size={20} color="#2563EB" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Price */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Prezzo al giorno *</Text>
            <View style={styles.priceInputContainer}>
              <Text style={styles.euroSymbol}>€</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                value={price}
                onChangeText={(text) => setPrice(text.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
              />
              <Text style={styles.perDay}>/giorno</Text>
            </View>
          </View>

          {/* Custom Deposit */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Deposito cauzionale (opzionale)</Text>
            <View style={styles.priceInputContainer}>
              <Text style={styles.euroSymbol}>€</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Default: 20% del subtotale"
                placeholderTextColor="#9CA3AF"
                value={customDeposit}
                onChangeText={(text) => setCustomDeposit(text.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.hint}>
              Lascia vuoto per usare il 20% automatico
            </Text>
          </View>

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Descrizione *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Descrivi le condizioni, cosa è incluso, eventuali accessori..."
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={24} color="#2563EB" />
            <Text style={styles.infoText}>
              La Protezione Vyrlo (15%) verrà aggiunta automaticamente al prezzo visualizzato dal noleggiatore.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.submitContainer}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons
                name="add-circle"
                size={24}
                color="#ffffff"
                style={styles.submitIcon}
              />
              <Text style={styles.submitButtonText}>Pubblica Annuncio</Text>
            </>
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
  scrollContent: {
    paddingBottom: 120,
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    ...Platform.select({
      web: { outlineStyle: 'none' },
    }),
  },
  textArea: {
    height: 120,
    paddingTop: 14,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  selectButtonText: {
    fontSize: 16,
    color: '#111827',
  },
  selectButtonPlaceholder: {
    color: '#9CA3AF',
  },
  picker: {
    marginTop: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickerOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  pickerOptionText: {
    fontSize: 16,
    color: '#4B5563',
  },
  pickerOptionTextActive: {
    color: '#2563EB',
    fontWeight: '600',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  euroSymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    paddingVertical: 14,
    ...Platform.select({
      web: { outlineStyle: 'none' },
    }),
  },
  perDay: {
    fontSize: 14,
    color: '#6B7280',
  },
  hint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  submitContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitIcon: {
    marginRight: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
