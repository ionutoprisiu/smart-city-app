import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import '../models/attraction.dart';
import '../models/route_result.dart';
import '../repositories/visit_city_repository.dart';
import '../utils/logger.dart';

class VisitCityProvider extends ChangeNotifier {
  final VisitCityRepository _repository;

  List<Attraction> _attractions = [];
  final List<Attraction> _customPins = [];
  final Set<int> _selectedIds = {};
  AttractionCategory? _selectedCategory;
  String _searchQuery = '';
  bool _isLoading = false;
  String? _errorMessage;

  RouteResult? _routeResult;
  bool _isOptimizing = false;
  bool _routeStarted = false;

  Position? _userPosition;

  int _customPinCounter = 0;

  VisitCityProvider({VisitCityRepository? repository})
      : _repository = repository ?? VisitCityRepository();

  List<Attraction> get attractions => _attractions;
  List<Attraction> get customPins => _customPins;
  List<Attraction> get allAttractions => [..._attractions, ..._customPins];
  AttractionCategory? get selectedCategory => _selectedCategory;
  String get searchQuery => _searchQuery;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  RouteResult? get routeResult => _routeResult;
  bool get isOptimizing => _isOptimizing;
  bool get routeStarted => _routeStarted;
  Set<int> get selectedIds => _selectedIds;
  int get selectedCount => _selectedIds.length;
  Position? get userPosition => _userPosition;
  bool get hasLocation => _userPosition != null;

  bool isSelected(int id) => _selectedIds.contains(id);

  bool get canOptimize {
    final backendCount = _selectedIds.where((id) => id > 0).length;
    if (backendCount >= 2) return true;
    if (backendCount >= 1 && _userPosition != null) return true;
    return false;
  }

  void toggleSelection(int id) {
    if (_selectedIds.contains(id)) {
      _selectedIds.remove(id);
    } else {
      _selectedIds.add(id);
    }
    _routeStarted = false;
    _routeResult = null;
    notifyListeners();
  }

  void clearSelection() {
    _selectedIds.clear();
    _routeStarted = false;
    _routeResult = null;
    notifyListeners();
  }

  Future<void> fetchUserLocation() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        Logger.warning('Location permission denied');
        return;
      }

      _userPosition = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      notifyListeners();
    } catch (e) {
      Logger.error('Failed to get location', e);
    }
  }

  Future<void> loadAttractions() async {
    try {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();

      if (_selectedCategory != null) {
        _attractions = await _repository.getAttractions(
          category: _selectedCategory?.name.toUpperCase(),
          query: _searchQuery.isEmpty ? null : _searchQuery,
        );
      } else if (_searchQuery.isNotEmpty) {
        _attractions = await _repository.getAttractions(
          query: _searchQuery,
        );
      } else {
        // Fast first paint: show local DB attractions immediately,
        // then refresh with live Overpass data in background.
        _attractions = await _repository.getAttractions();
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      Logger.error('Failed to load attractions', e);
    } finally {
      _isLoading = false;
      notifyListeners();
    }

    if (_selectedCategory == null && _searchQuery.isEmpty) {
      _refreshLiveAttractionsInBackground();
    }
  }

  Future<void> _refreshLiveAttractionsInBackground() async {
    try {
      final live = await _repository.getLiveAttractions(
        query: null,
        limit: 1200,
      );
      if (live.isNotEmpty) {
        _attractions = live;
        notifyListeners();
      }
    } catch (e) {
      // Silent fallback: user already sees DB list.
      Logger.warning('Live attractions refresh skipped: $e');
    }
  }

  Future<void> optimizeRoute() async {
    final backendIds = _selectedIds.where((id) => id > 0).toList();

    if (!canOptimize) {
      _errorMessage = _userPosition == null
          ? 'Select at least 2 attractions, or enable location for 1'
          : 'Select at least 1 attraction to optimize a route';
      notifyListeners();
      return;
    }

    try {
      _isOptimizing = true;
      _errorMessage = null;
      notifyListeners();

      _routeResult = await _repository.optimizeRoute(
        backendIds,
        startLat: _userPosition?.latitude,
        startLon: _userPosition?.longitude,
      );
      _routeStarted = false;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      Logger.error('Failed to optimize route', e);
    } finally {
      _isOptimizing = false;
      notifyListeners();
    }
  }

  void clearRoute() {
    _routeStarted = false;
    _routeResult = null;
    notifyListeners();
  }

  void startRoute() {
    if (_routeResult == null) return;
    _routeStarted = true;
    notifyListeners();
  }

  void stopRoute() {
    _routeStarted = false;
    notifyListeners();
  }

  void addCustomPin(double lat, double lon) {
    _customPinCounter++;
    _customPins.add(Attraction(
      id: -_customPinCounter,
      name: 'Custom Pin $_customPinCounter',
      description: 'Custom location added by you',
      latitude: lat,
      longitude: lon,
      city: 'Cluj-Napoca',
      category: AttractionCategory.other,
      estimatedVisitTime: 30,
      isActive: true,
    ));
    notifyListeners();
  }

  void removeCustomPin(int id) {
    _customPins.removeWhere((pin) => pin.id == id);
    _selectedIds.remove(id);
    notifyListeners();
  }

  void filterByCategory(AttractionCategory? category) {
    _selectedCategory = category;
    loadAttractions();
  }

  void search(String query) {
    _searchQuery = query;
    _selectedCategory = null;
    loadAttractions();
  }

  void clearFilters() {
    _selectedCategory = null;
    _searchQuery = '';
    loadAttractions();
  }
}
