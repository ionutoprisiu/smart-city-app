type Validator = (value: string | undefined | null) => string | undefined;

export const Validators = {
  required:
    (fieldName = 'Câmpul'): Validator =>
    (value) =>
      !value || value.trim().length === 0 ? `${fieldName} este obligatoriu` : undefined,

  email: ((value) => {
    if (!value || value.trim().length === 0) return 'Emailul este obligatoriu';
    const trimmed = value.trim();
    const ok = /^[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(trimmed);
    return ok ? undefined : 'Introdu un email valid';
  }) as Validator,

  password: ((value) => {
    if (!value || value.length === 0) return 'Parola este obligatorie';
    if (value.length < 6) return 'Parola trebuie să aibă minim 6 caractere';
    return undefined;
  }) as Validator,

  phone: ((value) => {
    if (!value || value.trim().length === 0) return undefined;
    const stripped = value.replace(/\s+/g, '');
    if (!/^\+?\d{6,15}$/.test(stripped)) return 'Introdu un număr de telefon valid';
    return undefined;
  }) as Validator,
};
