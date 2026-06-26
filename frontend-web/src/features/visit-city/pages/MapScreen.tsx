import L from 'leaflet';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { AppButton } from '@shared/components/AppButton';
import { BottomSheet } from '@shared/components/BottomSheet';
import { Icon } from '@shared/components/Icon';
import { CustomPinsBanner } from '../components/CustomPinsBanner';
import { MapControlsCard } from '../components/MapControlsCard';
import { RouteInfoCard } from '../components/RouteInfoCard';
import { RouteStartBar } from '../components/RouteStartBar';
import { RouteStepsList } from '../components/RouteStepsList';
import { SelectionDock } from '../components/SelectionDock';
import { useVisitCityStore } from '../store/visitCityStore';
import { ROUTE_START_POINT, dedupeCoords, distanceKmBetween, offsetRouteSegment, splitGeometryBySteps } from '@shared/utils/geo';
import { ROUTE_SEGMENT_COLORS } from '../constants/routeColors';
import {
  Attraction,
  RouteResult,
  RoutingProfile,
  categoryIcon,
  categoryLabel,
} from '../types';

const CLUJ_CENTER: [number, number] = [46.7712, 23.5898];
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
const INITIAL_ZOOM = 14;

const CATEGORY_COLORS: Record<Attraction['category'], string> = {
  museum: '#5C6BC0',
  church: '#8D6E63',
  square: '#546E7A',
  monument: '#6D4C41',
  fortress: '#7B1FA2',
  park: '#2E7D32',
  restaurant: '#EF6C00',
  cafe: '#6D4C41',
  shop: '#00897B',
  theater: '#3949AB',
  library: '#455A64',
  hotel: '#5D4037',
  other: '#616161',
};

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const INITIAL_REGION: Region = {
  latitude: CLUJ_CENTER[0],
  longitude: CLUJ_CENTER[1],
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

type RoutePolylineLayer = {
  id: string;
  coords: [number, number][];
  color: string;
  weight: number;
  opacity: number;
  kind: 'casing' | 'segment';
};

const toCoords = (points: { latitude: number; longitude: number }[]) =>
  points.map((p) => [p.latitude, p.longitude] as [number, number]);

// Perpendicular separation between two parallel lanes. A few pixels at the
// current zoom, tightly clamped so a lane can never wander off the roadway.
const laneSpacingMeters = (region: Region) => {
  const metersPerPixel = (region.latitudeDelta * 111_320) / 720;
  return Math.max(3.5, Math.min(7, metersPerPixel * 3));
};

const LANE_KEY_DECIMALS = 5;
const MAX_LANE_OFFSET_METERS = 8;

// Assigns each leg a lane number. Legs that share road geometry with other legs
// are fanned out into distinct, symmetric lanes (…-1, 0, +1…); a leg that runs
// on a unique road keeps lane 0 and is drawn straight on the street.
const assignLaneOffsets = (segments: [number, number][][]): number[] => {
  const pointKey = (p: [number, number]) =>
    `${p[0].toFixed(LANE_KEY_DECIMALS)},${p[1].toFixed(LANE_KEY_DECIMALS)}`;
  const edgeKey = (a: [number, number], b: [number, number]) => {
    const ka = pointKey(a);
    const kb = pointKey(b);
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };

  // Which legs traverse each (direction-agnostic) road edge.
  const edgeToLegs = new Map<string, Set<number>>();
  segments.forEach((coords, leg) => {
    for (let i = 1; i < coords.length; i++) {
      const key = edgeKey(coords[i - 1], coords[i]);
      const legs = edgeToLegs.get(key);
      if (legs == null) edgeToLegs.set(key, new Set([leg]));
      else legs.add(leg);
    }
  });

  // Link any two legs that share at least one edge.
  const neighbours: Set<number>[] = segments.map(() => new Set<number>());
  edgeToLegs.forEach((legs) => {
    if (legs.size < 2) return;
    const list = [...legs];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        neighbours[list[i]].add(list[j]);
        neighbours[list[j]].add(list[i]);
      }
    }
  });

  // Fan out each connected group of overlapping legs around the shared street.
  const lanes = new Array<number>(segments.length).fill(0);
  const seen = new Array<boolean>(segments.length).fill(false);
  for (let start = 0; start < segments.length; start++) {
    if (seen[start]) continue;
    const group: number[] = [];
    const queue = [start];
    seen[start] = true;
    while (queue.length > 0) {
      const current = queue.shift() as number;
      group.push(current);
      neighbours[current].forEach((nb) => {
        if (!seen[nb]) {
          seen[nb] = true;
          queue.push(nb);
        }
      });
    }
    if (group.length <= 1) continue;
    group.sort((a, b) => a - b);
    group.forEach((leg, index) => {
      lanes[leg] = index - (group.length - 1) / 2;
    });
  }
  return lanes;
};

