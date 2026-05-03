import { useAuthStore } from '@features/auth/store/authStore';
import { AuthApi } from '@features/auth/api/authApi';
import { StorageService } from '@shared/storage/storageService';

jest.mock('../src/features/auth/api/authApi', () => ({
  AuthApi: {
    login: jest.fn(),
    register: jest.fn(),
  },
}));

jest.mock('../src/shared/storage/storageService', () => ({
  StorageService: {
    init: jest.fn(),
    getUserId: jest.fn(),
    getUserEmail: jest.fn(),
    getUserName: jest.fn(),
    getUserProfilePhotoUri: jest.fn(() => null),
    saveUserId: jest.fn(),
    saveUserEmail: jest.fn(),
    saveUserName: jest.fn(),
    saveUserRole: jest.fn(),
    saveUserIsVerified: jest.fn(),
    saveUserVerificationStatus: jest.fn(),
    clearAll: jest.fn(),
    getUserToken: jest.fn(),
    saveUserToken: jest.fn(),
  },
}));

const mockedAuthApi = AuthApi as jest.Mocked<typeof AuthApi>;
const mockedStorage = StorageService as jest.Mocked<typeof StorageService>;

const resetStore = () => {
  useAuthStore.setState({
    currentUser: null,
    isLoading: false,
    isInitializing: true,
    errorMessage: null,
    verificationScore: null,
    verificationReason: null,
    verificationOcrData: null,
  });
};

describe('authStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  test('login persists user data and updates current user', async () => {
    mockedAuthApi.login.mockResolvedValue({
      userId: 1,
      email: 'user@example.com',
      role: 'user',
      firstName: 'Ionut',
      lastName: 'Popescu',
      isVerified: false,
      verificationStatus: 'notSubmitted',
      accessToken: 'test.jwt.token',
      message: 'ok',
    });

    const ok = await useAuthStore
      .getState()
      .login({ email: 'user@example.com', password: 'secret123' });

    expect(ok).toBe(true);
    expect(mockedStorage.saveUserId).toHaveBeenCalledWith(1);
    expect(mockedStorage.saveUserEmail).toHaveBeenCalledWith('user@example.com');
    expect(mockedStorage.saveUserName).toHaveBeenCalledWith('Ionut', 'Popescu');
    expect(mockedStorage.saveUserToken).toHaveBeenCalledWith('test.jwt.token');
    expect(useAuthStore.getState().currentUser?.email).toBe('user@example.com');
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().errorMessage).toBeNull();
  });

  test('login sets error message on API failure', async () => {
    mockedAuthApi.login.mockRejectedValue(new Error('Invalid credentials'));

    const ok = await useAuthStore
      .getState()
      .login({ email: 'bad@example.com', password: 'wrong' });

    expect(ok).toBe(false);
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().errorMessage).toBe('Invalid credentials');
  });

  test('logout clears persisted data and in-memory auth state', async () => {
    useAuthStore.setState({
      currentUser: {
        id: 2,
        email: 'persisted@example.com',
        firstName: 'Test',
        lastName: 'User',
        verificationStatus: 'approved',
      },
      errorMessage: 'some old error',
      verificationReason: 'ok',
      verificationScore: 0.9,
      verificationOcrData: { sample: true },
    });

    await useAuthStore.getState().logout();

    expect(mockedStorage.clearAll).toHaveBeenCalled();
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(useAuthStore.getState().errorMessage).toBeNull();
    expect(useAuthStore.getState().verificationScore).toBeNull();
  });
});
