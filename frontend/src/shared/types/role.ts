export type Role = 'user' | 'admin';

export const roleFromString = (value?: string | null): Role | null => {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'user') return 'user';
  if (lower === 'admin') return 'admin';
  return null;
};

export const roleDisplay = (role?: Role | null): string => {
  if (role === 'admin') return 'Admin';
  return 'User';
};