const buildRoutePolylines = (result: RouteResult | null, region: Region): RoutePolylineLayer[] => {
  if (result == null) {
    return [];
  }

  const baseCoords =
    result.routeGeometry.length > 1 ? dedupeCoords(toCoords(result.routeGeometry)) : [];

  if (baseCoords.length < 2) {
    return [];
  }

  const expectedLegs = Math.max(0, result.steps.length - 1);

  // The backend already returns one road-snapped polyline per leg (one OSRM leg
  // per consecutive waypoint pair). Prefer those. Only re-split the merged
  // geometry ourselves when they are missing or degenerate.
  const fromApi = result.routeSegments
    .map((seg) => dedupeCoords(toCoords(seg)))
    .filter((coords) => coords.length > 1);

  let segmentCoords: [number, number][][];
  if (expectedLegs > 0 && fromApi.length === expectedLegs) {
    segmentCoords = fromApi;
  } else if (expectedLegs > 0) {
    segmentCoords = splitGeometryBySteps(result.routeGeometry, result.steps)
      .map((coords) => dedupeCoords(coords))
      .filter((coords) => coords.length > 1);
  } else {
    segmentCoords = [];
  }

  if (segmentCoords.length <= 1) {
    return [
      {
        id: 'route',
        coords: segmentCoords[0] ?? baseCoords,
        color: ROUTE_SEGMENT_COLORS[0],
        weight: 6,
        opacity: 1,
        kind: 'segment',
      },
    ];
  }

  // Separate only the legs that actually share a street, so overlapping
  // tronsons never hide each other while unique legs stay on the road.
  const lanes = assignLaneOffsets(segmentCoords);
  const spacing = laneSpacingMeters(region);

  // All white casings go underneath every colored segment, so where two legs
  // share a street the casing never paints over a neighbouring leg's color.
  const casingLayers: RoutePolylineLayer[] = [];
  const segmentLayers: RoutePolylineLayer[] = [];

  segmentCoords.forEach((coords, i) => {
    const offsetMeters = Math.max(
      -MAX_LANE_OFFSET_METERS,
      Math.min(MAX_LANE_OFFSET_METERS, lanes[i] * spacing),
    );
    const drawn =
      Math.abs(offsetMeters) > 0.25 ? offsetRouteSegment(coords, offsetMeters) : coords;

    casingLayers.push({
      id: `seg-casing-${i}`,
      coords: drawn,
      color: '#ffffff',
      weight: 7,
      opacity: 1,
      kind: 'casing',
    });
    segmentLayers.push({
      id: `seg-${i}`,
      coords: drawn,
      color: ROUTE_SEGMENT_COLORS[i % ROUTE_SEGMENT_COLORS.length],
      weight: 4,
      opacity: 1,
      kind: 'segment',
    });
  });

  return [...casingLayers, ...segmentLayers];
};

