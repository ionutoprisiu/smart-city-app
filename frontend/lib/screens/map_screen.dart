import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_marker_cluster_2/flutter_map_marker_cluster.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import '../models/attraction.dart';
import '../models/route_result.dart';
import '../providers/visit_city_provider.dart';
import '../config/app_constants.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  static const _clujCenter = LatLng(46.7712, 23.5898);

  /// Slightly smaller hit-area for a cleaner, less crowded map.
  static const double _mapMarkerExtent = 46;
  final _mapController = MapController();
  bool _didFitBoundsOnStart = false;
  bool _didFocusOnArrowAfterStart = false;
  LatLng? _lastCameraCenter;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<VisitCityProvider>().fetchUserLocation();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<VisitCityProvider>(
      builder: (context, provider, _) {
        final attractionMarkers = _buildAttractionMarkers(provider);
        final otherMarkers = [
          if (!provider.routeStarted) ..._buildCustomMarkers(provider),
          if (!provider.routeStarted && provider.userPosition != null)
            _buildUserMarker(provider),
          if (provider.routeStarted &&
              provider.routeResult != null &&
              provider.userPosition != null)
            _buildDirectionArrowMarker(
              provider.routeResult!,
              provider.userPosition!,
            ),
        ];
        // Keep clustering active whenever there is no computed route.
        // This avoids visual overload when user selected a few places.
        final useClustering = provider.routeResult == null;

        final polylines = _buildSegmentPolylines(
          provider.routeResult,
          hidePassedSegments:
              provider.routeStarted && provider.userPosition != null,
          userPosition: provider.userPosition,
        );

        // When the user taps Start, make the map focus the route like Google Maps.
        if (provider.routeResult == null) {
          _didFitBoundsOnStart = false;
          _didFocusOnArrowAfterStart = false;
          _lastCameraCenter = null;
        } else if (!provider.routeStarted) {
          _didFitBoundsOnStart = false;
          _didFocusOnArrowAfterStart = false;
          _lastCameraCenter = null;
        } else if (provider.routeStarted &&
            !_didFitBoundsOnStart &&
            provider.routeResult != null) {
          _didFitBoundsOnStart = true;
          final route = provider.routeResult!;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _fitMapToRoute(route);
            _focusOnUserOnce(provider.userPosition);
          });
        }

        // Light camera follow: keep the arrow visible without constantly re-centering.
        if (provider.routeStarted && provider.userPosition != null) {
          final current = LatLng(
            provider.userPosition!.latitude,
            provider.userPosition!.longitude,
          );
          final shouldMove =
              _lastCameraCenter == null ||
              _distanceMeters(_lastCameraCenter!, current) > 25;
          if (shouldMove) {
            _lastCameraCenter = current;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              final currentZoom = _mapController.camera.zoom;
              final zoom = currentZoom < 16 ? 16.0 : currentZoom;
              _mapController.move(current, zoom);
            });
          }
        }

        return Stack(
          children: [
            FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: _clujCenter,
                initialZoom: 14,
                onLongPress: (_, latLng) {
                  provider.addCustomPin(latLng.latitude, latLng.longitude);
                },
              ),
              children: [
                TileLayer(
                  urlTemplate:
                      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                  subdomains: const ['a', 'b', 'c', 'd'],
                  userAgentPackageName: 'com.example.licenta_app',
                ),
                if (polylines.isNotEmpty) PolylineLayer(polylines: polylines),
                if (useClustering)
                  MarkerClusterLayerWidget(
                    options: MarkerClusterLayerOptions(
                      markers: attractionMarkers,
                      maxClusterRadius: 48,
                      size: const Size(46, 46),
                      alignment: Alignment.center,
                      padding: const EdgeInsets.all(48),
                      showPolygon: false,
                      spiderfyCluster: true,
                      zoomToBoundsOnClick: true,
                      builder: (context, markers) {
                        final cs = Theme.of(context).colorScheme;
                        final count = markers.length;
                        final bg = count >= 50
                            ? cs.primary
                            : count >= 15
                            ? cs.primaryContainer
                            : cs.surfaceContainerHighest;
                        final fg = count >= 50 ? cs.onPrimary : cs.onSurface;
                        return Container(
                          decoration: BoxDecoration(
                            color: bg,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.16),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                            border: Border.all(color: Colors.white, width: 2.5),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '$count',
                            style: TextStyle(
                              color: fg,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        );
                      },
                    ),
                  )
                else
                  MarkerLayer(markers: attractionMarkers),
                if (otherMarkers.isNotEmpty) MarkerLayer(markers: otherMarkers),
              ],
            ),
            Positioned(
              top: 0,
              right: 0,
              child: SafeArea(
                minimum: const EdgeInsets.fromLTRB(0, 12, 12, 0),
                child: _MapControlsCard(
                  hasRoute: provider.routeResult != null,
                  routeStarted: provider.routeStarted,
                  onRecenter: () {
                    if (provider.userPosition != null) {
                      _mapController.move(
                        LatLng(
                          provider.userPosition!.latitude,
                          provider.userPosition!.longitude,
                        ),
                        15,
                      );
                    } else {
                      _mapController.move(_clujCenter, 14);
                    }
                  },
                  onModify: provider.stopRoute,
                  onClear: provider.clearRoute,
                ),
              ),
            ),
            if (provider.routeResult != null && !provider.routeStarted)
              Positioned(
                top: 0,
                left: 0,
                child: SafeArea(
                  minimum: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: _RouteInfoCard(result: provider.routeResult!),
                ),
              ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: SafeArea(
                minimum: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (!provider.routeStarted &&
                        provider.routeResult == null &&
                        provider.selectedCount > 0)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _SelectionDockCompact(
                          count: provider.selectedCount,
                          profile: provider.routingProfile,
                          isOptimizing: provider.isOptimizing,
                          canOptimize: provider.canOptimize,
                          onProfileChanged: (p) =>
                              provider.setRoutingProfile(p),
                          onOptimize: provider.canOptimize
                              ? () => provider.optimizeRoute()
                              : null,
                          onClear: provider.clearSelection,
                        ),
                      ),
                    if (provider.routeResult != null && !provider.routeStarted)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _RouteStartBar(
                          onStart: provider.startRoute,
                          onModify: provider.stopRoute,
                        ),
                      ),
                    if (provider.routeResult != null && provider.routeStarted)
                      _RouteStepsList(
                        result: provider.routeResult!,
                        compact: provider.routeStarted,
                      ),
                    if (provider.routeResult == null &&
                        provider.selectedCount == 0 &&
                        provider.customPins.isNotEmpty)
                      _CustomPinsBanner(
                        count: provider.customPins.length,
                        onClearAll: () {
                          for (final pin in List.of(provider.customPins)) {
                            provider.removeCustomPin(pin.id);
                          }
                        },
                      ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Marker _buildUserMarker(VisitCityProvider provider) {
    final route = provider.routeResult;
    final LatLng point;
    if (route != null &&
        route.steps.isNotEmpty &&
        route.steps.first.attractionId == 0) {
      final s = route.steps.first;
      point = LatLng(s.latitude, s.longitude);
    } else {
      final pos = provider.userPosition!;
      point = LatLng(pos.latitude, pos.longitude);
    }
    return Marker(
      point: point,
      width: 36,
      height: 36,
      alignment: Alignment.center,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: const Color(0xFF1A73E8),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 3),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.22),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
      ),
    );
  }

  static const _segmentColors = [
    Color(0xFF4285F4), // blue
    Color(0xFFEA4335), // red
    Color(0xFF34A853), // green
    Color(0xFFFBBC05), // yellow
    Color(0xFF9C27B0), // purple
    Color(0xFFFF6D00), // orange
    Color(0xFF00BCD4), // cyan
    Color(0xFF795548), // brown
  ];

  static bool _sameLatLng(LatLng a, LatLng b) {
    return (a.latitude - b.latitude).abs() < 1e-5 &&
        (a.longitude - b.longitude).abs() < 1e-5;
  }

  List<Polyline> _buildSegmentPolylines(
    RouteResult? result, {
    bool hidePassedSegments = false,
    Position? userPosition,
  }) {
    if (result == null) return [];

    if (result.routeSegments.isNotEmpty) {
      final polylines = <Polyline>[];
      LatLng? prevSegmentEnd;
      final segmentCount = result.routeSegments.length;
      final waypointPoints = result.steps
          .where((s) => s.attractionId > 0)
          .map((s) => LatLng(s.latitude, s.longitude))
          .toList();
      final passedSegmentCount = hidePassedSegments && userPosition != null
          ? _passedSegmentCount(result, userPosition)
          : 0;
      for (var i = 0; i < result.routeSegments.length; i++) {
        if (hidePassedSegments && i < passedSegmentCount) continue;

        final seg = result.routeSegments[i];
        var points = seg.map((p) => LatLng(p.latitude, p.longitude)).toList();
        // Avoid duplicating the joint when each leg is anchored to exact waypoints.
        if (prevSegmentEnd != null &&
            points.isNotEmpty &&
            _sameLatLng(prevSegmentEnd, points.first)) {
          points = points.sublist(1);
        }
        if (points.isEmpty) continue;

        // If legs overlap (e.g., you need to "come back"), draw them slightly
        // side-by-side by offsetting each segment perpendicular to its direction.
        final offsetMeters = _offsetMetersForSegmentIndex(i, segmentCount);
        if (offsetMeters != 0) {
          points = _offsetPolylinePoints(points, offsetMeters, waypointPoints);
        }

        prevSegmentEnd = points.last;
        final color = _segmentColors[i % _segmentColors.length];
        polylines.add(
          Polyline(
            points: points,
            strokeWidth: 6,
            color: color,
            borderColor: Colors.white,
            borderStrokeWidth: 2,
          ),
        );
      }
      return polylines;
    }

    if (result.routeGeometry.isNotEmpty) {
      return [
        Polyline(
          points: result.routeGeometry
              .map((p) => LatLng(p.latitude, p.longitude))
              .toList(),
          strokeWidth: 4,
          color: Theme.of(context).colorScheme.primary,
        ),
      ];
    }

    return [];
  }

  int _passedSegmentCount(RouteResult result, Position userPosition) {
    if (result.routeSegments.isEmpty) return 0;
    if (result.steps.length < 2) return 0;

    final steps = result.steps.toList()
      ..sort((a, b) => a.order.compareTo(b.order));
    final startIdx = steps.indexWhere((s) => s.attractionId == 0);
    final baseIdx = startIdx >= 0 ? startIdx : 0;

    final userPoint = LatLng(userPosition.latitude, userPosition.longitude);
    const reachRadiusMeters = 15.0;

    var passed = 0;
    final maxSegments = result.routeSegments.length;
    for (var segIndex = 0; segIndex < maxSegments; segIndex++) {
      final endStepIdx = baseIdx + segIndex + 1;
      if (endStepIdx >= steps.length) break;
      final endStep = steps[endStepIdx];
      final endPoint = LatLng(endStep.latitude, endStep.longitude);
      final dist = _distanceMeters(userPoint, endPoint);
      if (dist <= reachRadiusMeters) {
        passed++;
      } else {
        break;
      }
    }
    return passed;
  }

  double _offsetMetersForSegmentIndex(int segmentIndex, int segmentCount) {
    if (segmentCount <= 1) return 0;
    // Spread segments in both directions around 0 so adjacent legs are visible.
    // Keep the offset small (meters) so it doesn't look "shifted".
    const offsetStepMeters = 1.2;
    final centered = segmentIndex - (segmentCount - 1) / 2.0;
    return centered * offsetStepMeters;
  }

  List<LatLng> _offsetPolylinePoints(
    List<LatLng> points,
    double offsetMeters,
    List<LatLng> keepPoints,
  ) {
    if (points.length < 2) return points;

    const earthRadiusMeters = 6378137.0; // WGS84-like

    // Snap the closest polyline vertices to the attraction waypoints.
    // Without this, the offset could slightly move vertices away from the
    // exact marker coordinate (you'll see it on "some attractions").
    final keepIndices = <int>{};
    const snapMaxMeters = 50.0;

    for (final keep in keepPoints) {
      var bestIndex = -1;
      var bestDist = double.infinity;
      for (var i = 0; i < points.length; i++) {
        final d = _distanceMeters(points[i], keep);
        if (d < bestDist) {
          bestDist = d;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0 && bestDist <= snapMaxMeters) {
        // Replace the closest vertex with the waypoint coordinate.
        points[bestIndex] = keep;
        keepIndices.add(bestIndex);
      }
    }

    // Compute an offset normal for each non-snapped point using a local bearing.
    final out = <LatLng>[];
    for (var i = 0; i < points.length; i++) {
      if (keepIndices.contains(i)) {
        out.add(points[i]);
        continue;
      }

      final prev = points[math.max(0, i - 1)];
      final next = points[math.min(points.length - 1, i + 1)];

      final lat1 = prev.latitude * math.pi / 180.0;
      final lat2 = next.latitude * math.pi / 180.0;
      final dLon = (next.longitude - prev.longitude) * math.pi / 180.0;

      // Bearing from prev -> next
      final y = math.sin(dLon) * math.cos(lat2);
      final x =
          math.cos(lat1) * math.sin(lat2) -
          math.sin(lat1) * math.cos(lat2) * math.cos(dLon);
      var bearing = math.atan2(y, x); // radians, relative to north

      // Convert to "normal" direction: bearing + 90 degrees.
      bearing += math.pi / 2.0;

      // Decompose into east/north meters
      final north = offsetMeters * math.cos(bearing);
      final east = offsetMeters * math.sin(bearing);

      final lat = points[i].latitude * math.pi / 180.0;
      final deltaLat = north / earthRadiusMeters;
      final deltaLon = east / (earthRadiusMeters * math.cos(lat));

      final newLat =
          (points[i].latitude * math.pi / 180.0 + deltaLat) * 180.0 / math.pi;
      final newLon =
          (points[i].longitude * math.pi / 180.0 + deltaLon) * 180.0 / math.pi;

      out.add(LatLng(newLat, newLon));
    }
    return out;
  }

  double _distanceMeters(LatLng a, LatLng b) {
    const earthRadiusMeters = 6378137.0;
    final lat1 = a.latitude * math.pi / 180.0;
    final lat2 = b.latitude * math.pi / 180.0;
    final dLat = (b.latitude - a.latitude) * math.pi / 180.0;
    final dLon = (b.longitude - a.longitude) * math.pi / 180.0;

    final sinDLat = math.sin(dLat / 2);
    final sinDLon = math.sin(dLon / 2);
    final h =
        sinDLat * sinDLat + math.cos(lat1) * math.cos(lat2) * sinDLon * sinDLon;
    return 2 * earthRadiusMeters * math.asin(math.sqrt(h));
  }

  void _fitMapToRoute(RouteResult result) {
    final bounds = _boundsForRoute(result);
    if (bounds == null) return;

    // Padding accounts for the bottom sheet + safe areas so the route doesn't get hidden.
    _mapController.fitCamera(
      CameraFit.bounds(
        bounds: bounds,
        padding: const EdgeInsets.fromLTRB(16, 120, 16, 220),
        maxZoom: 18,
      ),
    );
  }

  LatLngBounds? _boundsForRoute(RouteResult result) {
    final points = result.routeGeometry;
    if (points.isEmpty) return null;

    double minLat = points.first.latitude;
    double maxLat = points.first.latitude;
    double minLon = points.first.longitude;
    double maxLon = points.first.longitude;

    for (final p in points) {
      minLat = minLat < p.latitude ? minLat : p.latitude;
      maxLat = maxLat > p.latitude ? maxLat : p.latitude;
      minLon = minLon < p.longitude ? minLon : p.longitude;
      maxLon = maxLon > p.longitude ? maxLon : p.longitude;
    }

    // Avoid zero-sized bounds when there's a single point.
    if (minLat == maxLat) {
      minLat -= 0.0008;
      maxLat += 0.0008;
    }
    if (minLon == maxLon) {
      minLon -= 0.0008;
      maxLon += 0.0008;
    }

    return LatLngBounds(LatLng(minLat, minLon), LatLng(maxLat, maxLon));
  }

  List<Marker> _buildAttractionMarkers(VisitCityProvider provider) {
    final route = provider.routeResult;
    final orderMap = <int, int>{};
    final stepLat = <int, double>{};
    final stepLon = <int, double>{};
    if (route != null) {
      for (final step in route.steps) {
        if (step.attractionId > 0) {
          orderMap[step.attractionId] = step.order;
          stepLat[step.attractionId] = step.latitude;
          stepLon[step.attractionId] = step.longitude;
        }
      }
    }

    final markers = <Marker>[];
    for (final a in provider.attractions) {
      final order = orderMap[a.id];
      final selected = provider.isSelected(a.id);

      // After Optimize, show only attractions that belong to the route.
      // This removes the "clutter" from unrelated places.
      if (route != null && order == null) continue;

      final markerPoint = stepLat.containsKey(a.id)
          ? LatLng(stepLat[a.id]!, stepLon[a.id]!)
          : LatLng(a.latitude, a.longitude);

      markers.add(
        Marker(
          point: markerPoint,
          width: _mapMarkerExtent,
          height: _mapMarkerExtent,
          alignment: Alignment.center,
          child: GestureDetector(
            onTap: () => _showAttractionDetails(a, provider),
            child: order != null
                ? _OrderedMarker(order: order, theme: Theme.of(context))
                : _AttractionMarker(
                    attraction: a,
                    theme: Theme.of(context),
                    selected: selected,
                  ),
          ),
        ),
      );
    }
    return markers;
  }

  Marker _buildDirectionArrowMarker(RouteResult route, Position userPosition) {
    final userPoint = LatLng(userPosition.latitude, userPosition.longitude);
    final target = _routeTargetPoint(route, userPoint);

    // Rotate the arrow so it always points towards the next attraction.
    final bearingRad = _bearingRadians(userPoint, target);

    final cs = Theme.of(context).colorScheme;

    // Keep marker anchored to the user's current location.
    return Marker(
      point: userPoint,
      width: 52,
      height: 52,
      alignment: Alignment.center,
      child: Transform.rotate(
        angle: bearingRad,
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: cs.primary,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 3),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.18),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Icon(Icons.navigation_rounded, size: 22, color: Colors.white),
        ),
      ),
    );
  }

  LatLng _routeTargetPoint(RouteResult route, LatLng userPoint) {
    final waypoints = route.steps.where((s) => s.attractionId > 0).toList()
      ..sort((a, b) => a.order.compareTo(b.order));

    if (waypoints.isEmpty) return userPoint;

    // Pick the closest waypoint; if we're close enough, advance to next.
    var closestIndex = 0;
    var closestDist = double.infinity;
    for (var i = 0; i < waypoints.length; i++) {
      final w = waypoints[i];
      final d = _distanceMeters(userPoint, LatLng(w.latitude, w.longitude));
      if (d < closestDist) {
        closestDist = d;
        closestIndex = i;
      }
    }

    const reachRadiusMeters = 15.0;
    final targetIndex =
        (closestDist <= reachRadiusMeters &&
            closestIndex < waypoints.length - 1)
        ? closestIndex + 1
        : closestIndex;

    final t = waypoints[targetIndex];
    return LatLng(t.latitude, t.longitude);
  }

  void _focusOnUserOnce(Position? userPosition) {
    if (_didFocusOnArrowAfterStart) return;
    if (userPosition == null) return;
    _didFocusOnArrowAfterStart = true;

    final userPoint = LatLng(userPosition.latitude, userPosition.longitude);
    _lastCameraCenter = userPoint;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _mapController.move(userPoint, 17.0);
    });
  }

  double _bearingRadians(LatLng from, LatLng to) {
    // Bearing in radians where 0 points to North.
    final lat1 = from.latitude * math.pi / 180.0;
    final lat2 = to.latitude * math.pi / 180.0;
    final dLon = (to.longitude - from.longitude) * math.pi / 180.0;

    final y = math.sin(dLon) * math.cos(lat2);
    final x =
        math.cos(lat1) * math.sin(lat2) -
        math.sin(lat1) * math.cos(lat2) * math.cos(dLon);
    final bearing = math.atan2(y, x);
    return bearing;
  }

  List<Marker> _buildCustomMarkers(VisitCityProvider provider) {
    return provider.customPins.map((pin) {
      return Marker(
        point: LatLng(pin.latitude, pin.longitude),
        width: _mapMarkerExtent,
        height: _mapMarkerExtent,
        alignment: Alignment.center,
        child: GestureDetector(
          onTap: () => _showCustomPinOptions(pin),
          child: Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.error,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 3),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.18),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            alignment: Alignment.center,
            child: const Icon(
              Icons.push_pin_rounded,
              size: 20,
              color: Colors.white,
            ),
          ),
        ),
      );
    }).toList();
  }

  void _showAttractionDetails(
    Attraction attraction,
    VisitCityProvider provider,
  ) {
    final theme = Theme.of(context);
    final selected = provider.isSelected(attraction.id);

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(AppConstants.paddingLarge),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.onSurfaceVariant.withValues(
                    alpha: 0.3,
                  ),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                Text(
                  attraction.category.icon,
                  style: const TextStyle(fontSize: 28),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    attraction.name,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Chip(label: Text(attraction.category.label)),
            const SizedBox(height: 12),
            Text(attraction.description, style: theme.textTheme.bodyLarge),
            const SizedBox(height: 16),
            Row(
              children: [
                Icon(
                  Icons.location_on,
                  size: 16,
                  color: theme.colorScheme.primary,
                ),
                const SizedBox(width: 6),
                Text(
                  '${attraction.latitude.toStringAsFixed(4)}, ${attraction.longitude.toStringAsFixed(4)}',
                ),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () {
                  provider.toggleSelection(attraction.id);
                  Navigator.pop(ctx);
                },
                icon: Icon(
                  selected
                      ? Icons.remove_circle_outline
                      : Icons.add_circle_outline,
                ),
                label: Text(selected ? 'Remove from route' : 'Add to route'),
                style: selected
                    ? FilledButton.styleFrom(
                        backgroundColor: theme.colorScheme.error,
                      )
                    : null,
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showCustomPinOptions(Attraction pin) {
    final theme = Theme.of(context);
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(AppConstants.paddingLarge),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.onSurfaceVariant.withValues(
                    alpha: 0.3,
                  ),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                const Icon(Icons.push_pin, size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    pin.name,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${pin.latitude.toStringAsFixed(5)}, ${pin.longitude.toStringAsFixed(5)}',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () {
                  context.read<VisitCityProvider>().removeCustomPin(pin.id);
                  Navigator.pop(ctx);
                },
                icon: Icon(
                  Icons.delete_outline,
                  color: theme.colorScheme.error,
                ),
                label: Text(
                  'Remove Pin',
                  style: TextStyle(color: theme.colorScheme.error),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(
                    color: theme.colorScheme.error.withValues(alpha: 0.5),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}

class _AttractionMarker extends StatelessWidget {
  final Attraction attraction;
  final ThemeData theme;
  final bool selected;

  const _AttractionMarker({
    required this.attraction,
    required this.theme,
    required this.selected,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: selected
            ? theme.colorScheme.primary
            : theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.92),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: selected ? 3 : 2),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: selected ? 0.2 : 0.1),
            blurRadius: selected ? 8 : 6,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: selected
          ? Icon(
              Icons.check_rounded,
              size: 22,
              color: theme.colorScheme.onPrimary,
            )
          : Text(
              attraction.category.icon,
              style: const TextStyle(fontSize: 18, height: 1),
            ),
    );
  }
}

class _OrderedMarker extends StatelessWidget {
  final int order;
  final ThemeData theme;

  const _OrderedMarker({required this.order, required this.theme});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: theme.colorScheme.primary,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.16),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        '$order',
        style: TextStyle(
          color: theme.colorScheme.onPrimary,
          fontWeight: FontWeight.w700,
          fontSize: 14,
          height: 1,
          letterSpacing: -0.3,
        ),
      ),
    );
  }
}

