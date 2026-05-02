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
});