const polylineStrokeWidth = (layer: RoutePolylineLayer, profile: RoutingProfile) => {
  if (layer.kind === 'casing') {
    return layer.weight;
  }
  return profile === 'foot' ? layer.weight : layer.weight + 1;
};

type DisplayMarker =
  | {
      kind: 'single';
      attraction: Attraction;
      selected: boolean;
      order?: number;
    }
  | {
      kind: 'cluster';
      id: string;
      latitude: number;
      longitude: number;
      count: number;
      category: Attraction['category'];
      attractionIds: number[];
    };

const clusterCellForRegion = (region: Region, foot: boolean) => {
  const d = region.latitudeDelta;
  let cellLat: number;
  if (d >= 0.14) cellLat = 0.022;
  else if (d >= 0.1) cellLat = 0.016;
  else if (d >= 0.07) cellLat = 0.011;
  else if (d >= 0.05) cellLat = 0.008;
  else if (d >= 0.035) cellLat = 0.0055;
  else if (d >= 0.025) cellLat = 0.0038;
  else if (d >= 0.018) cellLat = 0.0026;
  else if (d >= 0.012) cellLat = 0.0017;
  else if (d >= 0.008) cellLat = 0.0011;
  else if (d >= 0.005) cellLat = 0.0007;
  else cellLat = 0.00045;

  const cosLat = Math.max(0.35, Math.cos((region.latitude * Math.PI) / 180));
  const base = { lat: cellLat, lon: cellLat / cosLat };
  if (!foot) return base;
  const g = 1.55;
  return { lat: base.lat * g, lon: base.lon * g };
};

const VIEWPORT_PAD = 0.5;

const attractionInViewport = (a: Attraction, region: Region) => {
  const halfLat = (region.latitudeDelta / 2) * (1 + VIEWPORT_PAD);
  const halfLon = (region.longitudeDelta / 2) * (1 + VIEWPORT_PAD);
  return (
    a.latitude >= region.latitude - halfLat &&
    a.latitude <= region.latitude + halfLat &&
    a.longitude >= region.longitude - halfLon &&
    a.longitude <= region.longitude + halfLon
  );
};

const MAX_MAP_MARKERS = 140;

const buildClusteredMarkers = (
  items: Attraction[],
  orderMap: Record<number, number>,
  selectedSet: Set<number>,
  cell: { lat: number; lon: number },
): DisplayMarker[] => {
  const clustered = new Map<string, { items: Attraction[]; sumLat: number; sumLon: number }>();
  const singles: DisplayMarker[] = [];

  for (const a of items) {
    const order = orderMap[a.id];
    const selected = selectedSet.has(a.id);
    if (selected || order != null) {
      singles.push({ kind: 'single', attraction: a, selected, order });
      continue;
    }

    const key = `${Math.floor(a.latitude / cell.lat)}:${Math.floor(a.longitude / cell.lon)}`;
    const current = clustered.get(key);
    if (current == null) {
      clustered.set(key, { items: [a], sumLat: a.latitude, sumLon: a.longitude });
    } else {
      current.items.push(a);
      current.sumLat += a.latitude;
      current.sumLon += a.longitude;
    }
  }

  const grouped: DisplayMarker[] = [];
  clustered.forEach((group, key) => {
    if (group.items.length === 1) {
      const one = group.items[0];
      grouped.push({ kind: 'single', attraction: one, selected: false, order: orderMap[one.id] });
      return;
    }
    grouped.push({
      kind: 'cluster',
      id: key,
      latitude: group.sumLat / group.items.length,
      longitude: group.sumLon / group.items.length,
      count: group.items.length,
      category: group.items[0].category,
      attractionIds: group.items.map((item) => item.id),
    });
  });

  return [...grouped, ...singles];
};

const MARKER_DIAMETER_PX = 44;
const VIEWPORT_HEIGHT_PX = 720;

const metersPerPixel = (region: Region) =>
  (region.latitudeDelta * 111_320) / VIEWPORT_HEIGHT_PX;

