import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface FetchOptions extends RequestInit {
  timeout?: number;
}

async function fetchWithTimeout(url: string, options: FetchOptions = {}) {
  const { timeout = 10000, ...fetchOptions } = options;
  
  // Validate that we have a proper URL
  if (!API_BASE || API_BASE === 'undefined') {
    throw new Error('Backend URL not configured');
  }
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      credentials: 'same-origin',
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// Retry wrapper for API calls
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}

export const api = {
  // Auth
  async exchangeSession(sessionId: string) {
    const response = await fetchWithTimeout(`${API_BASE}/api/auth/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    if (!response.ok) throw new Error('Session exchange failed');
    return response.json();
  },

  async getMe(sessionToken?: string) {
    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetchWithTimeout(`${API_BASE}/api/auth/me`, { headers });
    if (!response.ok) throw new Error('Not authenticated');
    return response.json();
  },

  async logout() {
    const response = await fetchWithTimeout(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
    });
    return response.json();
  },

  // Items
  async getItems(category?: string, search?: string) {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    const url = `${API_BASE}/api/items${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error('Failed to fetch items');
    return response.json();
  },

  async getItem(itemId: string) {
    const response = await fetchWithTimeout(`${API_BASE}/api/items/${itemId}`);
    if (!response.ok) throw new Error('Item not found');
    return response.json();
  },

  async createItem(data: {
    title: string;
    category: string;
    condition: string;
    price: number;
    description: string;
    image: string;
    custom_deposit?: number;
  }, sessionToken?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetchWithTimeout(`${API_BASE}/api/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create item');
    }
    return response.json();
  },

  async getMyItems(sessionToken?: string) {
    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetchWithTimeout(`${API_BASE}/api/my-items`, { headers });
    if (!response.ok) throw new Error('Failed to fetch items');
    return response.json();
  },

  // Bookings
  async createBooking(data: { item_id: string; days: number }, sessionToken?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetchWithTimeout(`${API_BASE}/api/bookings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create booking');
    }
    return response.json();
  },

  async getMyBookings(sessionToken?: string) {
    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetchWithTimeout(`${API_BASE}/api/my-bookings`, { headers });
    if (!response.ok) throw new Error('Failed to fetch bookings');
    return response.json();
  },

  // Seed data
  async seedData() {
    const response = await fetchWithTimeout(`${API_BASE}/api/seed`, {
      method: 'POST',
    });
    return response.json();
  },

  // User Profile
  async updateProfile(data: {
    name?: string;
    description?: string;
    phone?: string;
    location?: string;
  }, sessionToken?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetchWithTimeout(`${API_BASE}/api/auth/me`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update profile');
    }
    return response.json();
  },

  async getUserProfile(userId: string) {
    const response = await fetchWithTimeout(`${API_BASE}/api/users/${userId}`);
    if (!response.ok) throw new Error('User not found');
    return response.json();
  },

  // Chat
  async getConversations(sessionToken?: string) {
    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetchWithTimeout(`${API_BASE}/api/conversations`, { headers });
    if (!response.ok) throw new Error('Failed to fetch conversations');
    return response.json();
  },

  async getMessages(conversationId: string, sessionToken?: string) {
    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetchWithTimeout(`${API_BASE}/api/conversations/${conversationId}/messages`, { headers });
    if (!response.ok) throw new Error('Failed to fetch messages');
    return response.json();
  },

  async sendMessage(data: { receiver_id: string; content: string; item_id?: string }, sessionToken?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetchWithTimeout(`${API_BASE}/api/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to send message');
    }
    return response.json();
  },

  async startConversation(data: { receiver_id: string; item_id?: string; message?: string }, sessionToken?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetchWithTimeout(`${API_BASE}/api/conversations/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start conversation');
    }
    return response.json();
  },

  // Stripe Payments
  async createCheckout(data: { item_id: string; days: number; origin_url: string }, sessionToken?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetchWithTimeout(`${API_BASE}/api/checkout/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create checkout');
    }
    return response.json();
  },

  async getCheckoutStatus(sessionId: string, sessionToken?: string) {
    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetchWithTimeout(`${API_BASE}/api/checkout/status/${sessionId}`, { headers });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get checkout status');
    }
    return response.json();
  },

  async getBookingDetails(bookingId: string, sessionToken?: string) {
    const headers: Record<string, string> = {};
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    const response = await fetchWithTimeout(`${API_BASE}/api/booking/${bookingId}`, { headers });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get booking details');
    }
    return response.json();
  },
};
