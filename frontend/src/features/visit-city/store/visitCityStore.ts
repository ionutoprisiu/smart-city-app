import Geolocation from '@react-native-community/geolocation';
import {
  PERMISSIONS,
  RESULTS,
  request as requestPermission,
} from 'react-native-permissions';
import { create } from 'zustand';
import { extractErrorMessage } from '../../../shared/api/errors';
import { Logger } from '../../../shared/utils/logger';
import { VisitCityApi } from '../api/visitCityApi';
import {
  Attraction,
  AttractionCategory,
  RouteResult,
  RoutingProfile,
} from '../types';

type Position = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

type VisitCityState = {
  attractions: Attraction[];
  customPins: Attraction[];
  selectedIds: number[];
  selectedCategory: AttractionCategory | null;
  searchQuery: string;
  isLoading: boolean;
  errorMessage: string | null;

  routeResult: RouteResult | null;
  isOptimizing: boolean;
  routeStarted: boolean;

  userPosition: Position | null;

  routingProfile: RoutingProfile;

  isSelected: (id: number) => boolean;
  selectedCount: () => number;
  hasLocation: () => boolean;
  canOptimize: () => boolean;
  allAttractions: () => Attraction[];

  toggleSelection: (id: number) => void;
  clearSelection: () => void;
  setRoutingProfile: (profile: RoutingProfile) => Promise<void>;

  loadAttractions: () => Promise<void>;
  optimizeRoute: () => Promise<void>;
  clearRoute: () => void;
  startRoute: () => void;
  stopRoute: () => void;

  fetchUserLocation: () => Promise<void>;
  startLiveTracking: () => void;
  stopLiveTracking: () => void;

  filterByCategory: (category: AttractionCategory | null) => void;
  search: (query: string) => void;
  clearFilters: () => void;

  addCustomPin: (latitude: number, longitude: number) => void;
  removeCustomPin: (id: number) => void;
};

let watchId: number | null = null;
let customPinCounter = 0;

const requestLocationPermission = async (): Promise<boolean> => {
  try {
    const result = await requestPermission(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);
    return result === RESULTS.GRANTED || result === RESULTS.LIMITED;
  } catch (e) {
    Logger.warning('Location permission request failed', e);
    return false;
  }
};