const proximityGroupMeters = (region: Region) =>
  Math.max(22, metersPerPixel(region) * MARKER_DIAMETER_PX * 0.92);

const spreadRadiusMeters = (count: number, region: Region, foot: boolean) => {
  const minGap = Math.max(foot ? 20 : 16, metersPerPixel(region) * (MARKER_DIAMETER_PX + 8));
  if (count <= 1) return 0;
  const sinHalf = Math.sin(Math.PI / count);
  const fromChord = sinHalf > 0 ? minGap / (2 * sinHalf) : minGap;
  const fromZoom = region.latitudeDelta * (foot ? 1400 : 1000);
  return Math.max(fromChord, Math.min(foot ? 58 : 42, fromZoom));
};

const groupNearbySingles = (
  markers: Extract<DisplayMarker, { kind: 'single' }>[],
  thresholdMeters: number,
) => {
  const groups: Extract<DisplayMarker, { kind: 'single' }>[][] = [];

  for (const marker of markers) {
    const pos = marker.attraction;
    let placed = false;
    for (const group of groups) {
      const anchor = group[0].attraction;
      if (distanceKmBetween(pos, anchor) * 1000 <= thresholdMeters) {
        group.push(marker);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([marker]);
  }

  return groups;
};

const spreadOverlappingMarkers = (
  markers: DisplayMarker[],
  region: Region,
  foot: boolean,
  orderMap: Record<number, number>,
) => {
  const degLatPerMeter = 1 / 111_320;
  const cosLat = Math.max(0.25, Math.cos((region.latitude * Math.PI) / 180));
  const degLonPerMeter = 1 / (111_320 * cosLat);
  const threshold = proximityGroupMeters(region);

  const singleMarkers = markers.filter(
    (marker): marker is Extract<DisplayMarker, { kind: 'single' }> => marker.kind === 'single',
  );

  const shifted = new Map<number, { latitude: number; longitude: number }>();

  groupNearbySingles(singleMarkers, threshold).forEach((group) => {
    if (group.length <= 1) return;

    const sorted = [...group].sort((a, b) => {
      const ao = orderMap[a.attraction.id];
      const bo = orderMap[b.attraction.id];
      if (ao != null && bo != null) return ao - bo;
      if (ao != null) return -1;
      if (bo != null) return 1;
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      return a.attraction.name.localeCompare(b.attraction.name);
    });

    const centroidLat =
      sorted.reduce((sum, m) => sum + m.attraction.latitude, 0) / sorted.length;
    const centroidLon =
      sorted.reduce((sum, m) => sum + m.attraction.longitude, 0) / sorted.length;
    const radius = spreadRadiusMeters(sorted.length, region, foot);
    const step = (2 * Math.PI) / sorted.length;
    const startAngle = -Math.PI / 2;

    sorted.forEach((marker, index) => {
      const angle = startAngle + index * step;
      shifted.set(marker.attraction.id, {
        latitude: centroidLat + Math.sin(angle) * radius * degLatPerMeter,
        longitude: centroidLon + Math.cos(angle) * radius * degLonPerMeter,
      });
    });
  });

  return shifted;
};

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const singleMarkerIcon = (a: Attraction, selected: boolean, order: number | undefined, dim: boolean) => {
  const background =
    order != null || selected ? 'var(--primary)' : `${CATEGORY_COLORS[a.category]}CC`;
  const borderWidth = selected || order != null ? 3 : 2;
  const opacity = dim ? 0.74 : 1;
  const inner =
    order != null
      ? `<span style="color:var(--on-primary);font-weight:700;font-size:14px;">${order}</span>`
      : selected
        ? '<span class="material-icons-round" style="font-size:22px;color:var(--on-primary);">check</span>'
        : `<span style="font-size:18px;">${categoryIcon(a.category)}</span>`;
  return L.divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `<div style="width:44px;height:44px;border-radius:22px;display:flex;align-items:center;justify-content:center;background:${background};border:${borderWidth}px solid #FFFFFF;opacity:${opacity};box-shadow:0 1px 4px rgba(0,0,0,0.3);">${inner}</div>`,
  });
};

