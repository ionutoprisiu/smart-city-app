import { create } from 'zustand';
import { extractErrorMessage } from '@shared/api/errors';
import { StorageService } from '@shared/storage/storageService';
import { User } from '@shared/types/user';
import { Logger } from '@shared/utils/logger';
import {
  VerificationApi,
  VerificationImage,
} from '@features/verification/api/verificationApi';
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
  verificationMetadata: Record<string, unknown> | null;
  verificationCanSubmit: boolean;
  verificationBlockedReason: string | null;
  canAccessOrganizerFlow: boolean;
  organizerFlowBlockedReason: string | null;

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
  verificationMetadata: null,
  verificationCanSubmit: true,
  verificationBlockedReason: null,
  canAccessOrganizerFlow: true,
  organizerFlowBlockedReason: null,

  async initialize() {
    set({ isInitializing: true });
    try {
      await StorageService.init();
      const userId = StorageService.getUserId();
      const email = StorageService.getUserEmail();
      const name = StorageService.getUserName();
      const token = StorageService.getUserToken();
      if (userId != null && email && name && token) {
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
      if (response.accessToken) await StorageService.saveUserToken(response.accessToken);
      set({
        currentUser: {
          ...userFromAuthResponse(response),
          profilePhotoUri: StorageService.getUserProfilePhotoUri(),
        },
        isLoading: false,
      });
      Logger.info(`Login successful: ${response.email}`);
      await get().refreshVerificationStatus();
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
      if (response.accessToken) await StorageService.saveUserToken(response.accessToken);
      set({
        currentUser: {
          ...userFromAuthResponse(response),
          profilePhotoUri: StorageService.getUserProfilePhotoUri(),
        },
        isLoading: false,
      });
      Logger.info(`Registration successful: ${response.email}`);
      await get().refreshVerificationStatus();
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
        verificationMetadata: null,
        verificationCanSubmit: true,
        verificationBlockedReason: null,
        canAccessOrganizerFlow: true,
        organizerFlowBlockedReason: null,
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
        idCardImage,
        selfieImage,
      });

      try {
        const status = await VerificationApi.getStatus();
        set({
          verificationScore: status.score,
          verificationReason: status.reason,
          verificationMetadata: status.metadata,
          verificationCanSubmit: status.canSubmit,
          verificationBlockedReason: status.submitBlockedReason,
          canAccessOrganizerFlow: status.canAccessOrganizerFlow,
          organizerFlowBlockedReason: status.organizerFlowBlockedReason,
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
        verificationCanSubmit: false,
        verificationBlockedReason: 'Your documents are under admin review. Wait for a decision.',
        canAccessOrganizerFlow: false,
        organizerFlowBlockedReason: 'Your documents are under admin review. Wait for a decision.',
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
      const status = await VerificationApi.getStatus();
      set({
        currentUser: {
          ...user,
          role: status.role,
          isVerified: status.isVerified,
          verificationStatus: status.status,
        },
        verificationScore: status.score,
        verificationReason: status.reason,
        verificationMetadata: status.metadata,
        verificationCanSubmit: status.canSubmit,
        verificationBlockedReason: status.submitBlockedReason,
        canAccessOrganizerFlow: status.canAccessOrganizerFlow,
        organizerFlowBlockedReason: status.organizerFlowBlockedReason,
      });
      await StorageService.saveUserIsVerified(status.isVerified);
      await StorageService.saveUserVerificationStatus(status.status);
      await StorageService.saveUserRole(status.role);
    } catch {
      // Non-blocking refresh.
    }
  },

  clearError() {
    set({ errorMessage: null });
  },
}));
