class RouteStep {
  final int order;
  final int attractionId;
  final String attractionName;
  final double latitude;
  final double longitude;
  final double? distanceToNext;

  RouteStep({
    required this.order,
    required this.attractionId,
    required this.attractionName,
    required this.latitude,
    required this.longitude,
    this.distanceToNext,
  });

  factory RouteStep.fromJson(Map<String, dynamic> json) {
    return RouteStep(
      order: json['order'] ?? 0,
      attractionId: json['attractionId'] ?? 0,
      attractionName: json['attractionName'] ?? '',
      latitude: (json['latitude'] ?? 0).toDouble(),
      longitude: (json['longitude'] ?? 0).toDouble(),
      distanceToNext: json['distanceToNext']?.toDouble(),
    );
  }
}

class RouteResult {
  final List<RouteStep> steps;
  final double totalDistance;
  final int totalTime;

  /// Moving time (OSRM route legs), minutes
  final int travelTimeMinutes;
  final List<LatLonPoint> routeGeometry;
  final List<List<LatLonPoint>> routeSegments;
  final bool usedOsrm;

  /// OSRM profile: driving or foot
  final String routingProfile;

  RouteResult({
    required this.steps,
    required this.totalDistance,
    required this.totalTime,
    required this.travelTimeMinutes,
    required this.routeGeometry,
    required this.routeSegments,
    required this.usedOsrm,
    this.routingProfile = 'driving',
  });

  factory RouteResult.fromJson(Map<String, dynamic> json) {
    final stepsJson = json['steps'] as List? ?? [];
    final geometryJson =
        json['routeGeometry'] as List? ?? json['path'] as List? ?? [];
    final segmentsJson = json['routeSegments'] as List? ?? [];
    int asInt(dynamic v, [int fallback = 0]) {
      if (v == null) return fallback;
      if (v is int) return v;
      if (v is num) return v.round();
      return int.tryParse('$v') ?? fallback;
    }

    final totalT = asInt(json['totalTime']);
    final travelT = json['travelTimeMinutes'] != null
        ? asInt(json['travelTimeMinutes'])
        : totalT;

    return RouteResult(
      steps: stepsJson
          .map((s) => RouteStep.fromJson(s as Map<String, dynamic>))
          .toList(),
      totalDistance: (json['totalDistance'] ?? 0).toDouble(),
      totalTime: totalT,
      travelTimeMinutes: travelT,
      routeGeometry: _parsePoints(geometryJson),
      routeSegments: segmentsJson
          .map((seg) => _parsePoints(seg as List))
          .toList(),
      usedOsrm: json['usedOsrm'] ?? false,
      routingProfile: json['routingProfile'] as String? ?? 'driving',
    );
  }

  static List<LatLonPoint> _parsePoints(List points) {
    return points
        .map(
          (p) => LatLonPoint(
            latitude: (p['latitude'] ?? 0).toDouble(),
            longitude: (p['longitude'] ?? 0).toDouble(),
          ),
        )
        .toList();
  }
}

class LatLonPoint {
  final double latitude;
  final double longitude;

  LatLonPoint({required this.latitude, required this.longitude});
}