const clusterMarkerIcon = (count: number, category: Attraction['category']) =>
  L.divIcon({
    className: '',
    iconSize: [52, 52],
    iconAnchor: [26, 26],
    html: `<div style="min-width:52px;height:52px;border-radius:26px;border:3px solid #FFFFFF;background:#2A2D36F0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 8px;box-shadow:0 1px 4px rgba(0,0,0,0.3);"><span style="color:#FFFFFF;font-weight:700;font-size:13px;line-height:15px;">${count}</span><span style="font-size:14px;line-height:16px;">${categoryIcon(category)}</span></div>`,
  });

const customPinIcon = () =>
  L.divIcon({
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: '<div style="width:44px;height:44px;border-radius:22px;border:3px solid #FFFFFF;background:var(--error);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.3);"><span class="material-icons-round" style="font-size:20px;color:#FFFFFF;">push_pin</span></div>',
  });

const routeStartIcon = () =>
  L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: '<div style="width:36px;height:36px;border-radius:18px;border:3px solid #FFFFFF;background:#1A73E8;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.35);pointer-events:none;"><span class="material-icons-round" style="font-size:20px;color:#FFFFFF;">school</span></div>',
  });

const regionFromMap = (map: L.Map): Region => {
  const bounds = map.getBounds();
  const center = bounds.getCenter();
  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: Math.abs(bounds.getNorth() - bounds.getSouth()),
    longitudeDelta: Math.abs(bounds.getEast() - bounds.getWest()),
  };
};

