import { useVisitCityStore } from '../src/features/visit-city/store/visitCityStore';

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}));

jest.mock('react-native-permissions', () => ({
  PERMISSIONS: { IOS: { LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE' } },
  RESULTS: { GRANTED: 'granted', LIMITED: 'limited' },
  request: jest.fn(),
}));

jest.mock('../src/features/visit-city/api/visitCityApi', () => ({
  VisitCityApi: {
    getAttractions: jest.fn().mockResolvedValue([]),
    getLiveAttractions: jest.fn().mockResolvedValue([]),
    optimizeRoute: jest.fn(),
  },
}));

const resetStore = () => {
  useVisitCityStore.setState({
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
  });
};

describe('visitCityStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  test('canOptimize requires at least two backend points OR one with location', () => {
    useVisitCityStore.setState({ selectedIds: [10] });
    expect(useVisitCityStore.getState().canOptimize()).toBe(false);

    useVisitCityStore.setState({ userPosition: { latitude: 46.77, longitude: 23.59 } });
    expect(useVisitCityStore.getState().canOptimize()).toBe(true);

    useVisitCityStore.setState({ userPosition: null, selectedIds: [10, 11] });
    expect(useVisitCityStore.getState().canOptimize()).toBe(true);
  });

  test('toggleSelection adds/removes IDs and resets current route state', () => {
    useVisitCityStore.setState({
      selectedIds: [],
      routeStarted: true,
      routeResult: {
        steps: [],
        totalDistance: 0,
        totalTime: 0,
        travelTimeMinutes: 0,
        routeGeometry: [],
        routeSegments: [],
        usedOsrm: false,
        routingProfile: 'driving',
      },
    });

    useVisitCityStore.getState().toggleSelection(7);
    expect(useVisitCityStore.getState().selectedIds).toEqual([7]);
    expect(useVisitCityStore.getState().routeStarted).toBe(false);
    expect(useVisitCityStore.getState().routeResult).toBeNull();

    useVisitCityStore.getState().toggleSelection(7);
    expect(useVisitCityStore.getState().selectedIds).toEqual([]);
  });

  test('custom pins are added with negative IDs and can be removed', () => {
    useVisitCityStore.getState().addCustomPin(46.77, 23.59);
    useVisitCityStore.getState().addCustomPin(46.78, 23.58);

    const pins = useVisitCityStore.getState().customPins;
    expect(pins).toHaveLength(2);
    expect(pins[0].id).toBeLessThan(0);
    expect(pins[1].id).toBeLessThan(0);

    useVisitCityStore.setState({ selectedIds: [pins[0].id, 99] });
    useVisitCityStore.getState().removeCustomPin(pins[0].id);

    expect(useVisitCityStore.getState().customPins).toHaveLength(1);
    expect(useVisitCityStore.getState().selectedIds).toEqual([99]);
  });
});
