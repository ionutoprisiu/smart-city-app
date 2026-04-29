type Validator = (value: string | undefined | null) => string | undefined;

export const Validators = {
  required:
    (fieldName = 'This field'): Validator =>
    (value) =>
      !value || value.trim().length === 0 ? `${fieldName} is required` : undefined,

  email: ((value) => {
    if (!value || value.trim().length === 0) return 'Email is required';
    const trimmed = value.trim();
    const ok = /^[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(trimmed);
    return ok ? undefined : 'Enter a valid email';
  }) as Validator,

  password: ((value) => {
    if (!value || value.length === 0) return 'Password is required';
    if (value.length < 6) return 'Password must be at least 6 characters';
    return undefined;
  }) as Validator,

  phone: ((value) => {
    if (!value || value.trim().length === 0) return undefined;
    const stripped = value.replace(/\s+/g, '');
    if (!/^\+?\d{6,15}$/.test(stripped)) return 'Enter a valid phone number';
    return undefined;
  }) as Validator,
};
