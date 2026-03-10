import '../models/attraction.dart';
import '../models/route_result.dart';
import '../services/api_service.dart';
import '../utils/logger.dart';

class VisitCityRepository {
  final ApiService _apiService;

  VisitCityRepository({ApiService? apiService})
      : _apiService = apiService ?? ApiService();

  Future<List<Attraction>> getAttractions({String? category, String? query}) async {
    try {
      var endpoint = '/visit-city/attractions';
      final params = <String>[];
      if (category != null && category.isNotEmpty) params.add('category=$category');
      if (query != null && query.isNotEmpty) params.add('q=$query');
      if (params.isNotEmpty) endpoint += '?${params.join('&')}';

      final data = await _apiService.getList(endpoint);
      return data.map((json) => Attraction.fromJson(json as Map<String, dynamic>)).toList();
    } catch (e) {
      Logger.error('Failed to fetch attractions', e);
      rethrow;
    }
  }

  Future<List<Attraction>> getLiveAttractions({String? query, int? limit}) async {
    try {
      var endpoint = '/visit-city/attractions/live';
      final params = <String>[];
      if (query != null && query.isNotEmpty) params.add('q=$query');
      if (limit != null && limit > 0) params.add('limit=$limit');
      if (params.isNotEmpty) endpoint += '?${params.join('&')}';

      final data = await _apiService.getList(endpoint);
      return data.map((json) => Attraction.fromJson(json as Map<String, dynamic>)).toList();
    } catch (e) {
      Logger.error('Live attractions failed, falling back to DB attractions', e);
      return getAttractions(query: query);
    }
  }

  Future<RouteResult> optimizeRoute(List<int> attractionIds, {double? startLat, double? startLon}) async {
    try {
      final body = <String, dynamic>{
        'attractionIds': attractionIds,
      };
      if (startLat != null) body['startLatitude'] = startLat;
      if (startLon != null) body['startLongitude'] = startLon;

      final data = await _apiService.post('/visit-city/optimize', body);
      return RouteResult.fromJson(data);
    } catch (e) {
      Logger.error('Failed to optimize route', e);
      rethrow;
    }
  }
}
