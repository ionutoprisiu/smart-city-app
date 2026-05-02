import { create } from 'zustand';
import { extractErrorMessage } from '../../../shared/api/errors';
import { StorageService } from '../../../shared/storage/storageService';
import { User } from '../../../shared/types/user';
import { Logger } from '../../../shared/utils/logger';
import {
  VerificationApi,
  VerificationImage,
} from '../../verification/api/verificationApi';
import { AuthApi } from '../api/authApi';
import {
  LoginRequest,
  RegisterRequest,
  userFromAuthResponse,
} from '../types';

type AuthState = {
  currentUser: User | null;
  isLoading: boolean;
  isInitializing: boolean;
  errorMessage: string | null;
  verificationScore: number | null;
  verificationReason: string | null;
  verificationOcrData: Record<string, unknown> | null;

  initialize: () => Promise<void>;
  login: (request: LoginRequest) => Promise<boolean>;
  register: (request: RegisterRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  submitVerification: (args: {
    idCardImage: VerificationImage;
    selfieImage: VerificationImage;
  }) => Promise<boolean>;
  refreshVerificationStatus: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  isLoading: false,
  isInitializing: true,
  errorMessage: null,
  verificationScore: null,
  verificationReason: null,
  verificationOcrData: null,

  async initialize() {
    set({ isInitializing: true });
    try {
      await StorageService.init();
      const userId = StorageService.getUserId();
      const email = StorageService.getUserEmail();
      const name = StorageService.getUserName();
      if (userId != null && email && name) {
        const [firstName, lastName] = name.split('|');
        if (firstName && lastName) {
          const user: User = {
            id: userId,
            email,
            firstName,
            lastName,
            profilePhotoUri: StorageService.getUserProfilePhotoUri(),
            role: StorageService.getUserRole(),
            isVerified: StorageService.getUserIsVerified(),
            verificationStatus: StorageService.getUserVerificationStatus() ?? 'notSubmitted',
          };
          set({ currentUser: user });
          Logger.info(`User loaded from storage: ${user.email}`);
          await get().refreshVerificationStatus();
        }
      }
    } catch (e) {
      Logger.error('Failed to initialize auth', e);
    } finally {
      set({ isInitializing: false });
    }
  },

  async login(request) {
    set({ isLoading: true, errorMessage: null });
    try {
      const response = await AuthApi.login(request);
      await StorageService.saveUserId(response.userId);
      await StorageService.saveUserEmail(response.email);
      await StorageService.saveUserName(response.firstName, response.lastName);
      if (response.role) await StorageService.saveUserRole(response.role);
      if (response.isVerified != null) await StorageService.saveUserIsVerified(response.isVerified);
      await StorageService.saveUserVerificationStatus(response.verificationStatus);
      set({
        currentUser: {
          ...userFromAuthResponse(response),
          profilePhotoUri: StorageService.getUserProfilePhotoUri(),
        },
        isLoading: false,
      });
      Logger.info(`Login successful: ${response.email}`);
      return true;
    } catch (e) {
      set({ isLoading: false, errorMessage: extractErrorMessage(e) });
      return false;
    }
  },

  async register(request) {
    set({ isLoading: true, errorMessage: null });
    try {
      const response = await AuthApi.register(request);
      await StorageService.saveUserId(response.userId);
      await StorageService.saveUserEmail(response.email);
      await StorageService.saveUserName(response.firstName, response.lastName);
      if (response.role) await StorageService.saveUserRole(response.role);
      if (response.isVerified != null) await StorageService.saveUserIsVerified(response.isVerified);
      await StorageService.saveUserVerificationStatus(response.verificationStatus);
      set({
        currentUser: {
          ...userFromAuthResponse(response),
          profilePhotoUri: StorageService.getUserProfilePhotoUri(),
        },
        isLoading: false,
      });
      Logger.info(`Registration successful: ${response.email}`);
      return true;
    } catch (e) {
      set({ isLoading: false, errorMessage: extractErrorMessage(e) });
      return false;
    }
  },

  async logout() {
    try {
      await StorageService.clearAll();
      set({
        currentUser: null,
        errorMessage: null,
        verificationScore: null,
        verificationReason: null,
        verificationOcrData: null,
      });
      Logger.info('User logged out');
    } catch (e) {
      Logger.error('Logout failed', e);
    }
  },

  async submitVerification({ idCardImage, selfieImage }) {
    const user = get().currentUser;
    if (!user) {
      set({ errorMessage: 'You must be logged in.' });
      return false;
    }
    set({ isLoading: true, errorMessage: null });
    try {
      const result = await VerificationApi.submit({
        userId: user.id,
        idCardImage,
        selfieImage,
      });

      try {
        const status = await VerificationApi.getStatus(user.id);
        set({
          verificationScore: status.score,
          verificationReason: status.reason,
          verificationOcrData: status.ocrData,
        });
      } catch {
        // keep submit response data when status fetch fails.
      }

      const isApproved = result.status === 'approved';
      set({
        currentUser: {
          ...user,
          isVerified: isApproved,
          verificationStatus: result.status,
        },
        verificationScore: result.score,
        verificationReason: result.reason,
        isLoading: false,
      });
      await StorageService.saveUserIsVerified(isApproved);
      await StorageService.saveUserVerificationStatus(result.status);
      return true;
    } catch (e) {
      set({ isLoading: false, errorMessage: extractErrorMessage(e) });
      return false;
    }
  },

  async refreshVerificationStatus() {
    const user = get().currentUser;
    if (!user) return;
    try {
      const status = await VerificationApi.getStatus(user.id);
      set({
        currentUser: {
          ...user,
          isVerified: status.status === 'approved',
          verificationStatus: status.status,
        },
        verificationScore: status.score,
        verificationReason: status.reason,
        verificationOcrData: status.ocrData,
      });
      await StorageService.saveUserIsVerified(status.status === 'approved');
      await StorageService.saveUserVerificationStatus(status.status);
    } catch {
      // Non-blocking refresh.
    }
  },

  clearError() {
    set({ errorMessage: null });
  },
}));