export const useVisitCityStore = create<VisitCityState>((set, get) => ({
  attractions: [],
  customPins: [],
  selectedIds: [],
  selectedCategory: null,
  searchQuery: '',
  isLoading: false,
  errorMessage: null,

  routeResult: null,
  isOptimizing: false,
  routeStarted: false,

  userPosition: null,

  routingProfile: 'driving',

  isSelected: (id) => get().selectedIds.includes(id),
  selectedCount: () => get().selectedIds.length,
  hasLocation: () => get().userPosition != null,
  canOptimize: () => {
    const { selectedIds, userPosition } = get();
    const backendCount = selectedIds.filter((id) => id > 0).length;
    if (backendCount >= 2) return true;
    if (backendCount >= 1 && userPosition != null) return true;
    return false;
  },
  allAttractions: () => [...get().attractions, ...get().customPins],

  toggleSelection: (id) => {
    const { selectedIds } = get();
    const next = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    get().stopLiveTracking();
    set({
      selectedIds: next,
      routeStarted: false,
      routeResult: null,
    });
  },

  clearSelection: () => {
    get().stopLiveTracking();
    set({
      selectedIds: [],
      routeStarted: false,
      routeResult: null,
    });
  },

  setRoutingProfile: async (profile) => {
    const lower = profile.toLowerCase();
    if (lower !== 'driving' && lower !== 'foot') return;
    if (get().routingProfile === lower) return;
    set({ routingProfile: lower as RoutingProfile });
    if (get().routeResult != null && get().canOptimize()) {
      await get().optimizeRoute();
    }
  },

  loadAttractions: async () => {
    set({ isLoading: true, errorMessage: null });
    const { selectedCategory, searchQuery } = get();
    try {
      let result: Attraction[];
      if (selectedCategory != null) {
        result = await VisitCityApi.getAttractions({
          category: selectedCategory.toUpperCase(),
          query: searchQuery.length === 0 ? null : searchQuery,
        });
      } else if (searchQuery.length > 0) {
        result = await VisitCityApi.getAttractions({ query: searchQuery });
      } else {
        result = await VisitCityApi.getAttractions();
      }
      set({ attractions: result });
    } catch (e) {
      set({ errorMessage: extractErrorMessage(e) });
      Logger.error('Failed to load attractions', e);
    } finally {
      set({ isLoading: false });
    }

    if (get().selectedCategory == null && get().searchQuery.length === 0) {
      // Background refresh with live attractions; ignore failures.
      VisitCityApi.getLiveAttractions({ limit: 1200 })
        .then((live) => {
          if (live.length > 0) set({ attractions: live });
        })
        .catch((e) => Logger.warning(`Live attractions refresh skipped: ${e}`));
    }
  },

  optimizeRoute: async () => {
    const { selectedIds, userPosition, routingProfile } = get();
    const backendIds = selectedIds.filter((id) => id > 0);

    if (!get().canOptimize()) {
      set({
        errorMessage:
          userPosition == null
            ? 'Select at least 2 attractions, or enable location for 1'
            : 'Select at least 1 attraction to optimize a route',
      });
      return;
    }

    set({ isOptimizing: true, errorMessage: null });
    try {
      const result = await VisitCityApi.optimizeRoute({
        attractionIds: backendIds,
        startLat: userPosition?.latitude ?? null,
        startLon: userPosition?.longitude ?? null,
        routingProfile,
      });
      set({
        routeResult: result,
        routingProfile: result.routingProfile,
        routeStarted: false,
      });
    } catch (e) {
      set({ errorMessage: extractErrorMessage(e) });
      Logger.error('Failed to optimize route', e);
    } finally {
      set({ isOptimizing: false });
    }
  },

  clearRoute: () => {
    get().stopLiveTracking();
    set({ routeStarted: false, routeResult: null });
  },

  startRoute: () => {
    if (get().routeResult == null) return;
    set({ routeStarted: true });
    get().startLiveTracking();
  },

  stopRoute: () => {
    get().stopLiveTracking();
    set({ routeStarted: false });
  },

  fetchUserLocation: async () => {
    const granted = await requestLocationPermission();
    if (!granted) {
      Logger.warning('Location permission denied');
      return;
    }
    return new Promise<void>((resolve) => {
      Geolocation.getCurrentPosition(
        (pos) => {
          set({
            userPosition: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            },
          });
          resolve();
        },
        (err) => {
          Logger.error('Failed to get location', err);
          resolve();
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 },
      );
    });
  },

  startLiveTracking: () => {
    get().stopLiveTracking();
    watchId = Geolocation.watchPosition(
      (pos) => {
        set({
          userPosition: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        });
      },
      (err) => Logger.warning(`Live tracking stream error: ${err}`),
      { enableHighAccuracy: true, distanceFilter: 3, interval: 2000 },
    );
  },

  stopLiveTracking: () => {
    if (watchId != null) {
      Geolocation.clearWatch(watchId);
      watchId = null;
    }
  },

  filterByCategory: (category) => {
    set({ selectedCategory: category });
    get().loadAttractions();
  },

  search: (query) => {
    set({ searchQuery: query, selectedCategory: null });
    get().loadAttractions();
  },

  clearFilters: () => {
    set({ selectedCategory: null, searchQuery: '' });
    get().loadAttractions();
  },

  addCustomPin: (latitude, longitude) => {
    customPinCounter += 1;
    const pin: Attraction = {
      id: -customPinCounter,
      name: `Custom Pin ${customPinCounter}`,
      description: 'Custom location added by you',
      latitude,
      longitude,
      city: 'Cluj-Napoca',
      category: 'other',
      isActive: true,
    };
    set({ customPins: [...get().customPins, pin] });
  },

  removeCustomPin: (id) => {
    set({
      customPins: get().customPins.filter((p) => p.id !== id),
      selectedIds: get().selectedIds.filter((sid) => sid !== id),
    });
  },
}));