const MapEvents: React.FC<{
  onRegionChange: (region: Region) => void;
  onLongPress: (lat: number, lon: number) => void;
}> = ({ onRegionChange, onLongPress }) => {
  const map = useMapEvents({
    moveend: () => onRegionChange(regionFromMap(map)),
    zoomend: () => onRegionChange(regionFromMap(map)),
    contextmenu: (e) => {
      onLongPress(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    onRegionChange(regionFromMap(map));
  }, [map, onRegionChange]);

  return null;
};

const MapRefBinder: React.FC<{ mapRef: React.MutableRefObject<L.Map | null> }> = ({ mapRef }) => {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
};

export const MapScreen: React.FC = () => {
  const {
    attractions,
    customPins,
    selectedIds,
    selectedCount,
    routeResult,
    routeStarted,
    isOptimizing,
    routingProfile,
    canOptimize,
    isSelected,
    setRoutingProfile,
    optimizeRoute,
    clearSelection,
    clearRoute,
    startRoute,
    stopRoute,
    toggleSelection,
    addCustomPin,
    removeCustomPin,
  } = useVisitCityStore();

  const mapRef = useRef<L.Map | null>(null);
  const didFitRoute = useRef(false);
  const lastMarkerTapRef = useRef<{ id: number; ts: number } | null>(null);
  const [details, setDetails] = useState<Attraction | null>(null);
  const [pinOptions, setPinOptions] = useState<Attraction | null>(null);
  const [clusterPicker, setClusterPicker] = useState<Extract<
    DisplayMarker,
    { kind: 'cluster' }
  > | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>(INITIAL_REGION);

  useEffect(() => {
    if (routeResult == null) {
      didFitRoute.current = false;
      return;
    }
    if (routeStarted && !didFitRoute.current) {
      didFitRoute.current = true;
      const points = routeResult.routeGeometry;
      if (points.length > 0 && mapRef.current != null) {
        const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]));
        mapRef.current.fitBounds(bounds, { padding: [60, 60] });
      }
    } else if (!routeStarted) {
      didFitRoute.current = false;
    }
  }, [routeResult, routeStarted]);

  const handleRecenter = () => {
    mapRef.current?.flyTo(
      [ROUTE_START_POINT.latitude, ROUTE_START_POINT.longitude],
      15,
      { duration: 0.4 },
    );
  };

  const mapRoutingProfile: RoutingProfile = routeResult?.routingProfile ?? routingProfile;
  const footOnMap = mapRoutingProfile === 'foot';

  const polylines = useMemo(
    () => buildRoutePolylines(routeResult, mapRegion),
    [routeResult, mapRegion],
  );

  const orderMap = useMemo(() => {
    const next: Record<number, number> = {};
    if (routeResult != null) {
      routeResult.steps.forEach((step) => {
        if (step.attractionId > 0) next[step.attractionId] = step.order;
      });
    }
    return next;
  }, [routeResult]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visibleAttractions = useMemo(() => {
    if (routeResult != null) {
      return attractions.filter((a) => orderMap[a.id] != null);
    }
    return attractions;
  }, [attractions, orderMap, routeResult]);

  const viewportAttractions = useMemo(
    () => visibleAttractions.filter((a) => attractionInViewport(a, mapRegion)),
    [visibleAttractions, mapRegion],
  );

  const displayMarkers = useMemo<DisplayMarker[]>(() => {
    let cell = clusterCellForRegion(mapRegion, footOnMap);
    const cap = footOnMap ? 95 : MAX_MAP_MARKERS;
    let markers = buildClusteredMarkers(viewportAttractions, orderMap, selectedSet, cell);

    let guard = 0;
    while (markers.length > cap && guard < 8) {
      cell = { lat: cell.lat * 1.35, lon: cell.lon * 1.35 };
      markers = buildClusteredMarkers(viewportAttractions, orderMap, selectedSet, cell);
      guard += 1;
    }

    return markers;
  }, [viewportAttractions, mapRegion, orderMap, selectedSet, footOnMap]);

  const shiftedMarkerCoords = useMemo(
    () => spreadOverlappingMarkers(displayMarkers, mapRegion, footOnMap, orderMap),
    [displayMarkers, mapRegion, footOnMap, orderMap],
  );

  const attractionById = useMemo(() => {
    const next = new Map<number, Attraction>();
    attractions.forEach((a) => next.set(a.id, a));
    return next;
  }, [attractions]);

  const clusterAttractions = useMemo(() => {
    if (clusterPicker == null) return [] as Attraction[];
    return clusterPicker.attractionIds
      .map((id) => attractionById.get(id))
      .filter((value): value is Attraction => value != null)
      .sort((a, b) => {
        const aSelected = selectedSet.has(a.id);
        const bSelected = selectedSet.has(b.id);
        if (aSelected !== bSelected) return aSelected ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [clusterPicker, attractionById, selectedSet]);

  const handleAttractionMarkerPress = (attraction: Attraction) => {
    if (routeResult != null || routeStarted) {
      setDetails(attraction);
      return;
    }

    const now = Date.now();
    const last = lastMarkerTapRef.current;
    if (last != null && last.id === attraction.id && now - last.ts < 330) {
      lastMarkerTapRef.current = null;
      setDetails(attraction);
      return;
    }

    lastMarkerTapRef.current = { id: attraction.id, ts: now };
    toggleSelection(attraction.id);
  };

  const handleClusterPress = (marker: Extract<DisplayMarker, { kind: 'cluster' }>) => {
    if (marker.count <= 12 && mapRegion.latitudeDelta <= 0.02) {
      setClusterPicker(marker);
      return;
    }
    const map = mapRef.current;
    if (map == null) return;
    const targetZoom = Math.min(
      18,
      map.getZoom() + (marker.count > 80 ? 2 : marker.count > 40 ? 1.5 : 1),
    );
    map.flyTo([marker.latitude, marker.longitude], targetZoom, { duration: 0.35 });
  };

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
      <MapContainer
        center={CLUJ_CENTER}
        zoom={INITIAL_ZOOM}
        style={{ position: 'absolute', inset: 0 }}
        zoomControl={false}
        attributionControl={false}
      >
        <MapRefBinder mapRef={mapRef} />
        <MapEvents onRegionChange={setMapRegion} onLongPress={addCustomPin} />
        <TileLayer url={TILE_URL} maxZoom={19} />

        {polylines.map((line) => (
          <Polyline
            key={line.id}
            positions={line.coords}
            pathOptions={{
              color: line.color,
              weight: polylineStrokeWidth(line, mapRoutingProfile),
              opacity: line.opacity,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        ))}

        {displayMarkers.map((marker) => {
          if (marker.kind === 'cluster') {
            return (
              <Marker
                key={`cluster-${marker.id}`}
                position={[marker.latitude, marker.longitude]}
                icon={clusterMarkerIcon(marker.count, marker.category)}
                eventHandlers={{ click: () => handleClusterPress(marker) }}
              />
            );
          }

          const { attraction: a, order, selected } = marker;
          const shifted = shiftedMarkerCoords.get(a.id);
          const dim = selectedSet.size > 0 && !selected && order == null;
          return (
            <Marker
              key={`${a.id}-${selected ? 'sel' : 'off'}-${order ?? 'x'}`}
              position={
                shifted != null
                  ? [shifted.latitude, shifted.longitude]
                  : [a.latitude, a.longitude]
              }
              icon={singleMarkerIcon(a, selected, order, dim)}
              eventHandlers={{ click: () => handleAttractionMarkerPress(a) }}
            />
          );
        })}

        {!routeStarted &&
          customPins.map((pin) => (
            <Marker
              key={pin.id}
              position={[pin.latitude, pin.longitude]}
              icon={customPinIcon()}
              eventHandlers={{ click: () => setPinOptions(pin) }}
            />
          ))}

        <Marker
          position={[ROUTE_START_POINT.latitude, ROUTE_START_POINT.longitude]}
          icon={routeStartIcon()}
          interactive={false}
        />
      </MapContainer>

      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000 }}>
        <MapControlsCard
          hasRoute={routeResult != null}
          routeStarted={routeStarted}
          onRecenter={handleRecenter}
          onModify={stopRoute}
          onClear={clearRoute}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 14,
          zIndex: 1000,
          maxWidth: 680,
          margin: '0 auto',
        }}
      >
        {!routeStarted && routeResult == null && selectedCount() > 0 ? (
          <div style={{ marginBottom: 10 }}>
            <SelectionDock
              count={selectedCount()}
              profile={routingProfile}
              isOptimizing={isOptimizing}
              canOptimize={canOptimize()}
              onProfileChanged={(p) => setRoutingProfile(p)}
              onOptimize={canOptimize() ? optimizeRoute : undefined}
              onClear={clearSelection}
            />
          </div>
        ) : null}

        {routeResult != null && !routeStarted ? (
          <div>
            <RouteInfoCard result={routeResult} layout="dock" />
            <div style={{ marginBottom: 12 }}>
              <RouteStartBar onStart={startRoute} onModify={clearRoute} />
            </div>
          </div>
        ) : null}

        {routeResult != null && routeStarted ? (
          <RouteStepsList result={routeResult} compact />
        ) : null}

        {routeResult == null && selectedCount() === 0 && customPins.length > 0 ? (
          <CustomPinsBanner
            count={customPins.length}
            onClearAll={() => {
              customPins.forEach((p) => removeCustomPin(p.id));
            }}
          />
        ) : null}
      </div>

      <BottomSheet open={clusterPicker != null} onClose={() => setClusterPicker(null)}>
        {clusterPicker != null ? (
          <div style={{ padding: '8px 20px 28px' }}>
            <div className="title-large">{clusterPicker.count} places in this area</div>
            <div className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 4 }}>
              Tap to quickly add/remove attractions from route.
            </div>
            <div style={{ height: 16 }} />
            <div
              style={{
                maxHeight: 360,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 12,
              }}
            >
              {clusterAttractions.slice(0, 14).map((item) => {
                const selected = isSelected(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleSelection(item.id)}
                    style={{
                      borderRadius: 14,
                      border: '1px solid color-mix(in srgb, var(--outline-variant) 36%, transparent)',
                      background: 'color-mix(in srgb, var(--surface) 65%, transparent)',
                      padding: '10px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 20, marginRight: 10 }}>
                      {categoryIcon(item.category)}
                    </span>
                    <span style={{ flex: 1, marginRight: 10, minWidth: 0 }}>
                      <span
                        className="label-large"
                        style={{
                          display: 'block',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {escapeHtml(item.name)}
                      </span>
                      <span
                        className="label-small"
                        style={{ color: 'var(--on-surface-variant)', display: 'block', marginTop: 2 }}
                      >
                        {categoryLabel(item.category)}
                      </span>
                    </span>
                    <Icon
                      name={selected ? 'check-circle' : 'add-circle-outline'}
                      size={22}
                      color={selected ? 'var(--primary)' : 'var(--on-surface-variant)'}
                    />
                  </button>
                );
              })}
            </div>
            {clusterAttractions.length > 14 ? (
              <div className="label-small" style={{ color: 'var(--on-surface-variant)' }}>
                Zoom in to select from the full cluster ({clusterAttractions.length} total).
              </div>
            ) : null}
            <div style={{ height: 16 }} />
            <AppButton
              label="Close"
              variant="outlined"
              iconName="close"
              onPress={() => setClusterPicker(null)}
            />
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet open={details != null} onClose={() => setDetails(null)}>
        {details ? (
          <div style={{ padding: '8px 20px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <span style={{ fontSize: 28, marginRight: 12 }}>{categoryIcon(details.category)}</span>
              <span className="title-large" style={{ flex: 1 }}>{details.name}</span>
            </div>
            <div className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 8 }}>
              {categoryLabel(details.category)}
            </div>
            <div className="body-large" style={{ marginTop: 12 }}>{details.description}</div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 16 }}>
              <Icon name="location-on" size={16} color="var(--primary)" />
              <span className="body-medium" style={{ marginLeft: 6 }}>
                {details.latitude.toFixed(4)}, {details.longitude.toFixed(4)}
              </span>
            </div>
            <div style={{ height: 16 }} />
            <AppButton
              label={isSelected(details.id) ? 'Remove from route' : 'Add to route'}
              variant={isSelected(details.id) ? 'destructive' : 'filled'}
              iconName={isSelected(details.id) ? 'remove-circle-outline' : 'add-circle-outline'}
              onPress={() => {
                toggleSelection(details.id);
                setDetails(null);
              }}
            />
          </div>
        ) : null}
      </BottomSheet>

      <BottomSheet open={pinOptions != null} onClose={() => setPinOptions(null)}>
        {pinOptions ? (
          <div style={{ padding: '8px 20px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Icon name="push-pin" size={28} />
              <span className="title-large" style={{ marginLeft: 12, flex: 1 }}>
                {pinOptions.name}
              </span>
            </div>
            <div className="body-medium" style={{ color: 'var(--on-surface-variant)', marginTop: 8 }}>
              {pinOptions.latitude.toFixed(5)}, {pinOptions.longitude.toFixed(5)}
            </div>
            <div style={{ height: 20 }} />
            <AppButton
              label="Remove Pin"
              variant="outlined"
              iconName="delete-outline"
              onPress={() => {
                removeCustomPin(pinOptions.id);
                setPinOptions(null);
              }}
            />
          </div>
        ) : null}
      </BottomSheet>
    </div>
  );
};
