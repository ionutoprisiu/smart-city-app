import { StorageService } from '../storage/storageService';

const CHAT_BASE_URL = import.meta.env.VITE_CHAT_BASE_URL as string | undefined;

const getBaseUrl = (): string => {
  if (CHAT_BASE_URL && CHAT_BASE_URL.length > 0) return CHAT_BASE_URL.replace(/\/$/, '');
  return `${window.location.protocol}//${window.location.hostname}:8002`;
};

export const ChatConfig = {
  get baseUrl() {
    return getBaseUrl();
  },

  getUrl(path: string) {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseUrl}/api/v1${normalized}`;
  },

  getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const bearer = StorageService.getUserToken();
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    return headers;
  },
};
