import { Logger } from '../utils/logger';

const cache = new Map<string, string>();
const UNKNOWN = 'Street unavailable';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
/** OSM policy: be conservative; ~1 req/s max from one app. */
const NOMINATIM_MIN_GAP_MS = 2100;

const cacheKey = (lat: number, lon: number) =>
  `${lat.toFixed(5)},${lon.toFixed(5)}`;

const GENERIC_OSM_VALUES = new Set([
  'yes',
  'no',
  'park',
  'house',
  'building',
  'attraction',
  'monument',
]);

let nominatimTail: Promise<unknown> = Promise.resolve();

/** Serialize Nominatim calls and leave a gap after each completes (success or fail). */
const scheduleNominatim = <T>(fn: () => Promise<T>): Promise<T> => {
  const done = nominatimTail.then(() => fn());
  nominatimTail = done.then(
    () => new Promise<void>((r) => setTimeout(r, NOMINATIM_MIN_GAP_MS)),
    () => new Promise<void>((r) => setTimeout(r, NOMINATIM_MIN_GAP_MS)),
  );
  return done;
};

/** One in-flight fetch per coordinate (list remounts / Strict Mode). */
const inflight = new Map<string, Promise<string>>();

const pickFirst = (...vals: unknown[]): string => {
  for (const v of vals) {
    if (typeof v !== 'string') continue;
    const t = v.trim();
    if (t.length === 0) continue;
    const lower = t.toLowerCase();
    if (GENERIC_OSM_VALUES.has(lower)) continue;
    return t;
  }
  return '';
};

const formatFromNominatimJson = (json: any): string => {
  const a = json?.address ?? {};

  const streetLike = pickFirst(
    a.road,
    a.pedestrian,
    a.path,
    a.footway,
    a.cycleway,
    a.residential,
    a.neighborhood,
    a.neighbourhood,
    a.suburb,
    a.quarter,
    a.city_district,
    a.hamlet,
    a.village,
    a.town,
  );

  if (streetLike.length > 0) return streetLike;

  const namedLanduse = pickFirst(
    a.leisure,
    a.tourism,
    a.amenity,
    a.historic,
    a.shop,
    a.man_made,
  );
  if (namedLanduse.length > 0) {
    const pretty = namedLanduse.replace(/_/g, ' ');
    const city = pickFirst(a.city, a.town, a.village, a.municipality);
    return city.length > 0 ? `${pretty}, ${city}` : pretty;
  }

  const area = pickFirst(
    a.suburb,
    a.neighbourhood,
    a.quarter,
    a.city,
    a.town,
    a.village,
    a.municipality,
    a.county,
  );
  if (area.length > 0) return area;

  if (typeof json?.name === 'string' && json.name.trim().length > 0) {
    const city = pickFirst(a.city, a.town, a.village);
    return city.length > 0 ? `${json.name.trim()}, ${city}` : json.name.trim();
  }

  const dn = json?.display_name;
  if (typeof dn === 'string' && dn.length > 3) {
    const bits = dn
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (bits.length >= 2) {
      return `${bits[0]}, ${bits[1]}`;
    }
    if (bits.length === 1) return bits[0];
  }

  return UNKNOWN;
};

const resolveWithFallback = (raw: string, fallback?: string): string => {
  if (raw !== UNKNOWN) return raw;
  if (fallback != null && fallback.trim().length > 0) return fallback.trim();
  return UNKNOWN;
};

function retryAfterSeconds(response: Response, attempt: number): number {
  const ra = response.headers.get('Retry-After');
  if (ra != null) {
    const n = parseInt(ra, 10);
    if (Number.isFinite(n) && n > 0) {
      return Math.min(45, Math.max(2, n));
    }
  }
  return Math.min(30, 2 + attempt * 3);
}

async function doNominatimFetch(latitude: number, longitude: number): Promise<any> {
  const url = `${NOMINATIM_URL}?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&zoom=18`;

  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'ro,en;q=0.9',
        'User-Agent': 'SmartCityVisitCity/1.0 (iOS; contact: student-project)',
      },
    });

    if (response.status === 429) {
      const waitSec = retryAfterSeconds(response, attempt);
      if (__DEV__) {
        Logger.warning(`Nominatim 429, retry in ${waitSec}s (attempt ${attempt + 1})`);
      }
      await new Promise<void>((r) => setTimeout(r, waitSec * 1000));
      continue;
    }

    if (!response.ok) {
      throw new Error(`nominatim_${response.status}`);
    }
    return response.json();
  }

  throw new Error('nominatim_429');
}

export const AddressService = {
  /**
   * Human-readable place / street line from coordinates (Nominatim reverse).
   * @param fallback Shown if geocoder fails or returns nothing (e.g. `attraction.city`).
   */
  async streetFromCoordinates(
    latitude: number,
    longitude: number,
    fallback?: string,
  ): Promise<string> {
    const key = cacheKey(latitude, longitude);
    const cached = cache.get(key);
    if (cached != null) return resolveWithFallback(cached, fallback);

    let job = inflight.get(key);
    if (job == null) {
      job = (async () => {
        try {
          const row = await scheduleNominatim(() => doNominatimFetch(latitude, longitude));
          const line = formatFromNominatimJson(row);
          cache.set(key, line);
          return line;
        } catch (e) {
          if (__DEV__) {
            Logger.warning('AddressService failed', e);
          }
          return UNKNOWN;
        } finally {
          inflight.delete(key);
        }
      })();
      inflight.set(key, job);
    }

    const line = await job;
    return resolveWithFallback(line, fallback);
  },
};
