class RouteStep {
  final int order;
  final int attractionId;
  final String attractionName;
  final double latitude;
  final double longitude;
  final double? distanceToNext;
  final int? estimatedVisitTime;

  RouteStep({
    required this.order,
    required this.attractionId,
    required this.attractionName,
    required this.latitude,
    required this.longitude,
    this.distanceToNext,
    this.estimatedVisitTime,
  });

  factory RouteStep.fromJson(Map<String, dynamic> json) {
    return RouteStep(
      order: json['order'] ?? 0,
      attractionId: json['attractionId'] ?? 0,
      attractionName: json['attractionName'] ?? '',
      latitude: (json['latitude'] ?? 0).toDouble(),
      longitude: (json['longitude'] ?? 0).toDouble(),
      distanceToNext: json['distanceToNext']?.toDouble(),
      estimatedVisitTime: json['estimatedVisitTime'],
    );
  }
}

class RouteResult {
  final List<RouteStep> steps;
  final double totalDistance;
  final int totalTime;
  final List<LatLonPoint> routeGeometry;
  final List<List<LatLonPoint>> routeSegments;
  final bool usedOsrm;

  RouteResult({
    required this.steps,
    required this.totalDistance,
    required this.totalTime,
    required this.routeGeometry,
    required this.routeSegments,
    required this.usedOsrm,
  });

  factory RouteResult.fromJson(Map<String, dynamic> json) {
    final stepsJson = json['steps'] as List? ?? [];
    final geometryJson = json['routeGeometry'] as List? ?? json['path'] as List? ?? [];
    final segmentsJson = json['routeSegments'] as List? ?? [];

    return RouteResult(
      steps: stepsJson.map((s) => RouteStep.fromJson(s as Map<String, dynamic>)).toList(),
      totalDistance: (json['totalDistance'] ?? 0).toDouble(),
      totalTime: json['totalTime'] ?? 0,
      routeGeometry: _parsePoints(geometryJson),
      routeSegments: segmentsJson
          .map((seg) => _parsePoints(seg as List))
          .toList(),
      usedOsrm: json['usedOsrm'] ?? false,
    );
  }

  static List<LatLonPoint> _parsePoints(List points) {
    return points
        .map((p) => LatLonPoint(
              latitude: (p['latitude'] ?? 0).toDouble(),
              longitude: (p['longitude'] ?? 0).toDouble(),
            ))
        .toList();
  }
}

class LatLonPoint {
  final double latitude;
  final double longitude;

  LatLonPoint({required this.latitude, required this.longitude});
}
