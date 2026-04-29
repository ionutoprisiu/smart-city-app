import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../utils/logger';

const KEYS = {
  userId: 'user_id',
  userEmail: 'user_email',
  userName: 'user_name',
  userToken: 'user_token',
};

let cache: Record<string, string | null> = {};

const safeSet = async (key: string, value: string) => {
  try {
    await AsyncStorage.setItem(key, value);
    cache[key] = value;
    return true;
  } catch (e) {
    Logger.error(`StorageService set failed: ${key}`, e);
    return false;
  }
};

export const StorageService = {
  async init() {
    try {
      const all = await AsyncStorage.getMany(Object.values(KEYS));
      cache = { ...all };
      Logger.info('StorageService initialized');
    } catch (e) {
      Logger.error('StorageService init failed', e);
    }
  },

  saveUserId: (userId: number) => safeSet(KEYS.userId, String(userId)),
  getUserId: (): number | null => {
    const v = cache[KEYS.userId];
    if (v == null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  },

  saveUserEmail: (email: string) => safeSet(KEYS.userEmail, email),
  getUserEmail: (): string | null => cache[KEYS.userEmail] ?? null,

  saveUserName: (firstName: string, lastName: string) =>
    safeSet(KEYS.userName, `${firstName}|${lastName}`),
  getUserName: (): string | null => cache[KEYS.userName] ?? null,

  saveUserToken: (token: string) => safeSet(KEYS.userToken, token),
  getUserToken: (): string | null => cache[KEYS.userToken] ?? null,

  async clearAll() {
    try {
      await AsyncStorage.removeMany(Object.values(KEYS));
      cache = {};
      Logger.info('All user data cleared');
      return true;
    } catch (e) {
      Logger.error('Failed to clear user data', e);
      return false;
    }
  },
};
