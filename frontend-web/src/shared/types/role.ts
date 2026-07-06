export type Role = 'user' | 'guide' | 'admin';

export const roleFromString = (value?: string | null): Role | null => {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'user') return 'user';
  if (lower === 'guide') return 'guide';
  if (lower === 'admin') return 'admin';
  return null;
};

export const roleDisplay = (role?: Role | null): string => {
  if (role === 'guide') return 'Ghid';
  if (role === 'admin') return 'Admin';
  return 'Utilizator';
};