class _MapControlsCard extends StatelessWidget {
  final bool hasRoute;
  final bool routeStarted;
  final VoidCallback onRecenter;
  final VoidCallback onModify;
  final VoidCallback onClear;

  const _MapControlsCard({
    required this.hasRoute,
    required this.routeStarted,
    required this.onRecenter,
    required this.onModify,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Material(
      color: cs.surfaceContainerHighest.withValues(alpha: 0.92),
      borderRadius: BorderRadius.circular(18),
      elevation: 0,
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              tooltip: 'Recenter',
              onPressed: onRecenter,
              icon: const Icon(Icons.my_location_rounded),
            ),
            if (hasRoute) ...[
              if (routeStarted)
                IconButton(
                  tooltip: 'Modify route',
                  onPressed: onModify,
                  icon: const Icon(Icons.edit_rounded),
                ),
              IconButton(
                tooltip: 'Clear route',
                onPressed: onClear,
                color: cs.error,
                icon: const Icon(Icons.close_rounded),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _SelectionDockCompact extends StatelessWidget {
  final int count;
  final String profile;
  final bool isOptimizing;
  final bool canOptimize;
  final Future<void> Function(String profile) onProfileChanged;
  final VoidCallback? onOptimize;
  final VoidCallback onClear;

  const _SelectionDockCompact({
    required this.count,
    required this.profile,
    required this.isOptimizing,
    required this.canOptimize,
    required this.onProfileChanged,
    required this.onOptimize,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Material(
      elevation: 0,
      color: cs.surfaceContainerHighest.withValues(alpha: 0.93),
      borderRadius: BorderRadius.circular(20),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 10, 10, 10),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                SegmentedButton<String>(
                  style: SegmentedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 8,
                    ),
                    visualDensity: VisualDensity.compact,
                    selectedBackgroundColor: cs.primaryContainer,
                    selectedForegroundColor: cs.onPrimaryContainer,
                    side: BorderSide(
                      color: cs.outlineVariant.withValues(alpha: 0.45),
                    ),
                  ),
                  showSelectedIcon: false,
                  segments: const [
                    ButtonSegment<String>(
                      value: 'driving',
                      icon: Icon(Icons.directions_car_outlined, size: 18),
                      label: Text('Drive'),
                    ),
                    ButtonSegment<String>(
                      value: 'foot',
                      icon: Icon(Icons.directions_walk, size: 18),
                      label: Text('Walk'),
                    ),
                  ],
                  selected: {profile},
                  onSelectionChanged: (next) {
                    if (isOptimizing || next.isEmpty) return;
                    onProfileChanged(next.first);
                  },
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '$count selected',
                    style: theme.textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: cs.onSurfaceVariant,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: onClear,
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    minimumSize: const Size(48, 32),
                  ),
                  child: const Text('Clear'),
                ),
                const SizedBox(width: 2),
                FilledButton(
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    visualDensity: VisualDensity.compact,
                    minimumSize: const Size(44, 36),
                  ),
                  onPressed: isOptimizing ? null : onOptimize,
                  child: isOptimizing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Icon(Icons.route_rounded, size: 18),
                ),
              ],
            ),
            if (!canOptimize)
              Padding(
                padding: const EdgeInsets.only(top: 8, left: 6),
                child: Text(
                  'Pick at least 2 places (or enable location for 1 place).',
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: cs.onSurfaceVariant,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _RouteStartBar extends StatelessWidget {
  final VoidCallback onStart;
  final VoidCallback onModify;

  const _RouteStartBar({required this.onStart, required this.onModify});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Material(
      elevation: 0,
      color: cs.surfaceContainerHighest.withValues(alpha: 0.95),
      borderRadius: BorderRadius.circular(20),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 14, 14, 14),
        child: Row(
          children: [
            Icon(Icons.route_rounded, size: 22, color: cs.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Route ready',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            TextButton(
              onPressed: onModify,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12),
              ),
              child: const Text('Modify'),
            ),
            const SizedBox(width: 4),
            FilledButton.icon(
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 12,
                ),
              ),
              onPressed: onStart,
              icon: const Icon(Icons.play_arrow_rounded, size: 22),
              label: const Text('Start'),
            ),
          ],
        ),
      ),
    );
  }
}

