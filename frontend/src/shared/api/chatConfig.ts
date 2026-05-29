import { StorageService } from '../storage/storageService';

type AppGlobals = typeof globalThis & {
  __APP_LOCAL_IP__?: string;
  __APP_CHAT_BASE_URL__?: string;
};

const appGlobals = globalThis as AppGlobals;

const LOCAL_IP = appGlobals.__APP_LOCAL_IP__ ?? '192.168.0.54';
const CHAT_BASE_URL = appGlobals.__APP_CHAT_BASE_URL__;

const getBaseUrl = (): string => {
  if (CHAT_BASE_URL && CHAT_BASE_URL.length > 0) return CHAT_BASE_URL.replace(/\/$/, '');
  return `http://${LOCAL_IP}:8002`;
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
