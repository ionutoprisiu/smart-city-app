import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '../utils/logger';
import { Role } from '../types/role';
import { VerificationStatus } from '../types/verification';

const KEYS = {
  userId: 'user_id',
  userEmail: 'user_email',
  userName: 'user_name',
  userProfilePhotoUri: 'user_profile_photo_uri',
  userRole: 'user_role',
  userIsVerified: 'user_is_verified',
  userVerificationStatus: 'user_verification_status',
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

const safeRemove = async (key: string) => {
  try {
    await AsyncStorage.removeItem(key);
    cache[key] = null;
    return true;
  } catch (e) {
    Logger.error(`StorageService remove failed: ${key}`, e);
    return false;
  }
};

export const StorageService = {
  async init() {
    try {
      const all = await AsyncStorage.getMany(Object.values(KEYS));
      if (Array.isArray(all)) {
        cache = all.reduce<Record<string, string | null>>((acc, entry) => {
          if (Array.isArray(entry) && entry.length === 2) {
            acc[String(entry[0])] = entry[1] as string | null;
          }
          return acc;
        }, {});
      } else {
        cache = all as Record<string, string | null>;
      }
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

  saveUserProfilePhotoUri: (uri: string) => safeSet(KEYS.userProfilePhotoUri, uri),
  getUserProfilePhotoUri: (): string | null => cache[KEYS.userProfilePhotoUri] ?? null,
  clearUserProfilePhotoUri: () => safeRemove(KEYS.userProfilePhotoUri),

  saveUserRole: (role: Role) => safeSet(KEYS.userRole, role),
  getUserRole: (): Role | null => {
    const value = cache[KEYS.userRole];
    if (value === 'user' || value === 'organizer' || value === 'admin') return value;
    return null;
  },

  saveUserIsVerified: (isVerified: boolean) => safeSet(KEYS.userIsVerified, String(isVerified)),
  getUserIsVerified: (): boolean | null => {
    const value = cache[KEYS.userIsVerified];
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
  },

  saveUserVerificationStatus: (status: VerificationStatus) =>
    safeSet(KEYS.userVerificationStatus, status),
  getUserVerificationStatus: (): VerificationStatus | null => {
    const value = cache[KEYS.userVerificationStatus];
    if (
      value === 'notSubmitted' ||
      value === 'pending' ||
      value === 'approved' ||
      value === 'rejected' ||
      value === 'manualReview'
    ) {
      return value;
    }
    return null;
  },

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
