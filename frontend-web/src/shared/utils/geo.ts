import lineOffset from '@turf/line-offset';
import { lineString } from '@turf/helpers';
import simplify from '@turf/simplify';

export const CLUJ_NAPOCA_CENTER = { latitude: 46.7712, longitude: 23.5898 };

export const ROUTE_START_POINT = {
  latitude: 46.7726428,
  longitude: 23.5852436,
  name: 'UTCN Facultatea de Automatică și Calculatoare',
  address: 'Strada George Barițiu 26-28, 400027 Cluj-Napoca',
} as const;

export type LatLon = { latitude: number; longitude: number };

export const distanceKmBetween = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

const METERS_PER_DEG_LAT = 111_320;

const metersBetweenCoords = (from: [number, number], to: [number, number]) => {
  const cosLat = Math.max(0.25, Math.cos((from[0] * Math.PI) / 180));
  const dLat = (to[0] - from[0]) * METERS_PER_DEG_LAT;
  const dLon = (to[1] - from[1]) * METERS_PER_DEG_LAT * cosLat;
  return Math.hypot(dLat, dLon);
};

export const dedupeCoords = (
  coords: [number, number][],
  minMeters = 0.8,
): [number, number][] => {
  if (coords.length < 2) {
    return coords;
  }

  const out: [number, number][] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const prev = out[out.length - 1];
    const cur = coords[i];
    const isLast = i === coords.length - 1;
    if (isLast || metersBetweenCoords(prev, cur) >= minMeters) {
      out.push(cur);
    }
  }
  return out.length > 1 ? out : coords;
};

export const isRoadSnappedSegment = (coords: [number, number][]) => {
  if (coords.length >= 8) {
    return true;
  }
  if (coords.length < 3) {
    return false;
  }
  let pathMeters = 0;
  for (let i = 1; i < coords.length; i++) {
    pathMeters += metersBetweenCoords(coords[i - 1], coords[i]);
  }
  const straightMeters = metersBetweenCoords(coords[0], coords[coords.length - 1]);
  if (straightMeters < 8) {
    return coords.length >= 4;
  }
  return pathMeters > straightMeters * 1.06;
};

export const offsetRouteSegment = (
  coords: [number, number][],
  offsetMeters: number,
): [number, number][] => {
  if (coords.length < 2 || Math.abs(offsetMeters) < 0.25) {
    return coords;
  }

  const cleaned = dedupeCoords(coords, 1.2);
  if (cleaned.length < 2) {
    return coords;
  }

  const geoLine = lineString(cleaned.map(([lat, lon]) => [lon, lat]));
  const simplified = simplify(geoLine, { tolerance: 0.000004, highQuality: true });

  try {
    const shifted = lineOffset(simplified, offsetMeters / 1000, { units: 'kilometers' });
    return shifted.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]);
  } catch {
    return cleaned;
  }
};

export const splitGeometryBySteps = (
  geometry: LatLon[],
  steps: LatLon[],
): [number, number][][] => {
  if (geometry.length < 2 || steps.length < 2) {
    return [];
  }

  const splitIndices: number[] = [0];
  let searchFrom = 0;
  const minStepPoints = Math.max(2, Math.floor(geometry.length / Math.max(steps.length * 3, 8)));

  for (let s = 1; s < steps.length; s++) {
    let best = searchFrom;
    let bestD = Infinity;
    const minIndex = Math.min(geometry.length - 1, searchFrom + minStepPoints);
    for (let i = minIndex; i < geometry.length; i++) {
      const d = distanceKmBetween(geometry[i], steps[s]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best <= searchFrom) {
      best = Math.min(geometry.length - 1, searchFrom + minStepPoints);
    }
    splitIndices.push(best);
    searchFrom = best;
  }
  splitIndices[splitIndices.length - 1] = geometry.length - 1;

  const slices: [number, number][][] = [];
  for (let i = 0; i < splitIndices.length - 1; i++) {
    const startIdx = splitIndices[i];
    const endIdx = splitIndices[i + 1];
    if (endIdx <= startIdx) {
      continue;
    }
    const slice = geometry
      .slice(startIdx, endIdx + 1)
      .map((p) => [p.latitude, p.longitude] as [number, number]);
    if (slice.length > 1) {
      slices.push(slice);
    }
  }
  return slices;
};