class _RouteInfoCard extends StatelessWidget {
  final RouteResult result;

  const _RouteInfoCard({required this.result});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    String fmt(int minutes) {
      final h = minutes ~/ 60;
      final m = minutes % 60;
      return h > 0 ? '${h}h ${m}m' : '${m}m';
    }

    final travelStr = fmt(result.travelTimeMinutes);
    final totalStr = fmt(result.totalTime);

    return Material(
      elevation: 0,
      color: cs.surfaceContainerHighest.withValues(alpha: 0.95),
      shadowColor: Colors.transparent,
      borderRadius: BorderRadius.circular(20),
      clipBehavior: Clip.antiAlias,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 300),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Optimized route',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.2,
                  color: cs.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    result.totalDistance.toStringAsFixed(1),
                    style: theme.textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.5,
                      height: 1,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Padding(
                    padding: const EdgeInsets.only(bottom: 2),
                    child: Text(
                      'km',
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: cs.onSurfaceVariant,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 10,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  _RouteStatPill(
                    icon: Icons.schedule_rounded,
                    label: 'Travel $travelStr',
                    theme: theme,
                  ),
                  _RouteStatPill(
                    icon: Icons.timer_outlined,
                    label: 'ETA $totalStr',
                    theme: theme,
                    emphasized: true,
                  ),
                ],
              ),
              if (result.usedOsrm) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(
                      result.routingProfile == 'foot'
                          ? Icons.directions_walk
                          : Icons.directions_car_outlined,
                      size: 16,
                      color: cs.primary,
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        result.routingProfile == 'foot'
                            ? 'Walking · OSRM — credible foot routes need your own build (foot.lua), not URL alone'
                            : 'Driving · OSRM',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: cs.onSurfaceVariant,
                          height: 1.35,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _RouteStatPill extends StatelessWidget {
  final IconData icon;
  final String label;
  final ThemeData theme;
  final bool emphasized;

  const _RouteStatPill({
    required this.icon,
    required this.label,
    required this.theme,
    this.emphasized = false,
  });

  @override
  Widget build(BuildContext context) {
    final cs = theme.colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: emphasized
            ? cs.primaryContainer.withValues(alpha: 0.55)
            : cs.surface.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: cs.outlineVariant.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: cs.primary),
          const SizedBox(width: 6),
          Text(
            label,
            style: theme.textTheme.labelMedium?.copyWith(
              fontWeight: FontWeight.w600,
              letterSpacing: 0.1,
            ),
          ),
        ],
      ),
    );
  }
}

