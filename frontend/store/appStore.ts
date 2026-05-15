import { create } from 'zustand';

export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  description?: string;
  phone?: string;
  location?: string;
}

export interface Item {
  item_id: string;
  title: string;
  category: string;
  condition: string;
  price: number;
  description: string;
  image: string;
  owner_id: string;
  owner_name?: string;
  owner_picture?: string;
  custom_deposit?: number | null;
  created_at: string;
}

export interface Booking {
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
  created_at: string;
}

interface AppStore {
  // Auth state
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Items state
  items: Item[];
  searchQuery: string;
  selectedCategory: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setIsAuthenticated: (value: boolean) => void;
  setIsLoading: (value: boolean) => void;
  setItems: (items: Item[]) => void;
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string | null) => void;
  logout: () => void;
  getFilteredItems: () => Item[];
}

export const CATEGORIES = [
  'Foto & Video',
  'Edilizia',
  'Libri & Fumetti',
  'Sport',
];

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  isLoading: true,
  items: [],
  searchQuery: '',
  selectedCategory: null,

  // Actions
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setIsAuthenticated: (value) => set({ isAuthenticated: value }),
  setIsLoading: (value) => set({ isLoading: value }),
  setItems: (items) => set({ items }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  
  logout: () => set({ user: null, isAuthenticated: false }),

  getFilteredItems: () => {
    const { items, searchQuery, selectedCategory } = get();
    return items.filter((item) => {
      const matchesSearch = searchQuery
        ? item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      const matchesCategory = selectedCategory
        ? item.category === selectedCategory
        : true;
      return matchesSearch && matchesCategory;
    });
  },
}));
