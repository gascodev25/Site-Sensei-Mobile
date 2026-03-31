import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:5000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const SESSION_COOKIE_KEY = 'acgworks_session_cookie';

apiClient.interceptors.request.use(async (config) => {
  const cookie = await AsyncStorage.getItem(SESSION_COOKIE_KEY);
  if (cookie) {
    config.headers['Cookie'] = cookie;
  }
  return config;
});

apiClient.interceptors.response.use(
  async (response) => {
    const setCookie = response.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      const rawCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
      const cookieValue = rawCookie.split(';')[0];
      await AsyncStorage.setItem(SESSION_COOKIE_KEY, cookieValue);
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_COOKIE_KEY);
}

export type MobileService = {
  id: number;
  type: string;
  installationDate: string | null;
  status: string;
  recurrencePattern: { interval?: string; end_date?: string } | null;
  occurrenceDatesInRange: string[];
  pendingOccurrenceDates: string[];
  client: {
    id: number;
    name: string;
    addressText: string;
    city: string | null;
    contactPerson: string | null;
    phone: string | null;
  };
  team: { id: number; name: string } | null;
  consumables: { id: number; name: string; plannedQty: number; stockCode?: string; stockItemId?: number }[];
  equipment: { id: number; name: string; quantity: number }[];
};

export type FieldReportPayload = {
  serviceId: number;
  completionDate: string;
  teamMemberId?: number;
  actualConsumables: {
    id: number;
    name: string;
    plannedQty: number;
    actualQty: number;
  }[];
  teamSignature?: string;
  clientSignature?: string;
  photos: { dataUrl: string; comment: string; timestamp: string }[];
  hasAdjustments: boolean;
  notes?: string;
};

export async function login(email: string, password: string) {
  const response = await apiClient.post('/api/login/local', { email, password });
  return response.data;
}

export async function logout() {
  await apiClient.post('/api/logout');
  await clearSession();
}

export async function getCurrentUser() {
  const response = await apiClient.get('/api/auth/user');
  return response.data;
}

export async function getMobileServices(range: 'today' | 'week' | 'month', teamId?: number | null): Promise<MobileService[]> {
  const response = await apiClient.get('/api/mobile/services', {
    params: teamId ? { range, teamId } : { range },
  });
  return response.data;
}

export async function submitFieldReport(payload: FieldReportPayload) {
  const response = await apiClient.post('/api/field-reports', payload);
  return response.data;
}

export async function getFieldReport(serviceId: number) {
  const response = await apiClient.get(`/api/field-reports/${serviceId}`);
  return response.data;
}
