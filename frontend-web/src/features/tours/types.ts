import { RoutingProfile } from '@features/visit-city/types';

export type TourSummary = {
  id: number;
  title: string;
  description: string | null;
  city: string;
  routingProfile: RoutingProfile;
  createdBy: number;
  attractionCount: number;
  createdAt: string;
};

export type TourAttractionRef = {
  attractionId: number;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  visitDurationMinutes: number;
};

export type TourDetail = TourSummary & {
  attractions: TourAttractionRef[];
};

const asProfile = (v: unknown): RoutingProfile => (v === 'foot' ? 'foot' : 'driving');

export const tourSummaryFromJson = (j: any): TourSummary => ({
  id: Number(j.id),
  title: String(j.title ?? ''),
  description: j.description ?? null,
  city: String(j.city ?? 'Cluj-Napoca'),
  routingProfile: asProfile(j.routingProfile),
  createdBy: Number(j.createdBy ?? 0),
  attractionCount: Number(j.attractionCount ?? 0),
  createdAt: String(j.createdAt ?? ''),
});

export const tourDetailFromJson = (j: any): TourDetail => ({
  ...tourSummaryFromJson(j),
  attractionCount: Array.isArray(j.attractions) ? j.attractions.length : 0,
  attractions: (j.attractions ?? []).map((a: any) => ({
    attractionId: Number(a.attractionId),
    name: String(a.name ?? ''),
    category: String(a.category ?? ''),
    latitude: Number(a.latitude),
    longitude: Number(a.longitude),
    visitDurationMinutes: Number(a.visitDurationMinutes ?? 15),
  })),
});
