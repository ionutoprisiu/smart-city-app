import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, {
  LongPressEvent,
  MapPressEvent,
  Marker,
  Polyline,
  Region,
  UrlTile,
} from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { AppButton } from '../../../shared/components/AppButton';
import { useTheme } from '../../../theme';
import { CustomPinsBanner } from '../components/CustomPinsBanner';
import { MapControlsCard } from '../components/MapControlsCard';
import { RouteInfoCard } from '../components/RouteInfoCard';
import { RouteStartBar } from '../components/RouteStartBar';
import { RouteStepsList } from '../components/RouteStepsList';
import { SelectionDock } from '../components/SelectionDock';
import { useVisitCityStore } from '../store/visitCityStore';
import {
  Attraction,
  RouteResult,
  categoryIcon,
  categoryLabel,
} from '../types';

const CLUJ_CENTER = { latitude: 46.7712, longitude: 23.5898 };
const TILE_URL =
  'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

const SEGMENT_COLORS = [
  '#4285F4',
  '#EA4335',
  '#34A853',
  '#FBBC05',
  '#9C27B0',
  '#FF6D00',
  '#00BCD4',
  '#795548',
];

const earthRadiusMeters = 6378137;

const distanceMeters = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) => {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
};

const buildRoutePolylines = (
  result: RouteResult | null,
  hidePassedSegments: boolean,
  userPosition: { latitude: number; longitude: number } | null,
) => {
  if (result == null) return [] as { id: string; coords: { latitude: number; longitude: number }[]; color: string }[];

  if (result.routeSegments.length > 0) {
    const passedSegments =
      hidePassedSegments && userPosition != null
        ? passedSegmentCount(result, userPosition)
        : 0;
    return result.routeSegments
      .map((seg, i) => ({
        id: `seg-${i}`,
        coords: seg.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        skip: i < passedSegments,
      }))
      .filter((s) => !s.skip && s.coords.length > 0);
  }

  if (result.routeGeometry.length > 0) {
    return [
      {
        id: 'geom',
        coords: result.routeGeometry.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
        })),
        color: SEGMENT_COLORS[0],
      },
    ];
  }
  return [];
};

const passedSegmentCount = (
  result: RouteResult,
  userPosition: { latitude: number; longitude: number },
) => {
  if (result.routeSegments.length === 0 || result.steps.length < 2) return 0;
  const sorted = [...result.steps].sort((a, b) => a.order - b.order);
  const startIdx = sorted.findIndex((s) => s.attractionId === 0);
  const baseIdx = startIdx >= 0 ? startIdx : 0;

  let passed = 0;
  const REACH_RADIUS_M = 15;
  for (let segIndex = 0; segIndex < result.routeSegments.length; segIndex += 1) {
    const endStepIdx = baseIdx + segIndex + 1;
    if (endStepIdx >= sorted.length) break;
    const endStep = sorted[endStepIdx];
    const dist = distanceMeters(
      { latitude: userPosition.latitude, longitude: userPosition.longitude },
      { latitude: endStep.latitude, longitude: endStep.longitude },
    );
    if (dist <= REACH_RADIUS_M) passed += 1;
    else break;
  }
  return passed;
};

const computeRouteRegion = (result: RouteResult): Region | null => {
  const points = result.routeGeometry;
  if (points.length === 0) return null;
  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLon = points[0].longitude;
  let maxLon = points[0].longitude;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLon = Math.min(minLon, p.longitude);
    maxLon = Math.max(maxLon, p.longitude);
  }
  const latPad = Math.max(0.005, (maxLat - minLat) * 0.4);
  const lonPad = Math.max(0.005, (maxLon - minLon) * 0.4);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: maxLat - minLat + latPad,
    longitudeDelta: maxLon - minLon + lonPad,
  };
};

