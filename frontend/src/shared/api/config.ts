import { StorageService } from '../storage/storageService';

/**
 * Local IP of the backend host (Mac running FastAPI) on the Wi-Fi network.
 * The iPhone (or iOS Simulator on a different machine) must be on the same Wi-Fi.
 * Override at runtime by setting __APP_LOCAL_IP__ on globalThis (e.g. dev menu),
 * or just edit this constant when running on a physical iOS device.
 */
const LOCAL_IP =
  (globalThis as any).__APP_LOCAL_IP__ ?? '192.168.0.54';

/** Optional override for the entire base URL (useful for staging/prod builds). */
const API_BASE_URL = (globalThis as any).__APP_API_BASE_URL__ as
  | string
  | undefined;

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
    userId,
  }: { token?: string | null; userId?: number | null } = {}): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const effectiveUserId = userId ?? StorageService.getUserId();
    if (effectiveUserId != null) headers['X-User-Id'] = String(effectiveUserId);

    return headers;
  },

  getUrl(endpoint: string) {
    return `${this.baseUrl}${endpoint}`;
  },
};
