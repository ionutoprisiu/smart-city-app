import { Validators } from '@shared/utils/validators';

describe('Validators', () => {
  test('email validator accepts a valid email', () => {
    expect(Validators.email('user@example.com')).toBeUndefined();
  });

  test('email validator rejects invalid email', () => {
    expect(Validators.email('invalid-email')).toBe('Enter a valid email');
  });

  test('password validator enforces minimum length', () => {
    expect(Validators.password('123')).toBe('Password must be at least 6 characters');
    expect(Validators.password('123456')).toBeUndefined();
  });

  test('required validator returns field-specific error', () => {
    const requiredName = Validators.required('First name');
    expect(requiredName('')).toBe('First name is required');
    expect(requiredName('Ionut')).toBeUndefined();
  });

  test('phone validator accepts empty and valid phone formats', () => {
    expect(Validators.phone('')).toBeUndefined();
    expect(Validators.phone('+40744111222')).toBeUndefined();
    expect(Validators.phone('07 44 111 222')).toBeUndefined();
    expect(Validators.phone('12-34')).toBe('Enter a valid phone number');
  });
});
