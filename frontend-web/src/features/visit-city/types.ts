export type AttractionCategory =
  | 'museum'
  | 'church'
  | 'square'
  | 'monument'
  | 'fortress'
  | 'park'
  | 'restaurant'
  | 'cafe'
  | 'shop'
  | 'theater'
  | 'library'
  | 'hotel'
  | 'other';

export const ATTRACTION_CATEGORIES: AttractionCategory[] = [
  'museum',
  'church',
  'square',
  'monument',
  'fortress',
  'park',
  'restaurant',
  'cafe',
  'shop',
  'theater',
  'library',
  'hotel',
  'other',
];

export const categoryFromString = (value?: string | null): AttractionCategory => {
  if (!value) return 'other';
  const lower = value.toLowerCase();
  return (ATTRACTION_CATEGORIES.find((c) => c === lower) ?? 'other') as AttractionCategory;
};

export const categoryLabel = (category: AttractionCategory): string => {
  switch (category) {
    case 'museum':
      return 'Muzeu';
    case 'church':
      return 'Biserică';
    case 'square':
      return 'Piață';
    case 'monument':
      return 'Monument';
    case 'fortress':
      return 'Cetate';
    case 'park':
      return 'Parc';
    case 'restaurant':
      return 'Restaurant';
    case 'cafe':
      return 'Cafenea';
    case 'shop':
      return 'Magazin';
    case 'theater':
      return 'Teatru';
    case 'library':
      return 'Bibliotecă';
    case 'hotel':
      return 'Hotel';
    case 'other':
    default:
      return 'Altele';
  }
};

export const categoryIcon = (category: AttractionCategory): string => {
  switch (category) {
    case 'museum':
      return '🏛️';
    case 'church':
      return '⛪';
    case 'square':
      return '🏙️';
    case 'monument':
      return '🗿';
    case 'fortress':
      return '🏰';
    case 'park':
      return '🌳';
    case 'restaurant':
      return '🍽️';
    case 'cafe':
      return '☕';
    case 'shop':
      return '🛍️';
    case 'theater':
      return '🎭';
    case 'library':
      return '📚';
    case 'hotel':
      return '🏨';
    case 'other':
    default:
      return '📍';
  }
};

export type Attraction = {
  id: number;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  city: string;
  category: AttractionCategory;
  imageUrl?: string | null;
  importanceScore: number;
  isActive: boolean;
};

export const attractionFromJson = (json: any): Attraction => ({
  id: Number(json?.id ?? 0),
  name: String(json?.name ?? ''),
  description: String(json?.description ?? ''),
  latitude: Number(json?.latitude ?? 0),
  longitude: Number(json?.longitude ?? 0),
  city: String(json?.city ?? ''),
  category: categoryFromString(json?.category?.toString()),
  imageUrl: typeof json?.imageUrl === 'string' ? json.imageUrl : null,
  importanceScore: Number(json?.importanceScore ?? 0),
  isActive: typeof json?.isActive === 'boolean' ? json.isActive : true,
});

export type LatLonPoint = {
  latitude: number;
  longitude: number;
};

export type RouteStep = {
  order: number;
  attractionId: number;
  attractionName: string;
  latitude: number;
  longitude: number;
  distanceToNext: number | null;
  estimatedVisitTime: number | null;
};

export type RoutingProfile = 'driving' | 'foot';

export type RouteResult = {
  steps: RouteStep[];
  totalDistance: number;
  totalTime: number;
  travelTimeMinutes: number;
  visitTimeMinutes: number;
  routeGeometry: LatLonPoint[];
  routeSegments: LatLonPoint[][];
  usedOsrm: boolean;
  routingProfile: RoutingProfile;
  // Orienteering extras: present only when the route was optimized under a
  // time budget (opening a tour with "how much time do you have?").
  collectedScore: number | null;
  skippedAttractionIds: number[];
  timeBudgetMinutes: number | null;
};

const parsePoints = (points: any[]): LatLonPoint[] =>
  points.map((p) => ({
    latitude: Number(p?.latitude ?? 0),
    longitude: Number(p?.longitude ?? 0),
  }));

export const routeStepFromJson = (json: any): RouteStep => ({
  order: Number(json?.order ?? 0),
  attractionId: Number(json?.attractionId ?? 0),
  attractionName: String(json?.attractionName ?? ''),
  latitude: Number(json?.latitude ?? 0),
  longitude: Number(json?.longitude ?? 0),
  distanceToNext:
    typeof json?.distanceToNext === 'number' ? json.distanceToNext : null,
  estimatedVisitTime:
    typeof json?.estimatedVisitTime === 'number' ? json.estimatedVisitTime : null,
});

const asInt = (v: unknown, fallback = 0): number => {
  if (v == null) return fallback;
  if (typeof v === 'number') return Math.round(v);
  const parsed = parseInt(String(v), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const routeResultFromJson = (json: any): RouteResult => {
  const stepsJson: any[] = Array.isArray(json?.steps) ? json.steps : [];
  const geometryJson: any[] = Array.isArray(json?.routeGeometry)
    ? json.routeGeometry
    : Array.isArray(json?.path)
    ? json.path
    : [];
  const segmentsJson: any[] = Array.isArray(json?.routeSegments) ? json.routeSegments : [];

  const totalT = asInt(json?.totalTime);
  const travelT = json?.travelTimeMinutes != null ? asInt(json.travelTimeMinutes) : totalT;
  const profile: RoutingProfile = json?.routingProfile === 'foot' ? 'foot' : 'driving';

  return {
    steps: stepsJson.map(routeStepFromJson),
    totalDistance: Number(json?.totalDistance ?? 0),
    totalTime: totalT,
    travelTimeMinutes: travelT,
    visitTimeMinutes: asInt(json?.visitTimeMinutes),
    routeGeometry: parsePoints(geometryJson),
    routeSegments: segmentsJson.map((seg) =>
      Array.isArray(seg) ? parsePoints(seg) : [],
    ),
    usedOsrm: Boolean(json?.usedOsrm),
    routingProfile: profile,
    collectedScore:
      typeof json?.collectedScore === 'number' ? json.collectedScore : null,
    skippedAttractionIds: Array.isArray(json?.skippedAttractionIds)
      ? json.skippedAttractionIds.map((i: unknown) => Number(i))
      : [],
    timeBudgetMinutes:
      typeof json?.timeBudgetMinutes === 'number' ? json.timeBudgetMinutes : null,
  };
};
