export type Role = 'user' | 'organizer' | 'admin';

export const roleFromString = (value?: string | null): Role | null => {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower === 'user') return 'user';
  if (lower === 'organizer') return 'organizer';
  if (lower === 'admin') return 'admin';
  return null;
};

export const roleDisplay = (role?: Role | null): string => {
  if (role === 'organizer') return 'Organizer';
  if (role === 'admin') return 'Admin';
  return 'User';
};
