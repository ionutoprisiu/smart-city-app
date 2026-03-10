import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_map_marker_cluster_2/flutter_map_marker_cluster.dart';
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
  final _mapController = MapController();

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
          if (provider.userPosition != null) _buildUserMarker(provider),
        ];
        final useClustering = provider.routeResult == null && provider.selectedCount == 0;

        final polylines = _buildSegmentPolylines(provider.routeResult);

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
                  urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                  subdomains: const ['a', 'b', 'c', 'd'],
                  userAgentPackageName: 'com.example.licenta_app',
                ),
                if (polylines.isNotEmpty)
                  PolylineLayer(polylines: polylines),
                if (useClustering)
                  MarkerClusterLayerWidget(
                    options: MarkerClusterLayerOptions(
                      markers: attractionMarkers,
                      maxClusterRadius: 50,
                      size: const Size(44, 44),
                      alignment: Alignment.center,
                      padding: const EdgeInsets.all(40),
                      showPolygon: false,
                      spiderfyCluster: true,
                      zoomToBoundsOnClick: true,
                      builder: (context, markers) {
                        return Container(
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.primary,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.25),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ],
                            border: Border.all(color: Colors.white, width: 2),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '${markers.length}',
                            style: TextStyle(
                              color: Theme.of(context).colorScheme.onPrimary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        );
                      },
                    ),
                  )
                else
                  MarkerLayer(markers: attractionMarkers),
                if (otherMarkers.isNotEmpty)
                  MarkerLayer(markers: otherMarkers),
              ],
            ),
            Positioned(
              top: 12,
              right: 12,
              child: Column(
                children: [
                  FloatingActionButton.small(
                    heroTag: 'recenter',
                    onPressed: () {
                      if (provider.userPosition != null) {
                        _mapController.move(
                          LatLng(provider.userPosition!.latitude, provider.userPosition!.longitude),
                          15,
                        );
                      } else {
                        _mapController.move(_clujCenter, 14);
                      }
                    },
                    child: const Icon(Icons.my_location),
                  ),
                  if (provider.routeResult != null) ...[
                    const SizedBox(height: 8),
                    if (provider.routeStarted) ...[
                      FloatingActionButton.small(
                        heroTag: 'modifyRoute',
                        onPressed: provider.stopRoute,
                        backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                        child: Icon(Icons.edit, color: Theme.of(context).colorScheme.primary),
                      ),
                      const SizedBox(height: 8),
                    ],
                    FloatingActionButton.small(
                      heroTag: 'clearRoute',
                      onPressed: provider.clearRoute,
                      backgroundColor: Theme.of(context).colorScheme.errorContainer,
                      child: Icon(Icons.close, color: Theme.of(context).colorScheme.error),
                    ),
                  ],
                ],
              ),
            ),
            if (provider.routeResult != null)
              Positioned(
                top: 12,
                left: 12,
                child: _RouteInfoCard(result: provider.routeResult!),
              ),
            Positioned(
              bottom: 16,
              left: 16,
              right: 16,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (provider.routeResult != null && !provider.routeStarted)
                    _RouteStartBar(
                      onStart: provider.startRoute,
                      onModify: provider.stopRoute,
                    ),
                  if (provider.routeResult != null)
                    _RouteStepsList(result: provider.routeResult!),
                  if (provider.routeResult == null && provider.selectedCount > 0)
                    _SelectionBar(
                      count: provider.selectedCount,
                      isOptimizing: provider.isOptimizing,
                      canOptimize: provider.canOptimize,
                      hasLocation: provider.hasLocation,
                      onOptimize: provider.canOptimize
                          ? () => provider.optimizeRoute()
                          : null,
                      onClear: provider.clearSelection,
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
          ],
        );
      },
    );
  }

  Marker _buildUserMarker(VisitCityProvider provider) {
    final pos = provider.userPosition!;
    return Marker(
      point: LatLng(pos.latitude, pos.longitude),
      width: 24,
      height: 24,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.blue,
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 3),
          boxShadow: [
            BoxShadow(
              color: Colors.blue.withValues(alpha: 0.4),
              blurRadius: 8,
              spreadRadius: 2,
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

  List<Polyline> _buildSegmentPolylines(RouteResult? result) {
    if (result == null) return [];

    if (result.routeSegments.isNotEmpty) {
      return result.routeSegments.asMap().entries.map((entry) {
        final color = _segmentColors[entry.key % _segmentColors.length];
        final points = entry.value.map((p) => LatLng(p.latitude, p.longitude)).toList();
        return Polyline(
          points: points,
          strokeWidth: 6,
          color: color,
          borderColor: Colors.white,
          borderStrokeWidth: 2,
        );
      }).toList();
    }

    if (result.routeGeometry.isNotEmpty) {
      return [
        Polyline(
          points: result.routeGeometry.map((p) => LatLng(p.latitude, p.longitude)).toList(),
          strokeWidth: 4,
          color: Theme.of(context).colorScheme.primary,
        ),
      ];
    }

    return [];
  }

  List<Marker> _buildAttractionMarkers(VisitCityProvider provider) {
    final route = provider.routeResult;
    final orderMap = <int, int>{};
    if (route != null) {
      for (final step in route.steps) {
        if (step.attractionId > 0) {
          orderMap[step.attractionId] = step.order;
        }
      }
    }

    final markers = <Marker>[];
    for (final a in provider.attractions) {
      final order = orderMap[a.id];
      final selected = provider.isSelected(a.id);

      // After user presses Start, focus only on route points.
      if (provider.routeStarted && route != null && order == null) {
        continue;
      }

      markers.add(Marker(
        point: LatLng(a.latitude, a.longitude),
        width: 40,
        height: 40,
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
      ));
    }
    return markers;
  }

  List<Marker> _buildCustomMarkers(VisitCityProvider provider) {
    return provider.customPins.map((pin) {
      return Marker(
        point: LatLng(pin.latitude, pin.longitude),
        width: 40,
        height: 40,
        child: GestureDetector(
          onTap: () => _showCustomPinOptions(pin),
          child: Container(
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.errorContainer,
              shape: BoxShape.circle,
              border: Border.all(
                color: Theme.of(context).colorScheme.error,
                width: 2,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.2),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            alignment: Alignment.center,
            child: const Icon(Icons.push_pin, size: 18, color: Colors.white),
          ),
        ),
      );
    }).toList();
  }

  void _showAttractionDetails(Attraction attraction, VisitCityProvider provider) {
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
                width: 40, height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                Text(attraction.category.icon, style: const TextStyle(fontSize: 28)),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    attraction.name,
                    style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
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
                Icon(Icons.schedule, size: 16, color: theme.colorScheme.primary),
                const SizedBox(width: 6),
                Text('${attraction.estimatedVisitTime} min'),
                const SizedBox(width: 24),
                Icon(Icons.location_on, size: 16, color: theme.colorScheme.primary),
                const SizedBox(width: 6),
                Text('${attraction.latitude.toStringAsFixed(4)}, ${attraction.longitude.toStringAsFixed(4)}'),
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
                icon: Icon(selected ? Icons.remove_circle_outline : Icons.add_circle_outline),
                label: Text(selected ? 'Remove from route' : 'Add to route'),
                style: selected
                    ? FilledButton.styleFrom(backgroundColor: theme.colorScheme.error)
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
                width: 40, height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
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
                    style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
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
                icon: Icon(Icons.delete_outline, color: theme.colorScheme.error),
                label: Text('Remove Pin', style: TextStyle(color: theme.colorScheme.error)),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: theme.colorScheme.error.withValues(alpha: 0.5)),
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
      decoration: BoxDecoration(
        color: selected ? theme.colorScheme.primary : theme.colorScheme.primaryContainer,
        shape: BoxShape.circle,
        border: Border.all(
          color: selected ? theme.colorScheme.inversePrimary : theme.colorScheme.primary,
          width: selected ? 3 : 2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: selected ? 0.35 : 0.2),
            blurRadius: selected ? 6 : 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: selected
          ? Icon(Icons.check, size: 20, color: theme.colorScheme.onPrimary)
          : Text(attraction.category.icon, style: const TextStyle(fontSize: 18)),
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
      decoration: BoxDecoration(
        color: theme.colorScheme.primary,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      alignment: Alignment.center,
      child: Text(
        '$order',
        style: TextStyle(
          color: theme.colorScheme.onPrimary,
          fontWeight: FontWeight.bold,
          fontSize: 16,
        ),
      ),
    );
  }
}

class _SelectionBar extends StatelessWidget {
  final int count;
  final bool isOptimizing;
  final bool canOptimize;
  final bool hasLocation;
  final VoidCallback? onOptimize;
  final VoidCallback onClear;

  const _SelectionBar({
    required this.count,
    required this.isOptimizing,
    required this.canOptimize,
    required this.hasLocation,
    required this.onOptimize,
    required this.onClear,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Icon(Icons.check_circle, size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '$count selected',
                    style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w500),
                  ),
                ),
                TextButton(onPressed: onClear, child: const Text('Clear')),
                const SizedBox(width: 4),
                FilledButton.icon(
                  onPressed: isOptimizing ? null : onOptimize,
                  icon: isOptimizing
                      ? const SizedBox(
                          width: 16, height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.route, size: 18),
                  label: Text(isOptimizing ? 'Optimizing...' : 'Optimize'),
                ),
              ],
            ),
            if (count == 1 && !hasLocation)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'Enable location to get directions, or select 2+ attractions',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline),
                ),
              ),
            if (count == 1 && hasLocation)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'Route from your location to the attraction',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.primary),
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

  const _RouteStartBar({
    required this.onStart,
    required this.onModify,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Icon(Icons.route, size: 18, color: theme.colorScheme.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Route ready',
                style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
            TextButton(onPressed: onModify, child: const Text('Modify')),
            const SizedBox(width: 4),
            FilledButton.icon(
              onPressed: onStart,
              icon: const Icon(Icons.play_arrow),
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
    final hours = result.totalTime ~/ 60;
    final mins = result.totalTime % 60;
    final timeStr = hours > 0 ? '${hours}h ${mins}m' : '${mins}m';

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Optimized Route', style: theme.textTheme.labelLarge?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.straighten, size: 14, color: theme.colorScheme.primary),
                const SizedBox(width: 4),
                Text('${result.totalDistance.toStringAsFixed(1)} km'),
                const SizedBox(width: 12),
                Icon(Icons.schedule, size: 14, color: theme.colorScheme.primary),
                const SizedBox(width: 4),
                Text(timeStr),
              ],
            ),
            if (result.usedOsrm)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Text(
                  'Real road distances (OSRM)',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.primary),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _RouteStepsList extends StatelessWidget {
  final RouteResult result;

  const _RouteStepsList({required this.result});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: EdgeInsets.zero,
      child: SizedBox(
        height: 100,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          itemCount: result.steps.length,
          separatorBuilder: (_, _) => Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Icon(Icons.arrow_forward, size: 16, color: theme.colorScheme.outline),
          ),
          itemBuilder: (_, index) {
            final step = result.steps[index];
            final isStart = step.attractionId == 0;
            return SizedBox(
              width: 100,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: isStart ? Colors.blue : theme.colorScheme.primary,
                    child: isStart
                        ? const Icon(Icons.my_location, size: 14, color: Colors.white)
                        : Text(
                            '${step.order}',
                            style: TextStyle(color: theme.colorScheme.onPrimary, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    step.attractionName,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall,
                  ),
                  if (step.distanceToNext != null)
                    Text(
                      '${step.distanceToNext!.toStringAsFixed(1)} km',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.outline,
                        fontSize: 10,
                      ),
                    ),
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
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Icon(Icons.push_pin, size: 18, color: theme.colorScheme.error),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                '$count custom pin${count == 1 ? '' : 's'} on map',
                style: theme.textTheme.bodyMedium,
              ),
            ),
            TextButton(
              onPressed: onClearAll,
              child: const Text('Clear all'),
            ),
          ],
        ),
      ),
    );
  }
}
