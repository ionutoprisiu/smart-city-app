import { create } from 'zustand';
import { extractErrorMessage } from '@shared/api/errors';
import { Logger } from '@shared/utils/logger';
import { VisitCityApi } from '../api/visitCityApi';
import {
  Attraction,
  AttractionCategory,
  RouteResult,
  RoutingProfile,
} from '../types';

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

  routingProfile: RoutingProfile;

  isSelected: (id: number) => boolean;
  selectedCount: () => number;
  canOptimize: () => boolean;
  allAttractions: () => Attraction[];

  toggleSelection: (id: number) => void;
  clearSelection: () => void;
  setRoutingProfile: (profile: RoutingProfile) => Promise<void>;

  loadAttractions: () => Promise<void>;
  optimizeRoute: () => Promise<void>;
  applyTour: (attractionIds: number[], profile: RoutingProfile) => Promise<void>;
  applyTourRoute: (attractionIds: number[], result: RouteResult) => void;
  clearRoute: () => void;
  startRoute: () => void;
  stopRoute: () => void;

  filterByCategory: (category: AttractionCategory | null) => void;
  search: (query: string) => void;
  clearFilters: () => void;

  addCustomPin: (latitude: number, longitude: number) => void;
  removeCustomPin: (id: number) => void;
};

let customPinCounter = 0;

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

  routingProfile: 'driving',

  isSelected: (id) => get().selectedIds.includes(id),
  selectedCount: () => get().selectedIds.length,
  canOptimize: () => get().selectedIds.filter((id) => id > 0).length >= 1,
  allAttractions: () => [...get().attractions, ...get().customPins],

  toggleSelection: (id) => {
    const { selectedIds } = get();
    const next = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    set({
      selectedIds: next,
      routeStarted: false,
      routeResult: null,
    });
  },

  clearSelection: () => {
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
  },

  optimizeRoute: async () => {
    const { selectedIds, routingProfile } = get();
    const backendIds = selectedIds.filter((id) => id > 0);

    if (!get().canOptimize()) {
      set({ errorMessage: 'Alege cel puțin o atracție.' });
      return;
    }

    set({ isOptimizing: true, errorMessage: null });
    try {
      const result = await VisitCityApi.optimizeRoute({
        attractionIds: backendIds,
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

  // Open a guide's tour: preselect its attractions, set the profile, and optimize
  // with ACO — reusing the exact same flow as a manual selection.
  applyTour: async (attractionIds, profile) => {
    set({
      selectedIds: attractionIds,
      routingProfile: profile,
      routeStarted: false,
      routeResult: null,
    });
    await get().optimizeRoute();
  },

  // Load a route already optimized by the tours endpoint (possibly under a
  // time budget — Orienteering). Selection mirrors the tour's candidates so
  // every stop AND every skipped attraction stays visible on the map.
  applyTourRoute: (attractionIds, result) => {
    set({
      selectedIds: attractionIds,
      routingProfile: result.routingProfile,
      routeResult: result,
      routeStarted: false,
      errorMessage: null,
    });
  },

  clearRoute: () => {
    set({ routeStarted: false, routeResult: null });
  },

  startRoute: () => {
    if (get().routeResult == null) return;
    set({ routeStarted: true });
  },

  stopRoute: () => {
    set({ routeStarted: false });
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
      importanceScore: 0,
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
