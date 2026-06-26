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

const safeSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    Logger.error(`StorageService set failed: ${key}`, e);
    return false;
  }
};

const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeRemove = (key: string) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    Logger.error(`StorageService remove failed: ${key}`, e);
    return false;
  }
};

export const StorageService = {
  async init() {},

  saveUserId: (userId: number) => safeSet(KEYS.userId, String(userId)),
  getUserId: (): number | null => {
    const v = safeGet(KEYS.userId);
    if (v == null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  },

  saveUserEmail: (email: string) => safeSet(KEYS.userEmail, email),
  getUserEmail: (): string | null => safeGet(KEYS.userEmail),

  saveUserName: (firstName: string, lastName: string) =>
    safeSet(KEYS.userName, `${firstName}|${lastName}`),
  getUserName: (): string | null => safeGet(KEYS.userName),

  saveUserProfilePhotoUri: (uri: string) => safeSet(KEYS.userProfilePhotoUri, uri),
  getUserProfilePhotoUri: (): string | null => safeGet(KEYS.userProfilePhotoUri),
  clearUserProfilePhotoUri: () => safeRemove(KEYS.userProfilePhotoUri),

  saveUserRole: (role: Role) => safeSet(KEYS.userRole, role),
  getUserRole: (): Role | null => {
    const value = safeGet(KEYS.userRole);
    if (value === 'user' || value === 'organizer' || value === 'admin') return value;
    return null;
  },

  saveUserIsVerified: (isVerified: boolean) => safeSet(KEYS.userIsVerified, String(isVerified)),
  getUserIsVerified: (): boolean | null => {
    const value = safeGet(KEYS.userIsVerified);
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
  },

  saveUserVerificationStatus: (status: VerificationStatus) =>
    safeSet(KEYS.userVerificationStatus, status),
  getUserVerificationStatus: (): VerificationStatus | null => {
    const value = safeGet(KEYS.userVerificationStatus);
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
  getUserToken: (): string | null => safeGet(KEYS.userToken),

  async clearAll() {
    try {
      Object.values(KEYS).forEach((key) => localStorage.removeItem(key));
      Logger.info('All user data cleared');
      return true;
    } catch (e) {
      Logger.error('Failed to clear user data', e);
      return false;
    }
  },
};
