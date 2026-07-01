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

const bearingDeg = (from: [number, number], to: [number, number]) => {
  const cosLat = Math.max(0.25, Math.cos((from[0] * Math.PI) / 180));
  const dLat = to[0] - from[0];
  const dLon = (to[1] - from[1]) * cosLat;
  return (Math.atan2(dLon, dLat) * 180) / Math.PI;
};

// Deviation from "straight ahead" between two consecutive headings:
// 0° = no turn, 180° = full reversal (hairpin).
const turnDeg = (a: [number, number], b: [number, number], c: [number, number]) => {
  let diff = Math.abs(bearingDeg(a, b) - bearingDeg(b, c)) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
};

// Cleans a single OSRM leg so screen-pixel polyline offsetting cannot produce
// spiral "coils". Two artifacts cause them: (1) near-duplicate points, whose
// perpendicular direction is unstable, and (2) short hairpin stubs where the
// foot route does an out-and-back to snap a waypoint onto the road. Both are
// removed; genuine road shape (longer turns) is preserved.
export const sanitizeLeg = (
  coords: [number, number][],
  { minMeters = 3, maxSpikeMeters = 18, spikeTurnDeg = 100 } = {},
): [number, number][] => {
  if (coords.length < 3) {
    return coords;
  }

  // 1) Merge near-duplicate points. Unlike dedupeCoords, never append a micro
  //    segment at the end — snap the last kept point to the true endpoint.
  const merged: [number, number][] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const prev = merged[merged.length - 1];
    if (metersBetweenCoords(prev, coords[i]) >= minMeters) {
      merged.push(coords[i]);
    } else if (i === coords.length - 1) {
      merged[merged.length - 1] = coords[i];
    }
  }
  if (merged.length < 3) {
    return merged;
  }

  // 2) Drop short hairpin spikes (vertex where the path nearly reverses over a
  //    tiny stub) — snapping jitter, not a real detour.
  const out: [number, number][] = [merged[0]];
  for (let i = 1; i < merged.length - 1; i++) {
    const a = out[out.length - 1];
    const b = merged[i];
    const c = merged[i + 1];
    const stub = Math.min(metersBetweenCoords(a, b), metersBetweenCoords(b, c));
    if (turnDeg(a, b, c) >= spikeTurnDeg && stub <= maxSpikeMeters) {
      continue;
    }
    out.push(b);
  }
  out.push(merged[merged.length - 1]);
  return out;
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