class _RouteStepsList extends StatelessWidget {
  final RouteResult result;

  final bool compact;

  const _RouteStepsList({required this.result, this.compact = false});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final height = compact ? 104.0 : 148.0;
    final cardWidth = compact ? 112.0 : 128.0;
    final avatarRadius = compact ? 16.0 : 20.0;
    final avatarIconSize = compact ? 18.0 : 20.0;
    final titleMaxLines = compact ? 1 : 2;

    return Material(
      elevation: 0,
      color: cs.surfaceContainerHighest.withValues(alpha: 0.95),
      borderRadius: BorderRadius.circular(20),
      clipBehavior: Clip.antiAlias,
      child: SizedBox(
        height: height,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: EdgeInsets.fromLTRB(
            compact ? 12 : 16,
            compact ? 12 : 16,
            compact ? 12 : 16,
            compact ? 12 : 16,
          ),
          itemCount: result.steps.length,
          separatorBuilder: (_, _) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Center(
              child: Icon(
                Icons.chevron_right_rounded,
                size: compact ? 18 : 22,
                color: cs.outline.withValues(alpha: 0.55),
              ),
            ),
          ),
          itemBuilder: (_, index) {
            final step = result.steps[index];
            final isStart = step.attractionId == 0;
            final showDistance = !compact;
            return SizedBox(
              width: cardWidth,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircleAvatar(
                    radius: avatarRadius,
                    backgroundColor: isStart
                        ? const Color(0xFF1A73E8)
                        : cs.primary,
                    child: isStart
                        ? Icon(
                            Icons.near_me_rounded,
                            size: avatarIconSize,
                            color: Colors.white,
                          )
                        : Text(
                            '${step.order}',
                            style: TextStyle(
                              color: cs.onPrimary,
                              fontSize: compact ? 13 : 15,
                              fontWeight: FontWeight.w700,
                              height: 1,
                            ),
                          ),
                  ),
                  SizedBox(height: compact ? 8 : 10),
                  Text(
                    step.attractionName,
                    textAlign: TextAlign.center,
                    maxLines: titleMaxLines,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      height: 1.25,
                      fontWeight: FontWeight.w500,
                      fontSize: compact ? 13 : null,
                    ),
                  ),
                  if (showDistance && step.distanceToNext != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      '${step.distanceToNext!.toStringAsFixed(1)} km',
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: cs.onSurfaceVariant,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.2,
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _CustomPinsBanner extends StatelessWidget {
  final int count;
  final VoidCallback onClearAll;

  const _CustomPinsBanner({required this.count, required this.onClearAll});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    return Material(
      elevation: 0,
      color: cs.errorContainer.withValues(alpha: 0.45),
      borderRadius: BorderRadius.circular(20),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 14, 14, 14),
        child: Row(
          children: [
            Icon(Icons.push_pin_outlined, size: 22, color: cs.error),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                '$count custom pin${count == 1 ? '' : 's'} on map',
                style: theme.textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            TextButton(
              onPressed: onClearAll,
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 12),
              ),
              child: const Text('Clear all'),
            ),
          ],
        ),
      ),
    );
  }
}
