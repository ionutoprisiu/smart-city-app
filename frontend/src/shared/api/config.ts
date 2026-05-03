import { StorageService } from '../storage/storageService';

type AppGlobals = typeof globalThis & {
  __APP_LOCAL_IP__?: string;
  __APP_API_BASE_URL__?: string;
};

const appGlobals = globalThis as AppGlobals;

/**
 * Local IP of the backend host (Mac running FastAPI) on the Wi-Fi network.
 * The iPhone (or iOS Simulator on a different machine) must be on the same Wi-Fi.
 * Override at runtime by setting __APP_LOCAL_IP__ on globalThis (e.g. dev menu),
 * or just edit this constant when running on a physical iOS device.
 */
const LOCAL_IP = appGlobals.__APP_LOCAL_IP__ ?? '192.168.0.54';

/** Optional override for the entire base URL (useful for staging/prod builds). */
const API_BASE_URL = appGlobals.__APP_API_BASE_URL__;

const getBaseUrl = (): string => {
  if (API_BASE_URL && API_BASE_URL.length > 0) return API_BASE_URL;
  return `http://${LOCAL_IP}:8080/api`;
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