export const MapScreen: React.FC = () => {
  const theme = useTheme();
  const {
    attractions,
    customPins,
    selectedCount,
    routeResult,
    routeStarted,
    isOptimizing,
    routingProfile,
    userPosition,
    canOptimize,
    isSelected,
    fetchUserLocation,
    setRoutingProfile,
    optimizeRoute,
    clearSelection,
    clearRoute,
    startRoute,
    stopRoute,
    toggleSelection,
    addCustomPin,
    removeCustomPin,
  } = useVisitCityStore();

  const mapRef = useRef<MapView>(null);
  const didFitRoute = useRef(false);
  const [details, setDetails] = useState<Attraction | null>(null);
  const [pinOptions, setPinOptions] = useState<Attraction | null>(null);
  const themedStyles = {
    markerBorder: { borderColor: '#FFFFFF' },
    markerSelectedBorderWidth: { borderWidth: 3 },
    markerDefaultBorderWidth: { borderWidth: 2 },
    markerOrderText: { color: theme.colors.onPrimary },
    markerEmoji: { fontSize: 18 },
    customPinBg: { backgroundColor: theme.colors.error },
    userDotBg: { backgroundColor: '#1A73E8' },
    arrowMarkerBg: { backgroundColor: theme.colors.primary },
    selectionDockWrap: { marginBottom: 10 },
    routeStartWrap: { marginBottom: 12 },
    modalSheetBg: { backgroundColor: theme.colors.surfaceContainerHigh },
    handleBg: { backgroundColor: theme.colors.onSurfaceVariant + '4D' },
    modalContentPad: { padding: theme.spacing.large },
    modalHeaderRowStart: { flexDirection: 'row' as const, alignItems: 'flex-start' as const },
    modalHeaderRowCenter: { flexDirection: 'row' as const, alignItems: 'center' as const },
    modalEmoji: { fontSize: 28, marginRight: 12 },
    modalTitle: { color: theme.colors.onSurface, flex: 1 },
    modalSub: { color: theme.colors.onSurfaceVariant, marginTop: 8 },
    modalBody: { color: theme.colors.onSurface, marginTop: 12 },
    locationRow: { flexDirection: 'row' as const, alignItems: 'center' as const, marginTop: 16 },
    locationText: { color: theme.colors.onSurface, marginLeft: 6 },
    spacer16: { height: 16 },
    pinTitle: { color: theme.colors.onSurface, marginLeft: 12, flex: 1 },
    pinCoord: { color: theme.colors.onSurfaceVariant, marginTop: 8 },
    spacer20: { height: 20 },
  };

  useEffect(() => {
    fetchUserLocation();
  }, [fetchUserLocation]);

  useEffect(() => {
    if (routeResult == null) {
      didFitRoute.current = false;
      return;
    }
    if (routeStarted && !didFitRoute.current) {
      didFitRoute.current = true;
      const region = computeRouteRegion(routeResult);
      if (region != null && mapRef.current != null) {
        mapRef.current.animateToRegion(region, 600);
      }
      if (userPosition != null) {
        setTimeout(() => {
          mapRef.current?.animateToRegion(
            {
              latitude: userPosition.latitude,
              longitude: userPosition.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            500,
          );
        }, 800);
      }
    } else if (!routeStarted) {
      didFitRoute.current = false;
    }
  }, [routeResult, routeStarted, userPosition]);

  const handleRecenter = () => {
    if (userPosition != null) {
      mapRef.current?.animateToRegion(
        {
          latitude: userPosition.latitude,
          longitude: userPosition.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        400,
      );
    } else {
      mapRef.current?.animateToRegion(
        { ...CLUJ_CENTER, latitudeDelta: 0.05, longitudeDelta: 0.05 },
        400,
      );
    }
  };

  const onLongPress = (event: LongPressEvent) => {
    const { coordinate } = event.nativeEvent;
    addCustomPin(coordinate.latitude, coordinate.longitude);
  };

  const onMapPress = (_event: MapPressEvent) => {
    // intentionally empty — taps on markers handle their own logic.
  };

  const polylines = buildRoutePolylines(
    routeResult,
    routeStarted && userPosition != null,
    userPosition,
  );

  const orderMap: Record<number, number> = {};
  if (routeResult != null) {
    routeResult.steps.forEach((step) => {
      if (step.attractionId > 0) orderMap[step.attractionId] = step.order;
    });
  }

  const visibleAttractions =
    routeResult != null
      ? attractions.filter((a) => orderMap[a.id] != null)
      : attractions;

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ ...CLUJ_CENTER, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        onLongPress={onLongPress}
        onPress={onMapPress}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        <UrlTile urlTemplate={TILE_URL} maximumZ={19} flipY={false} />

        {polylines.map((line) => (
          <Polyline
            key={line.id}
            coordinates={line.coords}
            strokeColor={line.color}
            strokeWidth={6}
          />
        ))}

        {visibleAttractions.map((a) => {
          const order = orderMap[a.id];
          const selected = isSelected(a.id);
          return (
            <Marker
              key={a.id}
              coordinate={{ latitude: a.latitude, longitude: a.longitude }}
              onPress={() => setDetails(a)}
              tracksViewChanges={false}
            >
              <View
                style={[
                  styles.markerBase,
                  {
                    backgroundColor:
                      order != null
                        ? theme.colors.primary
                        : selected
                        ? theme.colors.primary
                        : theme.colors.surfaceContainerHighest + 'EB',
                  },
                  selected || order != null
                    ? themedStyles.markerSelectedBorderWidth
                    : themedStyles.markerDefaultBorderWidth,
                  themedStyles.markerBorder,
                ]}
              >
                {order != null ? (
                  <Text
                    style={[styles.markerOrderText, themedStyles.markerOrderText]}
                  >
                    {order}
                  </Text>
                ) : selected ? (
                  <Icon name="check" size={22} color={theme.colors.onPrimary} />
                ) : (
                  <Text style={themedStyles.markerEmoji}>{categoryIcon(a.category)}</Text>
                )}
              </View>
            </Marker>
          );
        })}

        {!routeStarted &&
          customPins.map((pin) => (
            <Marker
              key={pin.id}
              coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
              onPress={() => setPinOptions(pin)}
              tracksViewChanges={false}
            >
              <View
                style={[
                  styles.customPin,
                  themedStyles.customPinBg,
                  themedStyles.markerBorder,
                ]}
              >
                <Icon name="push-pin" size={20} color="#FFFFFF" />
              </View>
            </Marker>
          ))}

        {!routeStarted && userPosition != null ? (
          <Marker
            coordinate={{
              latitude: userPosition.latitude,
              longitude: userPosition.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[styles.userDot, themedStyles.userDotBg, themedStyles.markerBorder]} />
          </Marker>
        ) : null}

        {routeStarted && routeResult != null && userPosition != null ? (
          <Marker
            coordinate={{
              latitude: userPosition.latitude,
              longitude: userPosition.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[styles.arrowMarker, themedStyles.arrowMarkerBg, themedStyles.markerBorder]}>
              <Icon name="navigation" size={22} color="#FFFFFF" />
            </View>
          </Marker>
        ) : null}
      </MapView>

      <SafeAreaView pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View style={styles.topRight} pointerEvents="box-none">
          <MapControlsCard
            hasRoute={routeResult != null}
            routeStarted={routeStarted}
            onRecenter={handleRecenter}
            onModify={stopRoute}
            onClear={clearRoute}
          />
        </View>

        {routeResult != null && !routeStarted ? (
          <View style={styles.topLeft} pointerEvents="box-none">
            <RouteInfoCard result={routeResult} />
          </View>
        ) : null}

        <View style={styles.bottomBar} pointerEvents="box-none">
          {!routeStarted && routeResult == null && selectedCount() > 0 ? (
            <View style={themedStyles.selectionDockWrap}>
              <SelectionDock
                count={selectedCount()}
                profile={routingProfile}
                isOptimizing={isOptimizing}
                canOptimize={canOptimize()}
                onProfileChanged={(p) => setRoutingProfile(p)}
                onOptimize={canOptimize() ? optimizeRoute : undefined}
                onClear={clearSelection}
              />
            </View>
          ) : null}

          {routeResult != null && !routeStarted ? (
            <View style={themedStyles.routeStartWrap}>
              <RouteStartBar onStart={startRoute} onModify={stopRoute} />
            </View>
          ) : null}

          {routeResult != null && routeStarted ? (
            <RouteStepsList result={routeResult} compact />
          ) : null}

          {routeResult == null && selectedCount() === 0 && customPins.length > 0 ? (
            <CustomPinsBanner
              count={customPins.length}
              onClearAll={() => {
                customPins.forEach((p) => removeCustomPin(p.id));
              }}
            />
          ) : null}
        </View>
      </SafeAreaView>

      <Modal
        visible={details != null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetails(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setDetails(null)} />
        <View
          style={[
            styles.modalSheet,
            themedStyles.modalSheetBg,
          ]}
        >
          <View style={[styles.handle, themedStyles.handleBg]} />
          {details ? (
            <View style={themedStyles.modalContentPad}>
              <View style={themedStyles.modalHeaderRowStart}>
                <Text style={themedStyles.modalEmoji}>
                  {categoryIcon(details.category)}
                </Text>
                <Text
                  style={[
                    theme.typography.titleLarge,
                    themedStyles.modalTitle,
                  ]}
                >
                  {details.name}
                </Text>
              </View>
              <Text
                style={[
                  theme.typography.bodyMedium,
                  themedStyles.modalSub,
                ]}
              >
                {categoryLabel(details.category)}
              </Text>
              <Text
                style={[
                  theme.typography.bodyLarge,
                  themedStyles.modalBody,
                ]}
              >
                {details.description}
              </Text>
              <View style={themedStyles.locationRow}>
                <Icon name="location-on" size={16} color={theme.colors.primary} />
                <Text
                  style={[
                    theme.typography.bodyMedium,
                    themedStyles.locationText,
                  ]}
                >
                  {details.latitude.toFixed(4)}, {details.longitude.toFixed(4)}
                </Text>
              </View>
              <View style={themedStyles.spacer16} />
              <AppButton
                label={isSelected(details.id) ? 'Remove from route' : 'Add to route'}
                variant={isSelected(details.id) ? 'destructive' : 'filled'}
                iconName={
                  isSelected(details.id) ? 'remove-circle-outline' : 'add-circle-outline'
                }
                onPress={() => {
                  toggleSelection(details.id);
                  setDetails(null);
                }}
              />
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={pinOptions != null}
        transparent
        animationType="slide"
        onRequestClose={() => setPinOptions(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPinOptions(null)} />
        <View
          style={[
            styles.modalSheet,
            themedStyles.modalSheetBg,
          ]}
        >
          <View style={[styles.handle, themedStyles.handleBg]} />
          {pinOptions ? (
            <View style={themedStyles.modalContentPad}>
              <View style={themedStyles.modalHeaderRowCenter}>
                <Icon name="push-pin" size={28} color={theme.colors.onSurface} />
                <Text
                  style={[
                    theme.typography.titleLarge,
                    themedStyles.pinTitle,
                  ]}
                >
                  {pinOptions.name}
                </Text>
              </View>
              <Text
                style={[
                  theme.typography.bodyMedium,
                  themedStyles.pinCoord,
                ]}
              >
                {pinOptions.latitude.toFixed(5)}, {pinOptions.longitude.toFixed(5)}
              </Text>
              <View style={themedStyles.spacer20} />
              <AppButton
                label="Remove Pin"
                variant="outlined"
                iconName="delete-outline"
                onPress={() => {
                  removeCustomPin(pinOptions.id);
                  setPinOptions(null);
                }}
              />
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topRight: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  topLeft: {
    position: 'absolute',
    top: 12,
    left: 16,
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
  },
  markerBase: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerOrderText: {
    fontWeight: '700',
    fontSize: 14,
  },
  customPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
  },
  arrowMarker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    minHeight: 220,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
});
