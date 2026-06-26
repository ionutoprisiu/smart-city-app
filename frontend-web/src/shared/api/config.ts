import { StorageService } from '../storage/storageService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

const getBaseUrl = (): string => {
  if (API_BASE_URL && API_BASE_URL.length > 0) return API_BASE_URL.replace(/\/$/, '');
  return '/api';
};

export const ApiConfig = {
  get baseUrl() {
    return getBaseUrl();
  },

  authEndpoint: '/auth',
  visitCityEndpoint: '/visit-city',
  verificationEndpoint: '/verification',

  getHeaders({
    token,
  }: { token?: string | null } = {}): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const bearer = token ?? StorageService.getUserToken();
    if (bearer) headers.Authorization = `Bearer ${bearer}`;

    return headers;
  },

  getUrl(endpoint: string) {
    return `${this.baseUrl}${endpoint}`;
  },
};
