
export function formatActivityDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function activityStatusLabel(status: string): string {
  const s = status.toUpperCase();
  if (s === 'PUBLISHED') return 'Live';
  if (s === 'CANCELLED') return 'Cancelled';
  if (s === 'DELETED') return 'Removed';
  return status;
}
