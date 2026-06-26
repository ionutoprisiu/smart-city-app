import type { ActivityEvent, ActivityKind, ActivityListing, ActivityListFilter, Club } from '../types';

export const buildActivityListings = (
  events: ActivityEvent[],
  clubs: Club[],
): ActivityListing[] => {
  const fromEvents: ActivityListing[] = events.map((event) => ({
    kind: 'event' as const,
    event,
    sortAt: event.startsAt || event.createdAt,
  }));
  const fromGroups: ActivityListing[] = clubs.map((club) => ({
    kind: 'group' as const,
    club,
    sortAt: club.createdAt,
  }));
  return [...fromEvents, ...fromGroups].sort(
    (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime(),
  );
};

export const filterActivityListings = (
  items: ActivityListing[],
  filter: ActivityListFilter,
  currentUserId?: number,
): ActivityListing[] => {
  if (filter === 'all') return items;
  if (filter === 'event') return items.filter((x) => x.kind === 'event');
  if (filter === 'group') return items.filter((x) => x.kind === 'group');
  if (currentUserId == null) return [];
  return items.filter((x) => {
    if (x.kind === 'event') {
      return x.event.participating || x.event.isEventOrganizer || x.event.createdBy === currentUserId;
    }
    return x.club.joined || x.club.isClubAdmin || x.club.createdBy === currentUserId;
  });
};

export const activityKindLabel = (kind: ActivityKind): string =>
  kind === 'event' ? 'Event' : 'Group';

export const activityKindIcon = (kind: ActivityKind): string =>
  kind === 'event' ? 'event' : 'groups';
