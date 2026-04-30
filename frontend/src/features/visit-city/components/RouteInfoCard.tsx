import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../theme';
import { RouteResult } from '../types';

type Props = {
  result: RouteResult;
  /** `dock`: full-width strip above the bottom bar so the map stays clear. */
  layout?: 'floating' | 'dock';
};

const fmt = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const RouteInfoCard: React.FC<Props> = ({ result, layout = 'floating' }) => {
  const theme = useTheme();
  const travelStr = fmt(result.travelTimeMinutes);
  const totalStr = fmt(result.totalTime);
  const docked = layout === 'dock';
  const themedStyles = {
    // ~70% opacity so underlying map labels remain readable when zoomed in.
    cardBg: { backgroundColor: theme.colors.surfaceContainerHighest + 'B3' },
    title: { color: theme.colors.onSurfaceVariant, letterSpacing: 0.2 },
    kmValue: { color: theme.colors.onSurface, letterSpacing: -0.5 },
    kmUnit: { color: theme.colors.onSurfaceVariant, marginLeft: 6, marginBottom: 2 },
    osrmText: { color: theme.colors.onSurfaceVariant, marginLeft: 8, flex: 1 },
  };

  return (
    <View
      pointerEvents="none"
      style={[
        styles.card,
        docked ? styles.cardDock : null,
        themedStyles.cardBg,
      ]}
    >
      <Text
        style={[
          theme.typography.titleSmall,
          themedStyles.title,
        ]}
      >
        Optimized route
      </Text>
      <View style={styles.kmRow}>
        <Text
          style={[
            theme.typography.headlineSmall,
            themedStyles.kmValue,
          ]}
        >
          {result.totalDistance.toFixed(1)}
        </Text>
        <Text
          style={[
            theme.typography.titleMedium,
            themedStyles.kmUnit,
          ]}
        >
          km
        </Text>
      </View>
      <View style={styles.pillsRow}>
        <Pill icon="schedule" label={`Travel ${travelStr}`} />
        <Pill icon="timer" label={`ETA ${totalStr}`} emphasized />
      </View>
      {result.usedOsrm ? (
        <View style={styles.osrmRow}>
          <Icon
            name={result.routingProfile === 'foot' ? 'directions-walk' : 'directions-car'}
            size={16}
            color={theme.colors.primary}
          />
          <Text
            style={[
              theme.typography.bodySmall,
              themedStyles.osrmText,
            ]}
          >
            {result.routingProfile === 'foot' ? 'Walking · OSRM' : 'Driving · OSRM'}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

type PillProps = { icon: string; label: string; emphasized?: boolean };

const Pill: React.FC<PillProps> = ({ icon, label, emphasized = false }) => {
  const theme = useTheme();
  const themedStyles = {
    emphasizedBg: { backgroundColor: theme.colors.primaryContainer + '8C' },
    defaultBg: { backgroundColor: theme.colors.surface + '99' },
    border: { borderColor: theme.colors.outlineVariant },
    text: { color: theme.colors.onSurface, marginLeft: 6 },
  };
  return (
    <View
      style={[
        styles.pill,
        emphasized ? themedStyles.emphasizedBg : themedStyles.defaultBg,
        themedStyles.border,
      ]}
    >
      <Icon name={icon} size={15} color={theme.colors.primary} />
      <Text
        style={[
          theme.typography.labelMedium,
          themedStyles.text,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    maxWidth: 268,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 16,
  },
  cardDock: {
    alignSelf: 'stretch',
    maxWidth: '100%',
    marginBottom: 8,
  },
  kmRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 6,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 10,
    marginBottom: 8,
  },
  osrmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
});
