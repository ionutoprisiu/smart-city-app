import {
  authResponseFromJson,
  userFromAuthResponse,
} from '../src/features/auth/types';

describe('auth types mappers', () => {
  test('authResponseFromJson maps backend payload correctly', () => {
    const payload = {
      userId: 42,
      email: 'ionut@example.com',
      role: 'USER',
      firstName: 'Ionut',
      lastName: 'Popescu',
      isVerified: true,
      verificationStatus: 'APPROVED',
      message: 'ok',
    };

    const parsed = authResponseFromJson(payload);
    expect(parsed.userId).toBe(42);
    expect(parsed.email).toBe('ionut@example.com');
    expect(parsed.role).toBe('user');
    expect(parsed.verificationStatus).toBe('approved');
  });

  test('userFromAuthResponse creates user model used by store', () => {
    const user = userFromAuthResponse(
      authResponseFromJson({
        userId: 7,
        email: 'u@test.com',
        role: 'ADMIN',
        firstName: 'Test',
        lastName: 'Admin',
        isVerified: false,
        verificationStatus: 'PENDING',
        message: '',
      }),
    );

    expect(user.id).toBe(7);
    expect(user.role).toBe('admin');
    expect(user.verificationStatus).toBe('pending');
    expect(user.firstName).toBe('Test');
  });
});
