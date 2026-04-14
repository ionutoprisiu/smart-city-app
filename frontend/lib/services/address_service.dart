import 'package:geocoding/geocoding.dart';

class AddressService {
  static final Map<String, String> _cache = <String, String>{};
  static const String _unknown = 'Street unavailable';

  static Future<String> streetFromCoordinates({
    required double latitude,
    required double longitude,
  }) async {
    final key = _cacheKey(latitude, longitude);
    final cached = _cache[key];
    if (cached != null) return cached;

    try {
      final placemarks = await placemarkFromCoordinates(latitude, longitude);
      if (placemarks.isEmpty) {
        _cache[key] = _unknown;
        return _unknown;
      }

      final p = placemarks.first;
      final street = _formatStreet(p);
      _cache[key] = street;
      return street;
    } catch (_) {
      _cache[key] = _unknown;
      return _unknown;
    }
  }

  static String _cacheKey(double lat, double lon) {
    // Round to reduce repeated requests for near-identical points.
    final latR = lat.toStringAsFixed(5);
    final lonR = lon.toStringAsFixed(5);
    return '$latR,$lonR';
  }

  static String _formatStreet(Placemark p) {
    final street = (p.street ?? '').trim();
    final subLocality = (p.subLocality ?? '').trim();
    final locality = (p.locality ?? '').trim();

    if (street.isNotEmpty) return street;
    if (subLocality.isNotEmpty) return subLocality;
    if (locality.isNotEmpty) return locality;
    return _unknown;
  }
}
