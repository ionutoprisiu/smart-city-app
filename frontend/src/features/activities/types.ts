export type ActivityEvent = {
  id: number;
  title: string;
  description?: string | null;
  category: string;
  city: string;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  startsAt: string;
  endsAt: string;
  status: string;
  createdBy: number;
  createdAt: string;
};

export type Club = {
  id: number;
  name: string;
  description?: string | null;
  category: string;
  city: string;
  visibility: string;
  status: string;
  createdBy: number;
  createdAt: string;
  membersCount: number;
  joined: boolean;
  isClubAdmin: boolean;
  /** APPROVED / PENDING when the current user has a membership; null otherwise */
  membershipStatus: string | null;
};

/** Unified listing kind shown in the app (groups = clubs in the API). */
export type ActivityKind = 'event' | 'group';

export type ActivityListing =
  | { kind: 'event'; event: ActivityEvent; sortAt: string }
  | { kind: 'group'; club: Club; sortAt: string };

export type ActivityListFilter = 'all' | 'event' | 'group' | 'mine';

export type ClubMembershipPending = {
  membershipId: number;
  userId: number;
  userEmail: string;
  userFirstName: string;
  userLastName: string;
  role: string;
  status: string;
  joinedAt: string;
};

export type ActivityAnnouncement = {
  id: number;
  title: string;
  body: string;
  eventId: number | null;
  clubId: number | null;
  createdBy: number;
  createdAt: string;
};

export type ActivityChatMessage = {
  id: number;
  eventId: number | null;
  clubId: number | null;
  senderUserId: number;
  role: 'USER' | 'ORGANIZER';
  body: string;
  inReplyToMessageId: number | null;
  isAutoReply: boolean;
  createdAt: string;
};

export type ActivityChatPostResult = {
  message: ActivityChatMessage;
  autoReply: ActivityChatMessage | null;
};

export const eventFromJson = (json: any): ActivityEvent => ({
  id: Number(json?.id ?? 0),
  title: String(json?.title ?? ''),
  description: typeof json?.description === 'string' ? json.description : null,
  category: String(json?.category ?? 'GENERAL'),
  city: String(json?.city ?? ''),
  locationName: typeof json?.locationName === 'string' ? json.locationName : null,
  latitude: typeof json?.latitude === 'number' ? json.latitude : null,
  longitude: typeof json?.longitude === 'number' ? json.longitude : null,
  startsAt: String(json?.startsAt ?? ''),
  endsAt: String(json?.endsAt ?? ''),
  status: String(json?.status ?? ''),
  createdBy: Number(json?.createdBy ?? 0),
  createdAt: String(json?.createdAt ?? ''),
});

export const clubFromJson = (json: any): Club => ({
  id: Number(json?.id ?? 0),
  name: String(json?.name ?? ''),
  description: typeof json?.description === 'string' ? json.description : null,
  category: String(json?.category ?? 'OTHER'),
  city: String(json?.city ?? ''),
  visibility: String(json?.visibility ?? 'PUBLIC'),
  status: String(json?.status ?? 'ACTIVE'),
  createdBy: Number(json?.createdBy ?? 0),
  createdAt: String(json?.createdAt ?? ''),
  membersCount: Number(json?.membersCount ?? 0),
  joined: Boolean(json?.joined),
  isClubAdmin: Boolean(json?.isClubAdmin),
  membershipStatus:
    json?.membershipStatus != null && json?.membershipStatus !== ''
      ? String(json.membershipStatus)
      : null,
});

export const clubMembershipPendingFromJson = (json: any): ClubMembershipPending => ({
  membershipId: Number(json?.membershipId ?? 0),
  userId: Number(json?.userId ?? 0),
  userEmail: String(json?.userEmail ?? ''),
  userFirstName: String(json?.userFirstName ?? ''),
  userLastName: String(json?.userLastName ?? ''),
  role: String(json?.role ?? 'MEMBER'),
  status: String(json?.status ?? 'PENDING'),
  joinedAt: String(json?.joinedAt ?? ''),
});

export const announcementFromJson = (json: any): ActivityAnnouncement => ({
  id: Number(json?.id ?? 0),
  title: String(json?.title ?? ''),
  body: String(json?.body ?? ''),
  eventId: json?.eventId != null ? Number(json.eventId) : null,
  clubId: json?.clubId != null ? Number(json.clubId) : null,
  createdBy: Number(json?.createdBy ?? 0),
  createdAt: String(json?.createdAt ?? ''),
});

export const chatMessageFromJson = (json: any): ActivityChatMessage => ({
  id: Number(json?.id ?? 0),
  eventId: json?.eventId != null ? Number(json.eventId) : null,
  clubId: json?.clubId != null ? Number(json.clubId) : null,
  senderUserId: Number(json?.senderUserId ?? 0),
  role: String(json?.role ?? 'USER').toUpperCase() === 'ORGANIZER' ? 'ORGANIZER' : 'USER',
  body: String(json?.body ?? ''),
  inReplyToMessageId: json?.inReplyToMessageId != null ? Number(json.inReplyToMessageId) : null,
  isAutoReply: Boolean(json?.isAutoReply),
  createdAt: String(json?.createdAt ?? ''),
});

export const chatPostResultFromJson = (json: any): ActivityChatPostResult => ({
  message: chatMessageFromJson(json?.message ?? {}),
  autoReply: json?.autoReply ? chatMessageFromJson(json.autoReply) : null,
});

export const listingKey = (item: ActivityListing): string =>
  item.kind === 'event' ? `event-${item.event.id}` : `group-${item.club.id}`;
